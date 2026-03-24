// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ITRKCore.sol";

contract TRKTreasury is Ownable, ReentrancyGuard, ITRKTreasury {
    IERC20 public usdtToken;
    ITRKRegistry public registry;
    address public router;
    address public cashbackEngine;

    address public creatorWallet;
    address public fewWallet;
    address[24] public bdWallets;

    // Dynamic Settings
    uint256 public minActivation = 1e18;   // 1 USDT minimum to play
    uint256 public basicActivation = 10e18; // 10 USDT for first 3 levels
    uint256 public proActivation = 100e18;  // 100 USDT for all levels
    uint256 public minWithdrawal = 5e18;  // 5 USDT minimum withdrawal
    uint256 public maxDailyWithdrawal = 5000e18; // 5,000 USDT maximum per day
    uint256 public withdrawFee = 10;      // 10% sustainability fee

    // Ecosystem Distributions
    uint256 public creatorP = 2;
    uint256 public bdP = 5;
    uint256 public fewP = 5;
    uint256 public refP = 15;
    uint256 public clubP = 8;     // 8% daily turnover to Club Pool
    uint256 public luckyP = 2;
    uint256 public protectP = 10; // 10% to Cashback Protection Pool

    uint256[15] public referralPercents = [
        uint256(500), 200, 100, 100, 100, 
        50, 50, 50, 50, 50, 
        50, 50, 50, 50, 50
    ];

    function setTreasurySettings(
        uint256 _minActivation,
        uint256 _minWithdrawal,
        uint256 _maxDailyWithdrawal,
        uint256 _withdrawFee
    ) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        minActivation = _minActivation;
        minWithdrawal = _minWithdrawal;
        maxDailyWithdrawal = _maxDailyWithdrawal;
        withdrawFee = _withdrawFee;
    }

    function setDistributions(  
        uint256 _creator,
        uint256 _bd,
        uint256 _few,
        uint256 _ref,
        uint256 _club,
        uint256 _lucky,
        uint256 _protect
    ) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        creatorP = _creator;
        bdP = _bd;
        fewP = _few;
        refP = _ref;
        clubP = _club;
        luckyP = _lucky;
        protectP = _protect;
    }

    function setReferralPercents(uint256[15] calldata _percents) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        referralPercents = _percents;
    }

    // Pool Balances
    uint256 public gamePoolBalance;
    uint256 public clubPoolBalance;
    uint256 public goldenDrawBalance;
    uint256 public silverDrawBalance;
    uint256 public protectionPoolBalance;
    
    // NEW: Cumulative Volume Tracking for the entire split
    uint256 public totalCreatorVolume;
    uint256 public totalBDVolume;
    uint256 public totalFEWVolume;
    uint256 public totalReferralVolume;

    // Daily Withdrawal Tracking
    mapping(address => uint256) public withdrawnToday;
    mapping(address => uint256) public lastWithdrawalDay;

    address public luckyDraw;

    modifier onlyRouter() {
        require(msg.sender == router, "Only router");
        _;
    }

    modifier onlyEngines() {
        require(msg.sender == router || msg.sender == cashbackEngine || msg.sender == luckyDraw || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(
        address _usdtToken,
        address _registry,
        address _creatorWallet,
        address _fewWallet,
        address[24] memory _bdWallets
    ) Ownable(msg.sender) {
        usdtToken = IERC20(_usdtToken);
        registry = ITRKRegistry(_registry);
        creatorWallet = _creatorWallet;
        fewWallet = _fewWallet;
        bdWallets = _bdWallets;
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function setAddresses(address _router, address _cashbackEngine, address _luckyDraw) external onlyOwner {
        router = _router;
        cashbackEngine = _cashbackEngine;
        luckyDraw = _luckyDraw;
    }

    function updateWallets(address _creator, address _few, address[] calldata _bd) external override onlyRouter {
        creatorWallet = _creator;
        fewWallet = _few;
        for (uint i = 0; i < 24 && i < _bd.length; i++) {
            bdWallets[i] = _bd[i];
        }
    }

    function getWallets() external view override returns (address creator, address few, address[24] memory bd) {
        return (creatorWallet, fewWallet, bdWallets);
    }

    /* =============================================================
                        DEPOSITS & DISTRIBUTION
    ============================================================= */

    function deposit(address user, uint256 amount) external override onlyRouter nonReentrant {
        require(amount >= minActivation, "Min USDT required for activation");
        require(usdtToken.transferFrom(user, address(this), amount), "USDT Transfer failed");

        registry.addDeposit(user, amount);

        // Track Upline Team Volume for Club Income Eligibility (capped at 20 levels to prevent gas exhaustion)
        address upline = registry.users(user).referrer;
        uint256 levelCount = 0;
        while (upline != address(0) && levelCount < 20) {
            registry.incrementTeamVolume(upline, amount);
            upline = registry.users(upline).referrer;
            levelCount++;
        }

        _distribute(user, amount);
        
        emit Deposit(user, amount, amount, block.timestamp);
    }

    function _distribute(address user, uint256 amount) private {
        uint256 remaining = amount;

        // 1. Creator (2%)
        uint256 cAmt = (amount * creatorP) / 100;
        usdtToken.transfer(creatorWallet, cAmt);
        registry.recordExternalIncome(creatorWallet, cAmt, "Creator Fee", "Main Wallet");
        totalCreatorVolume += cAmt;
        remaining -= cAmt;

        // 2. Business Developers (5% split 24 ways)
        uint256 bdAmt = (amount * bdP) / 100;
        uint256 bdEach = bdAmt / 24;
        for (uint256 i = 0; i < 24; i++) {
            usdtToken.transfer(bdWallets[i], bdEach);
            registry.recordExternalIncome(bdWallets[i], bdEach, "BD Fee", "Main Wallet");
        }
        totalBDVolume += bdAmt;
        remaining -= bdAmt;

        // 3. FEW Wallet (5%)
        uint256 fAmt = (amount * fewP) / 100;
        usdtToken.transfer(fewWallet, fAmt);
        registry.recordExternalIncome(fewWallet, fAmt, "FEW Fee", "Main Wallet");
        totalFEWVolume += fAmt;
        remaining -= fAmt;

        // 4. Direct Referral Levels (15%)
        uint256 paidRef = _distributeDirectReferrals(user, amount);
        
        // The maximum theoretical payout is 15%. Any undistributed funds go 50/50 to FEW and GamePool
        uint256 maxRefAllocation = (amount * refP) / 100;
        remaining -= paidRef; 
        
        if (maxRefAllocation > paidRef) {
            uint256 diff = maxRefAllocation - paidRef;
            
            // Distribute overspill: 10% Creator, 20% BD, 20% FEW, 50% Club Pool
            uint256 cOver = (diff * 10) / 100;
            uint256 bdOver = (diff * 20) / 100;
            uint256 fewOver = (diff * 20) / 100;
            uint256 clubOver = diff - cOver - bdOver - fewOver;

            if (cOver > 0) {
                usdtToken.transfer(creatorWallet, cOver);
                registry.recordExternalIncome(creatorWallet, cOver, "Referral Overspill", "Main Wallet");
                totalCreatorVolume += cOver;
            }
            if (bdOver > 0) {
                uint256 sharedBd = bdOver / 24;
                for (uint256 i = 0; i < 24; i++) {
                    usdtToken.transfer(bdWallets[i], sharedBd);
                    registry.recordExternalIncome(bdWallets[i], sharedBd, "Referral Overspill BD", "Main Wallet");
                }
                totalBDVolume += bdOver;
            }
            if (fewOver > 0) {
                usdtToken.transfer(fewWallet, fewOver);
                registry.recordExternalIncome(fewWallet, fewOver, "Referral Overspill", "Main Wallet");
                totalFEWVolume += fewOver;
            }
            
            clubPoolBalance += clubOver;
            remaining -= diff;
        }
        totalReferralVolume += paidRef; // Core referral payouts

        // 5. Club Pool (8%)
        clubPoolBalance += (amount * clubP) / 100;
        remaining -= (amount * clubP) / 100;

        // 6. Lucky Draw Pool (2%) - Respect User Preference & Credit User Wallet
        uint8 pref = registry.users(user).preferredLuckyDraw;
        uint256 lAmt = (amount * luckyP) / 100;
        registry.addLuckyDrawWallet(user, lAmt);

        if (pref == 1) { // 1 = Golden
            goldenDrawBalance += lAmt;
        } else { // 0 = Silver (Default)
            silverDrawBalance += lAmt;
        }
        remaining -= lAmt;

        // 7. Protection Pool removed — route to Game Pool
        gamePoolBalance += (amount * protectP) / 100;
        remaining -= (amount * protectP) / 100;

        // 8. Game Pool (Remainder)
        gamePoolBalance += remaining;
    }

    function _distributeDirectReferrals(address user, uint256 totalDepositAmount) private returns (uint256) {
        address current = registry.users(user).referrer;
        uint256 totalPaid = 0;
        uint256 levelsPaid = 0;
        
        while (levelsPaid < 15 && current != address(0)) {
            ITRKRegistry.User memory upline = registry.users(current);
            
            // 30-Day Rule: If not activated with 10 USDT in 30 days, skip and compress
            if (block.timestamp > upline.registrationTime + 30 days && upline.cumulativeDeposit < basicActivation) {
                current = upline.referrer;
                continue; // Compress structure
            }

            // Tiered Unlock Logic
            bool unlocked = false;
            if (upline.cumulativeDeposit >= basicActivation) {
                if (levelsPaid < 3) {
                    unlocked = true; // First 3 levels unlocked at 10 USDT
                } else if (upline.cumulativeDeposit >= proActivation) {
                    // Over Level 3: Needs 100 USDT + Directs
                    uint256 requiredDirects = levelsPaid >= 10 ? 10 : levelsPaid;
                    if (upline.activeDirects >= requiredDirects) {
                        unlocked = true;
                    }
                }
            }

            if (upline.isCashPlayer && unlocked) {
                uint256 comm = (totalDepositAmount * referralPercents[levelsPaid]) / 10000;
                registry.addDirectReferralIncome(current, comm, levelsPaid);
                totalPaid += comm;
            }
            
            current = upline.referrer;
            levelsPaid++;
        }
        return totalPaid;
    }

    /* =============================================================
                        WITHDRAWALS
    ============================================================= */

    function withdraw(address user, uint256 amount) external override onlyRouter nonReentrant {
        require(amount >= minWithdrawal, "Minimum USDT to withdraw");
        
        ITRKRegistry.User memory u = registry.users(user);
        require(u.walletBalance >= amount, "Insufficient wallet balance");
        
        // Enforce daily limit
        uint256 today = block.timestamp / 1 days;
        if (lastWithdrawalDay[user] < today) {
            withdrawnToday[user] = 0;
            lastWithdrawalDay[user] = today;
        }
        require(withdrawnToday[user] + amount <= maxDailyWithdrawal, "Maximum withdrawal per day reached");
        
        // Sustainability Fee routed back to the Game Pool
        uint256 fee = (amount * withdrawFee) / 100;
        uint256 sendAmt = amount - fee;

        // State updates
        withdrawnToday[user] += amount;
        registry.subtractBalances(user, amount, 0, 0, 0, 0);
        registry.addWithdrawal(user, amount);
        gamePoolBalance += fee;
        
        // Execute transfer
        require(usdtToken.transfer(user, sendAmt), "USDT Transfer failed");
        emit Withdraw(user, amount, fee, sendAmt, block.timestamp);
    }

    /* =============================================================
                        POOL DEDUCTIONS (ENGINE ONLY)
    ============================================================= */

    function deductProtectionPool(uint256 amount) external override onlyEngines {
        require(protectionPoolBalance >= amount, "Insufficient Protection Pool liquidity");
        protectionPoolBalance -= amount;
    }

    function deductClubPool(uint256 amount) external override onlyEngines {
        require(clubPoolBalance >= amount, "Insufficient Club Pool liquidity");
        clubPoolBalance -= amount;
    }

    function claimClubPool() external override onlyEngines {
        uint256 amount = clubPoolBalance;
        require(amount > 0, "Club Pool is empty");
        clubPoolBalance = 0;
        require(usdtToken.transfer(fewWallet, amount), "USDT Transfer failed");
    }

    function deductLuckyPool(uint256 amount, uint8 drawType) external override onlyEngines {
        if (drawType == 1) {
            require(goldenDrawBalance >= amount, "Insufficient Golden Pool liquidity");
            goldenDrawBalance -= amount;
        } else {
            require(silverDrawBalance >= amount, "Insufficient Silver Pool liquidity");
            silverDrawBalance -= amount;
        }
    }

    /**
     * @dev Distributes Lucky Draw ticket proceeds:
     * 70% Users (Lucky Draw Pool), 10% DB Wallet (BD), 10% Game Pool, 5% FEW, 5% Creator
     */
    function distributeLuckyDrawFunds(uint256 amount, uint8 drawType) external override onlyEngines {
        uint256 pool = (amount * 70) / 100;
        uint256 bdAmt = (amount * 10) / 100;
        uint256 gPool = (amount * 10) / 100;
        uint256 fewAmt = (amount * 5) / 100;
        uint256 creatorAmt = amount - pool - bdAmt - gPool - fewAmt;

        if (drawType == 1) {
            goldenDrawBalance += pool;
        } else {
            silverDrawBalance += pool;
        }
        gamePoolBalance += gPool;
        
        // Transfers for 10% BD, 5% FEW, 5% Creator
        if (creatorAmt > 0) {
            usdtToken.transfer(creatorWallet, creatorAmt);
            registry.recordExternalIncome(creatorWallet, creatorAmt, "Lucky Draw Creator Fee", "Main Wallet");
        }
        
        if (fewAmt > 0) {
            usdtToken.transfer(fewWallet, fewAmt);
            registry.recordExternalIncome(fewWallet, fewAmt, "Lucky Draw FEW Fee", "Main Wallet");
        }

        if (bdAmt > 0) {
            uint256 bdEach = bdAmt / 24;
            for (uint256 i = 0; i < 24; i++) {
                address bd = bdWallets[i];
                usdtToken.transfer(bd, bdEach);
                registry.recordExternalIncome(bd, bdEach, "Lucky Draw BD Fee", "Main Wallet");
            }
        }
    }

    function luckyDrawBalance(uint8 drawType) external view override returns (uint256) {
        return drawType == 1 ? goldenDrawBalance : silverDrawBalance;
    }
}