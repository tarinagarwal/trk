// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol"; // NEW: Import Ownable
import "./ITRKCore.sol";

contract TRKRouter is Ownable { // NEW: Inherit Ownable
    ITRKRegistry public registry;
    ITRKTreasury public treasury;
    ITRKGameEngine public game;
    ITRKCashbackEngine public cashback;
    ITRKLuckyDraw public lucky;

    struct Distribution {
        uint256 roundId;
        address winner;
        uint256 payout;
        bool isCashGame;
        uint256 timestamp;
    }

    Distribution[] public distributionHistory;

    // Dynamic Settings (Override constants if non-zero)
    uint256 public minActivation = 1e18;
    uint256 public signupBonusTier1 = 100e18;
    uint256 public tier1Limit = 10000;
    uint256 public signupBonusTier2 = 10e18;
    uint256 public tier2Limit = 100000;
    
    uint256 public minReferral = 0; // Min Ref Payout
    uint256 public practiceGamesPerDay = 24;
    uint256 public cashGamesPerDay = 24;

    // NEW: Pass msg.sender to Ownable constructor
    constructor(
        address _registry,
        address _treasury,
        address _game,
        address _cashback,
        address _lucky
    ) Ownable(msg.sender) { 
        registry = ITRKRegistry(_registry);
        treasury = ITRKTreasury(_treasury);
        game = ITRKGameEngine(_game);
        cashback = ITRKCashbackEngine(_cashback);
        lucky = ITRKLuckyDraw(_lucky);
    }

    function getDistributionHistoryCount() external view returns (uint256) {
        return distributionHistory.length;
    }

    function getDistributionHistory(uint256 offset, uint256 limit) external view returns (Distribution[] memory) {
        uint256 total = distributionHistory.length;
        if (offset >= total) return new Distribution[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 size = end - offset;
        Distribution[] memory out = new Distribution[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = distributionHistory[total - 1 - (offset + i)]; 
        }
        return out;
    }

    function _recordDistribution(uint256 roundId, address winner, uint256 payout, bool isCashGame) internal {
        distributionHistory.push(Distribution({
            roundId: roundId,
            winner: winner,
            payout: payout,
            isCashGame: isCashGame,
            timestamp: block.timestamp
        }));
    }

    /* =============================================================
                        ADMIN SETTINGS
    ============================================================= */

    function updateSettings(
        uint256 _minA,
        uint256 _b1,
        uint256 _l1,
        uint256 _b2,
        uint256 _l2,
        uint256 _minRef,
        uint256 _pGames,
        uint256 _cGames,
        uint256 _fullBridge
    ) external onlyOwner {
        minActivation = _minA;
        // Sync minActivation to treasury
        treasury.setTreasurySettings(_minA, treasury.minWithdrawal(), treasury.maxDailyWithdrawal(), treasury.withdrawFee());

        signupBonusTier1 = _b1;
        tier1Limit = _l1;
        signupBonusTier2 = _b2;
        tier2Limit = _l2;
        minReferral = _minRef;
        practiceGamesPerDay = _pGames;
        cashGamesPerDay = _cGames;
        
        registry.setActivationBridge(_fullBridge);
        
        game.setGameSettings(2, 6, _pGames, _cGames);
    }

    function setTreasurySettings(uint256 _minA, uint256 _minW, uint256 _maxW, uint256 _fee) external onlyOwner {
        treasury.setTreasurySettings(_minA, _minW, _maxW, _fee);
    }

    function setDistributions(uint256 _c, uint256 _b, uint256 _f, uint256 _r, uint256 _cl, uint256 _l, uint256 _p) external onlyOwner {
        treasury.setDistributions(_c, _b, _f, _r, _cl, _l, _p);
    }

    function setReferralPercents(uint256[15] calldata _p) external onlyOwner {
        treasury.setReferralPercents(_p);
    }

    function setCashbackSettings(uint256 _lc, uint256 _lr, uint256 _t, uint256 _ls, uint256 _rr, uint256 _md) external onlyOwner {
        cashback.setCashbackSettings(_lc, _lr, _t, _ls, _rr, _md);
    }

    function setRoiPercents(uint256[15] calldata _p) external onlyOwner {
        cashback.setRoiPercents(_p);
    }

    function setCashbackPhases(ITRKCashbackEngine.Phase[3] calldata _phases) external onlyOwner {
        cashback.setCashbackPhases(_phases);
    }

    function setCapMultipliersBefore10k(ITRKCashbackEngine.Cap[4] calldata _caps) external onlyOwner {
        cashback.setCapMultipliersBefore10k(_caps);
    }

    function setCapMultipliersAfter10k(ITRKCashbackEngine.Cap[4] calldata _caps) external onlyOwner {
        cashback.setCapMultipliersAfter10k(_caps);
    }

    function setPhaseThreshold(uint256 _threshold) external onlyOwner {
        cashback.setPhaseThreshold(_threshold);
    }

    function setGameSettings(uint256 _wc, uint256 _wr, uint256 _pl, uint256 _cl) external onlyOwner {
        game.setGameSettings(_wc, _wr, _pl, _cl);
    }

    function setWinnerReferralPercents(uint256[15] calldata _p) external onlyOwner {
        game.setWinnerReferralPercents(_p);
    }

    function setLuckyDrawSettings(uint256 _mt, uint256 _gp, uint256 _sp) external onlyOwner {
        lucky.setLuckyDrawSettings(_mt, _gp, _sp);
    }

    function setLuckyPrizes(uint256[8] calldata _g, uint256[8] calldata _s, uint256[8] calldata _c) external onlyOwner {
        lucky.setPrizes(_g, _s, _c);
    }

    function updateWallets(
        address _creator,
        address _few,
        address[] calldata _bd
    ) external onlyOwner {
        treasury.updateWallets(_creator, _few, _bd);
    }

    function ownerActivateUser(address user) external onlyOwner {
        registry.ownerActivateUser(user);
    }

    function unpruneUser(address user) external onlyOwner {
        registry.unpruneUser(user);
    }

    /* =============================================================
                        REGISTRATION & DEPOSITS
    ============================================================= */

    function register(address referrer) external {
        uint256 totalUsers = registry.totalUsers();
        uint256 bonus = 0;
        if (totalUsers < tier1Limit) {
            bonus = signupBonusTier1;
        } else if (totalUsers < tier2Limit) {
            bonus = signupBonusTier2;
        }
        registry.registerUser(msg.sender, referrer, bonus);
    }

    function depositCashGame(uint256 amount) external {
        treasury.deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        treasury.withdraw(msg.sender, amount);
    }

    /* =============================================================
                        GAMEPLAY
    ============================================================= */

    function placeBetCash(uint256 prediction, uint256 amount) external {
        game.betCash(msg.sender, prediction, amount);
    }

    function placeBetPractice(uint256 prediction, uint256 amount) external {
        game.betPractice(msg.sender, prediction, amount);
    }

    function claimWinnings(uint256 roundId, bool isCashGame) external {
        uint256 payout = game.claimWinnings(msg.sender, roundId, isCashGame);
        _recordDistribution(roundId, msg.sender, payout, isCashGame);
    }

    /* =============================================================
                        CASHBACK & LOSS RECOVERY
    ============================================================= */

    function claimImmediateLoss(uint256 roundId, bool isCashGame) external {
        cashback.claimLoss(msg.sender, roundId, isCashGame);
    }

    function claimDailyCashback() external {
        cashback.claimDailyCashback(msg.sender);
    }

    /* =============================================================
                        LUCKY DRAW
    ============================================================= */

    function buyLuckyTickets(uint256 count, uint8 drawType) external {
        lucky.buyTicket(msg.sender, count, drawType);
    }

    // NEW: Allows users to manually buy tickets using their Internal Virtual Lucky Wallet
    function buyLuckyTicketsVirtual(uint256 count, uint8 drawType) external {
        lucky.buyTicketVirtual(msg.sender, count, drawType);
    }

    function setLuckyDrawPreference(uint8 drawType) external {
        registry.setLuckyDrawPreference(msg.sender, drawType);
    }

    /* =============================================================
                        BACKEND ORACLE (ADMIN)
    ============================================================= */

    function closeRound(uint256 winningNumber, bool isCashGame) external onlyOwner {
        game.closeRound(winningNumber, isCashGame);
    }

    // NEW: Backend Oracle Endpoint for Club Pool Distribution
    function distributeClubIncome(address[] calldata winners, uint256[] calldata amounts) external onlyOwner {
        require(winners.length == amounts.length, "Mismatched arrays");
        uint256 totalDistributed = 0;
        
        for(uint i = 0; i < winners.length; i++) {
            registry.addClubIncome(winners[i], amounts[i]);
            _recordDistribution(0, winners[i], amounts[i], true); // Record as Cash distribution
            totalDistributed += amounts[i];
        }
        
        // Deduct the distributed amount from the Treasury Club Pool
        treasury.deductClubPool(totalDistributed);
    }

    // Admin: Claim entire Club Pool balance → sends to FEW wallet
    function claimClubPool() external onlyOwner {
        treasury.claimClubPool();
    }

    // Admin: Force-execute the Lucky Draw NOW without needing 10k tickets (for demo/testnet)
    function adminTriggerLuckyDraw(uint8 drawType) external onlyOwner {
        lucky.forceExecuteDraw(drawType);
    }

    function setLuckyDrawManualWinners(uint8 drawType, address[] calldata winners) external onlyOwner {
        lucky.setManualWinners(drawType, winners);
    }

    /* =============================================================
                        VIEW FUNCTIONS FOR FRONTEND
    ============================================================= */

    function getUserInfo(address user) external view returns (ITRKRegistry.User memory) {
        return registry.users(user);
    }

    function directReferralsList(address user, uint256 index) external view returns (address) {
        return registry.directReferralsList(user, index);
    }

    // Proxy to Registry: converts address to TRK Code
    function addressToReferralCode(address user) external view returns (string memory) {
        return registry.userToCode(user);
    }

    // Proxy to Registry: converts TRK Code to address  
    function referralCodeToAddress(string calldata code) external view returns (address) {
        return registry.codeToUser(code);
    }

    // Proxy to Registry: userId → address (used by admin Users tab)
    function idToAddress(uint256 userId) external view returns (address) {
        return registry.idToAddress(userId);
    }

    // Platform-wide stats for admin Overview tab
    // Returns: (totalUsers, totalVolume, totalWithdrawnGlobal)
    function getPlatformStats() public view returns (uint256 users, uint256 volume, uint256 withdrawn) {
        return (registry.totalUsers(), registry.totalVolume(), registry.totalWithdrawnGlobal());
    }

    // Alias for frontend compatibility
    function getUserStats() external view returns (uint256 users, uint256 volume, uint256 withdrawn) {
        return getPlatformStats();
    }

    // Returns pool balances: [gamePool, clubPool, goldenLucky, silverLucky, protectionPool, creator, bd, few, referral]
    function getPools() external view returns (
        uint256 gamePool, 
        uint256 clubPool, 
        uint256 golden, 
        uint256 silver, 
        uint256 protection,
        uint256 creator,
        uint256 bd,
        uint256 few,
        uint256 referral
    ) {
        gamePool   = treasury.gamePoolBalance();
        clubPool   = treasury.clubPoolBalance();
        golden     = treasury.luckyDrawBalance(1);
        silver     = treasury.luckyDrawBalance(0);
        protection = treasury.protectionPoolBalance();
        creator    = treasury.totalCreatorVolume();
        bd         = treasury.totalBDVolume();
        few        = treasury.totalFEWVolume();
        referral   = treasury.totalReferralVolume();
    }

    function getSystemSettings() external view returns (
        uint256[11] memory treasuryParams, // minA, minW, maxW, fee, cP, bdP, fewP, refP, clubP, luckyP, protectP
        uint256[15] memory refPercents,
        uint256[6] memory cashbackParams, // lcBps, lrBps, threshold, luckyS, roiRatio, maxDaily
        uint256[15] memory roiPercents,
        uint256[4] memory gameParams, // wc, wr, pl, cl
        uint256[15] memory winRefPercents,
        uint256[3] memory luckyParams, // mt, gp, sp
        ITRKCashbackEngine.Cap[4] memory capsBefore,
        ITRKCashbackEngine.Cap[4] memory capsAfter,
        uint256 phaseThreshold
    ) {
        // Treasury
        treasuryParams[0] = treasury.minActivation();
        treasuryParams[1] = treasury.minWithdrawal();
        treasuryParams[2] = treasury.maxDailyWithdrawal();
        treasuryParams[3] = treasury.withdrawFee();
        treasuryParams[4] = treasury.creatorP();
        treasuryParams[5] = treasury.bdP();
        treasuryParams[6] = treasury.fewP();
        treasuryParams[7] = treasury.refP();
        treasuryParams[8] = treasury.clubP();
        treasuryParams[9] = treasury.luckyP();
        treasuryParams[10] = treasury.protectP();

        for(uint i=0; i<15; i++) refPercents[i] = treasury.referralPercents(i);

        // Cashback
        cashbackParams[0] = cashback.lossCashbackBps();
        cashbackParams[1] = cashback.lossReferralBps();
        cashbackParams[2] = cashback.dailyLossThreshold();
        cashbackParams[3] = cashback.luckySharePercent();
        cashbackParams[4] = cashback.roiPoolRatio();
        cashbackParams[5] = cashback.maxDailyCashback();

        for(uint i=0; i<15; i++) roiPercents[i] = cashback.roiPercents(i);

        // Game
        gameParams[0] = game.winCashoutMult();
        gameParams[1] = game.winReinvestMult();
        gameParams[2] = game.practiceLimit();
        gameParams[3] = game.cashLimit();

        for(uint i=0; i<15; i++) winRefPercents[i] = game.winnerReferralPercents(i);

        // Lucky
        luckyParams[0] = lucky.maxTickets();
        luckyParams[1] = lucky.goldenTicketPrice();
        luckyParams[2] = lucky.silverTicketPrice();

        for(uint i=0; i<4; i++) {
            (uint256 d1, uint256 m1) = cashback.capMultipliersBefore10k(i);
            capsBefore[i] = ITRKCashbackEngine.Cap(d1, m1);
            (uint256 d2, uint256 m2) = cashback.capMultipliersAfter10k(i);
            capsAfter[i] = ITRKCashbackEngine.Cap(d2, m2);
        }
        phaseThreshold = cashback.phaseThresholdUserCount();
    }

    function getAllSettings() external view returns (uint256[15] memory settings) {
        settings[0] = minActivation; 
        settings[1] = signupBonusTier1;
        settings[2] = tier1Limit;
        settings[3] = signupBonusTier2;
        settings[4] = tier2Limit;
        settings[5] = minReferral;
        settings[6] = practiceGamesPerDay;
        settings[7] = cashGamesPerDay;
        settings[8] = registry.FULL_ACTIVATION_BRIDGE();
        // Win multipliers (Total 8X default)
        settings[12] = game.winCashoutMult() + game.winReinvestMult(); 
        return settings;
    }

    // Proxy to Treasury: Get all wallets
    function getWallets() external view returns (address creator, address few, address[24] memory bd) {
        return treasury.getWallets();
    }

    // Live analytics proxies for the frontend
    function currentCashRoundId() external view returns (uint256) { return game.currentCashRoundId(); }
    function currentPracticeRoundId() external view returns (uint256) { return game.currentPracticeRoundId(); }

    function cashRoundWinners(uint256 roundId) external view returns (address[] memory) {
        return game.getRoundWinners(roundId, true);
    }
    function practiceRoundWinners(uint256 roundId) external view returns (address[] memory) {
        return game.getRoundWinners(roundId, false);
    }
    function cashBetTotalsByNumber(uint256 roundId, uint256 number) external view returns (uint256) {
        return game.getBetTotal(roundId, number, true);
    }
    function practiceBetTotalsByNumber(uint256 roundId, uint256 number) external view returns (uint256) {
        return game.getBetTotal(roundId, number, false);
    }
    function cashBettersByNumber(uint256 roundId, uint256 number) external view returns (address[] memory) {
        return game.getBetters(roundId, number, true);
    }
    function practiceBettersByNumber(uint256 roundId, uint256 number) external view returns (address[] memory) {
        return game.getBetters(roundId, number, false);
    }

    // Returns live Lucky Draw state for the frontend
    function getLuckyDrawStats(uint8 drawType) external view returns (
        uint256 drawId,
        uint256 ticketsSold,
        uint256 maxTickets,
        uint256 prizePoolBalance
    ) {
        drawId           = lucky.currentDrawId(drawType);
        ticketsSold      = lucky.ticketsSoldCurrentDraw(drawType);
        maxTickets       = lucky.MAX_TICKETS();
        prizePoolBalance = treasury.luckyDrawBalance(drawType);
    }

    function getLuckyDrawManualWinners(uint8 drawType) external view returns (address[] memory) {
        return lucky.getManualWinners(drawType);
    }

}