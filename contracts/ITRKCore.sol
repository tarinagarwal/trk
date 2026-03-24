// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITRKRegistry {
    struct User {
        uint256 userId;
        address referrer;
        uint256 registrationTime;

        uint256 walletBalance;
        uint256 practiceBalance;
        uint256 cashGameBalance;

        uint256 totalDeposit;
        uint256 totalWithdrawn;
        uint256 cumulativeDeposit;

        uint256 directReferralIncome;
        uint256 winnerReferralIncome;
        uint256 practiceReferralIncome;
        uint256 cashbackIncome;
        uint256 lossReferralIncome;
        uint256 clubIncome;
        uint256 luckyDrawIncome;
        uint256 luckyDrawWallet;

        uint256[15] directReferralIncomeByLevel;
        uint256[15] winnerReferralIncomeByLevel;
        uint256[15] practiceReferralIncomeByLevel;

        uint256[10] digitBalances; // 6X reinvestment locked to digits

        uint256 teamVolume;
        uint256 totalBets;
        uint256 totalWins;
        uint256 totalLosses;

        uint256 practiceGamesPlayedToday;
        uint256 cashGamesPlayedToday;
        uint256 lastGameDate;

        bool isRegistered;
        bool isPracticePlayer;
        bool isCashPlayer;

        uint256 directReferrals;
        uint256 activeDirects;
        uint8 preferredLuckyDraw; // 0 for Golden, 1 for Silver
    }

    event UserRegistered(address indexed user, address indexed referrer, uint256 userId);
    event PracticeRewardReceived(address indexed user, address indexed from, uint256 amount, uint256 level);
    event IncomeReceived(address indexed user, uint256 amount, string source, string walletType, uint256 timestamp);
    event PracticeConverted(address indexed user, uint256 amount, uint256 timestamp);

    function users(address user) external view returns (User memory);

    function userToCode(address user) external view returns (string memory);
    function codeToUser(string memory code) external view returns (address);
    function idToAddress(uint256 id) external view returns (address);
    function totalUsers() external view returns (uint256);
    function totalVolume() external view returns (uint256);
    function totalWithdrawnGlobal() external view returns (uint256);
    function directReferralsList(address user, uint256 index) external view returns (address);
    function FULL_ACTIVATION_BRIDGE() external view returns (uint256);
    function setActivationBridge(uint256 amount) external;
    
    function registerUser(address user, address referrer, uint256 bonus) external returns (uint256);
    function updateBalances(address user, uint256 wallet, uint256 practice, uint256 cash) external;
    function addBalances(address user, uint256 wallet, uint256 practice, uint256 cash, uint256 winningDigit, bool isWinner) external;
    function subtractBalances(address user, uint256 wallet, uint256 practice, uint256 cash, uint256 digit, uint256 digitAmount) external;
    function addDeposit(address user, uint256 amount) external;
    function addWithdrawal(address user, uint256 amount) external;
    function addDirectReferralIncome(address user, uint256 amount, uint256 level) external;
    function addWinnerReferralIncome(address user, uint256 amount, uint256 level) external;
    function addPracticeReferralIncome(address user, uint256 amount, uint256 level) external;
    function addLossReferralIncome(address user, uint256 amount) external;
    function addCashbackIncome(address user, uint256 amount) external;
    function addGameStats(address user, bool isCash, uint256 betAmount, uint256 winAmount, bool isLoss) external;
    function addClubIncome(address user, uint256 amount) external;
    function addLuckyDrawIncome(address user, uint256 amount) external;
    function incrementTeamVolume(address user, uint256 amount) external;
    function addLuckyDrawWallet(address user, uint256 amount) external;
    function deductLuckyDrawWallet(address user, uint256 amount) external;
    function setLuckyDrawPreference(address user, uint8 drawType) external;
    function recordExternalIncome(address user, uint256 amount, string calldata source, string calldata walletType) external;
    function ownerActivateUser(address user) external;
    function unpruneUser(address user) external;
    function triggerPracticeReferral(address user) external;
    function checkAndConvertPractice(address user) external;
}

interface ITRKTreasury {
    event Deposit(address indexed user, uint256 amount, uint256 creditedToCash, uint256 timestamp);
    event Withdraw(address indexed user, uint256 totalRequested, uint256 fee, uint256 amountSent, uint256 timestamp);

    function deposit(address user, uint256 amount) external;
    function withdraw(address user, uint256 amount) external;
    function deductProtectionPool(uint256 amount) external;
    function deductClubPool(uint256 amount) external;
    function claimClubPool() external;
    function deductLuckyPool(uint256 amount, uint8 drawType) external;
    function distributeLuckyDrawFunds(uint256 amount, uint8 drawType) external;

    function updateWallets(address _creator, address _few, address[] calldata _bd) external;
    function getWallets() external view returns (address creator, address few, address[24] memory bd);

    // Pool balance getters
    function gamePoolBalance() external view returns (uint256);
    function clubPoolBalance() external view returns (uint256);
    function luckyDrawBalance(uint8 drawType) external view returns (uint256);
    function protectionPoolBalance() external view returns (uint256);

    // Cumulative Volume Getters
    function totalCreatorVolume() external view returns (uint256);
    function totalBDVolume() external view returns (uint256);
    function totalFEWVolume() external view returns (uint256);
    function totalReferralVolume() external view returns (uint256);

    function setTreasurySettings(uint256 _minActivation, uint256 _minWithdrawal, uint256 _maxDailyWithdrawal, uint256 _withdrawFee) external;
    function setDistributions(uint256 _creator, uint256 _bd, uint256 _few, uint256 _ref, uint256 _club, uint256 _lucky, uint256 _protect) external;
    function setReferralPercents(uint256[15] calldata _percents) external;

    function minActivation() external view returns (uint256);
    function minWithdrawal() external view returns (uint256);
    function maxDailyWithdrawal() external view returns (uint256);
    function withdrawFee() external view returns (uint256);
    function creatorP() external view returns (uint256);
    function bdP() external view returns (uint256);
    function fewP() external view returns (uint256);
    function refP() external view returns (uint256);
    function clubP() external view returns (uint256);
    function luckyP() external view returns (uint256);
    function protectP() external view returns (uint256);
    function referralPercents(uint256 index) external view returns (uint256);
}

interface ITRKGameEngine {
    function betCash(address user, uint256 prediction, uint256 amount) external;
    function betPractice(address user, uint256 prediction, uint256 amount) external;
    function claimWinnings(address user, uint256 roundId, bool isCashGame) external returns (uint256);
    function closeRound(uint256 winningNumber, bool isCashGame) external;

    function currentCashRoundId() external view returns (uint256);
    function currentPracticeRoundId() external view returns (uint256);
    function getRoundWinners(uint256 roundId, bool isCash) external view returns (address[] memory);
    function getBetTotal(uint256 roundId, uint256 number, bool isCash) external view returns (uint256);
    function getBetters(uint256 roundId, uint256 number, bool isCash) external view returns (address[] memory);

    function setGameSettings(uint256 _winCashout, uint256 _winReinvest, uint256 _practiceLimit, uint256 _cashLimit) external;
    function setWinnerReferralPercents(uint256[15] calldata _percents) external;

    function winCashoutMult() external view returns (uint256);
    function winReinvestMult() external view returns (uint256);
    function practiceLimit() external view returns (uint256);
    function cashLimit() external view returns (uint256);
    function winnerReferralPercents(uint256 index) external view returns (uint256);

    event BetPlaced(address indexed user, uint256 amount, uint256 prediction, bool isCash, uint256 roundId);
    event GameWon(address indexed user, uint256 amount, bool isCash, uint256 roundId);
    event RoundClosed(uint256 indexed roundId, uint256 winningNumber, bool isCash);
}

interface ITRKCashbackEngine {
    function claimLoss(address user, uint256 roundId, bool isCashGame) external;
    function claimDailyCashback(address user) external;

    struct Phase { uint256 userLimit; uint256 rate; }
    struct Cap { uint256 directs; uint256 multiplier; }

    function setCashbackSettings(uint256 _lossCashBps, uint256 _lossRefBps, uint256 _threshold, uint256 _luckyShare, uint256 _roiRatio, uint256 _maxDaily) external;
    function setRoiPercents(uint256[15] calldata _percents) external;
    function setCashbackPhases(Phase[3] calldata _phases) external;
    function setCapMultipliersBefore10k(Cap[4] calldata _caps) external;
    function setCapMultipliersAfter10k(Cap[4] calldata _caps) external;
    function setPhaseThreshold(uint256 _threshold) external;

    function lossCashbackBps() external view returns (uint256);
    function lossReferralBps() external view returns (uint256);
    function dailyLossThreshold() external view returns (uint256);
    function luckySharePercent() external view returns (uint256);
    function roiPoolRatio() external view returns (uint256);
    function maxDailyCashback() external view returns (uint256);
    function roiPercents(uint256 index) external view returns (uint256);
    function capMultipliersBefore10k(uint256 index) external view returns (uint256 directs, uint256 multiplier);
    function capMultipliersAfter10k(uint256 index) external view returns (uint256 directs, uint256 multiplier);
    function phaseThresholdUserCount() external view returns (uint256);
}

interface ITRKLuckyDraw {
    function buyTicket(address user, uint256 count, uint8 drawType) external;
    function executeLuckyDraw(address[] calldata winners, uint256[] calldata amounts) external;
    function buyTicketVirtual(address user, uint256 count, uint8 drawType) external;
    function forceExecuteDraw(uint8 drawType) external;
    function setManualWinners(uint8 drawType, address[] calldata winners) external;
    function getManualWinners(uint8 drawType) external view returns (address[] memory);

    function setLuckyDrawSettings(uint256 _maxTickets, uint256 _goldenPrice, uint256 _silverPrice) external;
    function setPrizes(uint256[8] calldata _golden, uint256[8] calldata _silver, uint256[8] calldata _counts) external;

    function maxTickets() external view returns (uint256);
    function goldenTicketPrice() external view returns (uint256);
    function silverTicketPrice() external view returns (uint256);

    // Getters
    function currentDrawId(uint8 drawType) external view returns (uint256);
    function ticketsSoldCurrentDraw(uint8 drawType) external view returns (uint256);
    function MAX_TICKETS() external view returns (uint256);
}