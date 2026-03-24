// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITRKCore.sol";

interface ITRKGameEngineQuery {
    function getAndMarkLossBet(address user, uint256 roundId, bool isCashGame) external returns (uint256);
}

contract TRKGameEngine is Ownable, ITRKGameEngine, ITRKGameEngineQuery {
    ITRKRegistry public registry;
    address public router;
    address public cashbackEngine;

    // Whitepaper Multipliers: 8X total return for winners (2X Cashout, 6X Reinvest)
    // Dynamic Multipliers & Limits
    uint256 public winCashoutMult = 2;
    uint256 public winReinvestMult = 6;
    uint256 public practiceLimit = 24;
    uint256 public cashLimit = 24;

    uint256[15] public winnerReferralPercents = [
        uint256(500), 200, 100, 100, 100, 
        50, 50, 50, 50, 50, 
        50, 50, 50, 50, 50
    ];

    function setGameSettings(
        uint256 _winCashout,
        uint256 _winReinvest,
        uint256 _practiceLimit,
        uint256 _cashLimit
    ) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        winCashoutMult = _winCashout;
        winReinvestMult = _winReinvest;
        practiceLimit = _practiceLimit;
        cashLimit = _cashLimit;
    }

    function setWinnerReferralPercents(uint256[15] calldata _percents) external {
        require(msg.sender == owner() || msg.sender == router, "Only owner or router");
        winnerReferralPercents = _percents;
    }

    struct Round { 
        uint256 roundId; 
        uint256 winningNumber; 
        bool isClosed; 
        bool isCash; 
    }
    
    struct Bet { 
        uint256 amount; 
        bool claimed; 
        // Prediction is now the key in the mapping
    }

    uint256 public currentPracticeRoundId = 1;
    uint256 public currentCashRoundId = 1;

    mapping(uint256 => Round) public practiceRounds;
    mapping(uint256 => Round) public cashRounds;

    // user -> roundId -> prediction -> Bet struct
    mapping(address => mapping(uint256 => mapping(uint256 => Bet))) public cashBets;
    mapping(address => mapping(uint256 => mapping(uint256 => Bet))) public practiceBets;
    
    // Analytics Tracking
    // RoundId -> Prediction(0-9) -> Total USDT
    mapping(uint256 => mapping(uint256 => uint256)) public practiceBetTotalsByNumber;
    mapping(uint256 => mapping(uint256 => uint256)) public cashBetTotalsByNumber;
    
    // RoundId -> Prediction(0-9) -> Array of betters
    mapping(uint256 => mapping(uint256 => address[])) public practiceBettersByNumber;
    mapping(uint256 => mapping(uint256 => address[])) public cashBettersByNumber;

    // RoundId -> Array of winners
    mapping(uint256 => address[]) public practiceRoundWinners;
    mapping(uint256 => address[]) public cashRoundWinners;

    modifier onlyRouter() {
        require(msg.sender == router, "Only router");
        _;
    }

    modifier onlyCashbackEngine() {
        require(msg.sender == cashbackEngine, "Only cashback engine");
        _;
    }

    constructor(address _registry) Ownable(msg.sender) {
        registry = ITRKRegistry(_registry);
        _initRound(1, false);
        _initRound(1, true);
    }

    function setAddresses(address _router, address _cashbackEngine) external onlyOwner {
        router = _router;
        cashbackEngine = _cashbackEngine;
    }

    /* =============================================================
                        ROUND INITIALIZATION
    ============================================================= */

    function _initRound(uint256 id, bool isCash) private {
        Round memory r = Round({ 
            roundId: id, 
            winningNumber: 0, 
            isClosed: false, 
            isCash: isCash 
        });
        if (isCash) cashRounds[id] = r;
        else practiceRounds[id] = r;
    }

    /* =============================================================
                            BET PLACEMENT
    ============================================================= */

    function betCash(address user, uint256 prediction, uint256 amount) external override onlyRouter {
        _placeBet(user, prediction, amount, true);
    }

    function betPractice(address user, uint256 prediction, uint256 amount) external override onlyRouter {
        _placeBet(user, prediction, amount, false);
    }

    function _placeBet(address user, uint256 prediction, uint256 amount, bool isCash) private {
        require(prediction <= 9, "Invalid prediction");
        ITRKRegistry.User memory u = registry.users(user);
        uint256 roundId = isCash ? currentCashRoundId : currentPracticeRoundId;

        if (isCash) {
            require(u.isCashPlayer, "Not activated");
            require(u.cashGamesPlayedToday < cashLimit, "Daily limit reached");
            
            uint256 fromDigit = 0;
            uint256 fromCash = 0;
            
            if (u.digitBalances[prediction] >= amount) {
                fromDigit = amount;
            } else {
                fromDigit = u.digitBalances[prediction];
                fromCash = amount - fromDigit;
                require(u.cashGameBalance >= fromCash, "Insufficient cash game balance");
            }
            
            Bet storage b = cashBets[user][roundId][prediction];
            if (b.amount > 0) {
                b.amount += amount;
            } else {
                cashBets[user][roundId][prediction] = Bet({ amount: amount, claimed: false });
                cashBettersByNumber[roundId][prediction].push(user);
            }
            cashBetTotalsByNumber[roundId][prediction] += amount;
            
            // Deduct balance: Use prediction-specific balance and/or general cash balance
            registry.subtractBalances(user, 0, 0, fromCash, prediction, fromDigit);
        } else {
            require(u.isPracticePlayer, "Not a practice player");
            require(u.isCashPlayer || block.timestamp <= u.registrationTime + 30 days, "Practice account expired");
            require(u.practiceGamesPlayedToday < practiceLimit, "Daily limit reached");
            require(u.practiceBalance >= amount, "Insufficient practice balance");

            Bet storage b = practiceBets[user][roundId][prediction];
            if (b.amount > 0) {
                b.amount += amount;
            } else {
                practiceBets[user][roundId][prediction] = Bet({ amount: amount, claimed: false });
                practiceBettersByNumber[roundId][prediction].push(user);
            }
            practiceBetTotalsByNumber[roundId][prediction] += amount;
        }

        // Update games played stats in the Registry
        registry.addGameStats(user, isCash, amount, 0, false);
        emit BetPlaced(user, amount, prediction, isCash, roundId);
    }

    /* =============================================================
                            WIN CLAIMS
    ============================================================= */

    function claimWinnings(address user, uint256 roundId, bool isCashGame) external override onlyRouter returns (uint256) {
        Round storage round = isCashGame ? cashRounds[roundId] : practiceRounds[roundId];
        require(round.isClosed, "Round is still open");

        // User must claim the winning number specifically
        uint256 winningNum = round.winningNumber;
        Bet storage bet = isCashGame ? cashBets[user][roundId][winningNum] : practiceBets[user][roundId][winningNum];

        require(bet.amount > 0 && !bet.claimed, "No winning bet or already claimed");

        bet.claimed = true;
        uint256 payout;

        if (isCashGame) {
            // Return: Split into Cashout and Reinvest (For Cash Games: 2x, 6x = 8x total)
            uint256 cashout = bet.amount * winCashoutMult;
            uint256 reinvest = bet.amount * winReinvestMult;
            payout = cashout + reinvest;

            registry.addBalances(user, cashout, 0, reinvest, winningNum, true);
            
            // 5% of the cashout amount (2X) is distributed to Level 1, etc.
            _distributeWinnerReferrals(user, bet.amount * winCashoutMult);
            // Add win amount to user stats (cashout + reinvest)
            registry.addGameStats(user, isCashGame, 0, payout, false);
        } else {
            uint256 userId = registry.users(user).userId;
            uint256 pMult = userId <= 10000 ? 8 : 4;
            payout = bet.amount * pMult;
            
            registry.addBalances(user, 0, payout, 0, 0, false);
            _distributePracticeReferrals(user, bet.amount);
            registry.addGameStats(user, isCashGame, 0, payout, false);
        }
        emit GameWon(user, payout, isCashGame, roundId);
        return payout;
    }

    /* =============================================================
                    CROSS-CONTRACT: LOSS VERIFICATION
    ============================================================= */

    // Called by Cashback Engine to verify and claim losses across ALL non-winning numbers
    function getAndMarkLossBet(address user, uint256 roundId, bool isCashGame) external override onlyCashbackEngine returns (uint256) {
        Round storage round = isCashGame ? cashRounds[roundId] : practiceRounds[roundId];
        require(round.isClosed, "Round is still open");

        uint256 totalLoss = 0;
        bool foundLoss = false;

        for (uint256 i = 0; i <= 9; i++) {
            // Skip the winning number (cannot claim loss on a win)
            if (i == round.winningNumber) continue;

            Bet storage bet = isCashGame ? cashBets[user][roundId][i] : practiceBets[user][roundId][i];
            
            if (bet.amount > 0 && !bet.claimed) {
                bet.claimed = true;
                totalLoss += bet.amount;
                foundLoss = true;
            }
        }

        require(foundLoss, "No unclaimed losses found for this round");
        
        // Update user's loss statistics in the Registry
        registry.addGameStats(user, isCashGame, 0, 0, true);

        return totalLoss;
    }

    /* =============================================================
                        FRONTEND HELPERS
    ============================================================= */

    // Returns array of 10 bet amounts corresponding to predictions 0-9
    function getUserRoundBets(address user, uint256 roundId, bool isCashGame) external view returns (uint256[10] memory amounts, bool[10] memory claimed, bool[10] memory hasBet) {
        for (uint256 i = 0; i <= 9; i++) {
            Bet storage b = isCashGame ? cashBets[user][roundId][i] : practiceBets[user][roundId][i];
            amounts[i] = b.amount;
            claimed[i] = b.claimed;
            hasBet[i] = b.amount > 0;
        }
    }

    function getRoundWinners(uint256 roundId, bool isCash) external view override returns (address[] memory) {
        return isCash ? cashRoundWinners[roundId] : practiceRoundWinners[roundId];
    }

    function getBetTotal(uint256 roundId, uint256 number, bool isCash) external view override returns (uint256) {
        return isCash ? cashBetTotalsByNumber[roundId][number] : practiceBetTotalsByNumber[roundId][number];
    }

    function getBetters(uint256 roundId, uint256 number, bool isCash) external view override returns (address[] memory) {
        return isCash ? cashBettersByNumber[roundId][number] : practiceBettersByNumber[roundId][number];
    }

    /* =============================================================
                        REFERRAL DISTRIBUTIONS
    ============================================================= */

    function _distributeWinnerReferrals(address winner, uint256 amount) private {
        address current = registry.users(winner).referrer;
        uint256 levelsPaid = 0;
        
        while (levelsPaid < 15 && current != address(0)) {
            ITRKRegistry.User memory upline = registry.users(current);
            
            // 30-Day Rule: If not activated with 10 USDT in 30 days, skip and compress
            if (block.timestamp > upline.registrationTime + 30 days && upline.cumulativeDeposit < 10e18) {
                current = upline.referrer;
                continue; // Compress structure
            }

            // Tiered Unlock Logic
            bool unlocked = false;
            if (upline.cumulativeDeposit >= 10e18) { // basicActivation = 10
                if (levelsPaid < 3) {
                    unlocked = true; // First 3 levels unlocked at 10 USDT
                } else if (upline.cumulativeDeposit >= 100e18) { // proActivation = 100
                    uint256 requiredDirects = levelsPaid >= 10 ? 10 : levelsPaid;
                    if (upline.activeDirects >= requiredDirects) {
                        unlocked = true;
                    }
                }
            }

            if (upline.isCashPlayer && unlocked) {
                uint256 comm = (amount * winnerReferralPercents[levelsPaid]) / 10000;
                registry.addWinnerReferralIncome(current, comm, levelsPaid);
            }
            
            current = upline.referrer;
            levelsPaid++;
        }
    }

    function _distributePracticeReferrals(address winner, uint256 amount) private {
        address current = registry.users(winner).referrer;
        
        for (uint256 i = 0; i < 15 && current != address(0); i++) {
            // Practice Rewards are 'Always Active' - no isCashPlayer or activeDirects checks
            uint256 comm = (amount * winnerReferralPercents[i]) / 10000;
            registry.addPracticeReferralIncome(current, comm, i);
            
            current = registry.users(current).referrer;
        }
    }

    /* =============================================================
                            ADMIN ACTIONS
    ============================================================= */

    function closeRound(uint256 winningNumber, bool isCashGame) external override onlyRouter {
        require(winningNumber <= 9, "Invalid winning number");
        
        if (isCashGame) {
            cashRounds[currentCashRoundId].winningNumber = winningNumber;
            cashRounds[currentCashRoundId].isClosed = true;
            // Record winners for analytics
            address[] memory betters = cashBettersByNumber[currentCashRoundId][winningNumber];
            for(uint i = 0; i < betters.length; i++) {
                cashRoundWinners[currentCashRoundId].push(betters[i]);
            }
            currentCashRoundId++;
            _initRound(currentCashRoundId, true);
        } else {
            practiceRounds[currentPracticeRoundId].winningNumber = winningNumber;
            practiceRounds[currentPracticeRoundId].isClosed = true;
            // Record winners for analytics
            address[] memory betters = practiceBettersByNumber[currentPracticeRoundId][winningNumber];
            for(uint i = 0; i < betters.length; i++) {
                practiceRoundWinners[currentPracticeRoundId].push(betters[i]);
            }
            currentPracticeRoundId++;
            _initRound(currentPracticeRoundId, false);
        }
        emit RoundClosed(currentPracticeRoundId - 1, winningNumber, isCashGame);
    }

}