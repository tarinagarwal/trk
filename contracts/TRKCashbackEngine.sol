// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITRKCore.sol";

// Interface to allow the Cashback engine to securely fetch and validate loss data from the Game Engine
interface ITRKGameEngineQuery {
    function getAndMarkLossBet(address user, uint256 roundId, bool isCashGame) external returns (uint256);
}

contract TRKCashbackEngine is Ownable, ITRKCashbackEngine {
    ITRKRegistry public registry;
    ITRKTreasury public treasury;
    address public router;
    address public gameEngine;
    ITRKLuckyDraw public luckyDraw;

    uint256 public lossCashbackBps = 5; // 0.5% (with 1000 denominator)
    uint256 public lossReferralBps = 1; // 0.1% (with 1000 denominator)
    uint256 public dailyLossThreshold = 100e18; // 100 USDT
    uint256 public luckySharePercent = 20; // 20%
    uint256 public roiPoolRatio = 50; // 50%
    uint256 public maxDailyCashback = 10e18; // Default 10 USDT

    // Dynamic Rates & Multipliers
    uint256[15] public roiPercents = [
        uint256(20), 10, 10, 10, 10,
        5, 5, 5, 5, 5,
        3, 3, 3, 3, 3
    ];
    
    ITRKCashbackEngine.Phase[3] public cashbackPhases;
    ITRKCashbackEngine.Cap[4] public capMultipliersBefore10k;
    ITRKCashbackEngine.Cap[4] public capMultipliersAfter10k;
    uint256 public phaseThresholdUserCount = 10000;

    /* =============================================================
                        BALANCES & DEPOSITS
    ============================================================= */


    function setCashbackSettings(
        uint256 _lossCashBps,
        uint256 _lossRefBps,
        uint256 _threshold,
        uint256 _luckyShare,
        uint256 _roiRatio,
        uint256 _maxDaily
    ) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        lossCashbackBps = _lossCashBps;
        lossReferralBps = _lossRefBps;
        dailyLossThreshold = _threshold;
        luckySharePercent = _luckyShare;
        roiPoolRatio = _roiRatio;
        maxDailyCashback = _maxDaily;
    }

    function setRoiPercents(uint256[15] calldata _percents) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        roiPercents = _percents;
    }

    function setCashbackPhases(Phase[3] calldata _phases) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        cashbackPhases = _phases;
    }

    function setCapMultipliersBefore10k(Cap[4] calldata _caps) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        capMultipliersBefore10k = _caps;
    }

    function setCapMultipliersAfter10k(Cap[4] calldata _caps) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        capMultipliersAfter10k = _caps;
    }

    function setPhaseThreshold(uint256 _threshold) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        phaseThresholdUserCount = _threshold;
    }

    mapping(address => uint256) public lastDailyClaim;

    modifier onlyRouter() {
        require(msg.sender == router, "Only router");
        _;
    }

    constructor(address _registry, address _treasury) Ownable(msg.sender) {
        registry = ITRKRegistry(_registry);
        treasury = ITRKTreasury(_treasury);
        
        cashbackPhases = [
            ITRKCashbackEngine.Phase(100000, 50),
            ITRKCashbackEngine.Phase(1000000, 40),
            ITRKCashbackEngine.Phase(0, 33)
        ];
        
        capMultipliersBefore10k = [
            ITRKCashbackEngine.Cap(20, 8),
            ITRKCashbackEngine.Cap(10, 4),
            ITRKCashbackEngine.Cap(5, 2),
            ITRKCashbackEngine.Cap(0, 1)
        ];

        capMultipliersAfter10k = [
            ITRKCashbackEngine.Cap(20, 4),
            ITRKCashbackEngine.Cap(10, 3),
            ITRKCashbackEngine.Cap(5, 2),
            ITRKCashbackEngine.Cap(0, 1)
        ];
    }

    function setAddresses(address _router, address _gameEngine, address _luckyDraw) external onlyOwner {
        router = _router;
        gameEngine = _gameEngine;
        luckyDraw = ITRKLuckyDraw(_luckyDraw);
    }

    /* =============================================================
                        IMMEDIATE LOSS CLAIM
    ============================================================= */

    function claimLoss(address user, uint256 roundId, bool isCashGame) external override onlyRouter {
        require(isCashGame, "Cash games only");
        require(gameEngine != address(0), "Game engine not set");

        // Fetch bet amount and mark as claimed in the Game Engine to prevent double-spending
        uint256 betAmount = ITRKGameEngineQuery(gameEngine).getAndMarkLossBet(user, roundId, isCashGame);
        require(betAmount > 0, "No valid lost bet found");

        uint256 cashback = (betAmount * lossCashbackBps) / 1000;
        uint256 refBonus = 0;
        
        ITRKRegistry.User memory u = registry.users(user);
        if (u.referrer != address(0)) {
            refBonus = (betAmount * lossReferralBps) / 1000;
        }

        // Deduct from Treasury's Protection Pool
        treasury.deductProtectionPool(cashback + refBonus);

        // Update User Balances
        registry.addBalances(user, 0, 0, cashback, 0, false);
        registry.addCashbackIncome(user, cashback);

        // Update Upline Balances
        if (u.referrer != address(0)) {
            registry.addBalances(u.referrer, refBonus, 0, 0, 0, false);
            registry.addLossReferralIncome(u.referrer, refBonus);
        }
    }

    /* =============================================================
                    DAILY SUSTAINABLE CASHBACK
    ============================================================= */

    function claimDailyCashback(address user) external override onlyRouter {
        uint256 today = block.timestamp / 1 days;
        require(lastDailyClaim[user] < today, "Already claimed today");
        
        ITRKRegistry.User memory u = registry.users(user);
        require(u.isCashPlayer, "Not activated");

        // Validate Threshold: Total losses must reach threshold
        uint256 totalLossAmount = u.totalBets > u.totalWins ? u.totalBets - u.totalWins : 0;
        require(totalLossAmount >= dailyLossThreshold, "Loss threshold not met");

        // Calculate Daily Rate & Amount
        uint256 rate = _getCashbackRate(registry.totalUsers());
        uint256 dailyAmount = (u.totalDeposit * rate) / 10000;

        // Apply Max Daily Cap
        if (dailyAmount > maxDailyCashback) {
            dailyAmount = maxDailyCashback;
        }

        // Apply Multiplier Caps
        uint256 multiplier = _getCapMultiplier(u.activeDirects);
        uint256 maxCap = u.totalDeposit * multiplier;

        require(u.cashbackIncome < maxCap, "Cashback max cap reached");

        if (u.cashbackIncome + dailyAmount > maxCap) {
            dailyAmount = maxCap - u.cashbackIncome;
        }

        // X% to Lucky Draw Auto-Entry
        uint256 luckyShare = (dailyAmount * luckySharePercent) / 100;
        uint256 walletShare = dailyAmount - luckyShare;
        
        // Matched for 15-Level ROI on ROI distribution
        uint256 roiPool = (dailyAmount * roiPoolRatio) / 100; 

        // Deduct total utilized funds from Protection Pool
        treasury.deductProtectionPool(dailyAmount + roiPool);

        // Update user balances
        // Update user balances
        registry.addBalances(user, walletShare, 0, 0, 0, false);
        registry.addCashbackIncome(user, dailyAmount);
        
        // NEW: Add to the virtual spendable wallet instead of just the tracker
        registry.addLuckyDrawWallet(user, luckyShare); 

        // NEW: Auto-buy trigger respecting user preference
        uint256 currentLuckyBalance = u.luckyDrawWallet + luckyShare;
        uint8 pref = u.preferredLuckyDraw;
        uint256 price = pref == 1 ? 10e18 : 1e18;
        
        if (currentLuckyBalance >= price) {
            uint256 ticketsToBuy = currentLuckyBalance / price;
            luckyDraw.buyTicketVirtual(user, ticketsToBuy, pref);
        }

        // Distribute upline rewards
        _distributeROI(user, roiPool);

        lastDailyClaim[user] = today;
    }

    /* =============================================================
                        INTERNAL LOGIC
    ============================================================= */

    function _getCashbackRate(uint256 totalUsers) internal view returns(uint256) {
        for (uint i = 0; i < 2; i++) {
            if (totalUsers <= cashbackPhases[i].userLimit) return cashbackPhases[i].rate;
        }
        return cashbackPhases[2].rate;
    }

    function _getCapMultiplier(uint256 directReferrals) internal view returns(uint256) {
        uint256 totalUsers = registry.totalUsers();
        ITRKCashbackEngine.Cap[4] storage activeCaps = totalUsers < phaseThresholdUserCount ? capMultipliersBefore10k : capMultipliersAfter10k;
        
        for (uint i = 0; i < 3; i++) {
            if (directReferrals >= activeCaps[i].directs) return activeCaps[i].multiplier;
        }
        return activeCaps[3].multiplier;
    }

    function _distributeROI(address user, uint256 pool) internal {
        address current = registry.users(user).referrer;
        for (uint256 i = 0; i < 15 && current != address(0); i++) {
            ITRKRegistry.User memory upline = registry.users(current);
            if (upline.isCashPlayer) {
                uint256 commission = (pool * roiPercents[i]) / 100;
                
                // X% of ROI income also goes to Lucky Draw automatically
                uint256 luckyShare = (commission * luckySharePercent) / 100;
                uint256 walletShare = commission - luckyShare;

                registry.addBalances(current, walletShare, 0, 0, 0, false);
                registry.addLossReferralIncome(current, commission);
                
                // NEW: Update upline's virtual wallet
                registry.addLuckyDrawWallet(current, luckyShare);

                // NEW: Auto-buy trigger for upline respecting preference
                uint256 uplineLuckyBalance = upline.luckyDrawWallet + luckyShare;
                uint8 uPref = upline.preferredLuckyDraw;
                uint256 uPrice = uPref == 1 ? 10e18 : 1e18;

                if (uplineLuckyBalance >= uPrice) {
                    uint256 ticketsToBuy = uplineLuckyBalance / uPrice;
                    luckyDraw.buyTicketVirtual(current, ticketsToBuy, uPref);
                }
            }
            current = upline.referrer;
        }
    }
}