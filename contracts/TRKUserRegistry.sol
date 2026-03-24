// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./ITRKCore.sol";

contract TRKUserRegistry is Ownable, ITRKRegistry {
    uint256 public override totalUsers;
    uint256 public override totalVolume;
    uint256 public override totalWithdrawnGlobal;
    uint256 public userCounter;

    // Whitepaper Constants
    uint256 public constant SIGNUP_BONUS = 100e18;
    uint256 public constant BONUS_LIMIT = 100000;
    uint256 public constant ACTIVATION_DEADLINE = 30 days;
    uint256 public FULL_ACTIVATION_BRIDGE = 100e18;
    
    function setActivationBridge(uint256 amount) external onlyAuth {
        FULL_ACTIVATION_BRIDGE = amount;
    }

    mapping(address => User) private _users;
    mapping(address => bool) public isAuthorized;
    mapping(uint256 => address) public idToAddress;

    // Fix: Store list of referrals for frontend display
    mapping(address => address[]) public directReferralsList;
    
    // NEW: Random Referral Codes
    mapping(address => string) public userToCode;
    mapping(string => address) public codeToUser;
    
    // Character set for random codes (A-Z, 0-9) - avoiding ambiguous chars if desired, but 0-9 A-Z is standard
    bytes constant ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    modifier onlyAuth() {
        require(isAuthorized[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Register Admin as User #1
        userCounter++;
        totalUsers++;
        _users[msg.sender].userId = userCounter;
        _users[msg.sender].registrationTime = block.timestamp;
        _users[msg.sender].isRegistered = true;
        _users[msg.sender].isPracticePlayer = true;
        _users[msg.sender].practiceBalance = SIGNUP_BONUS;
        idToAddress[userCounter] = msg.sender;
        
        string memory code = _generateRandomCode(msg.sender, userCounter);
        userToCode[msg.sender] = code;
        codeToUser[code] = msg.sender;
    }

    function setAuthorization(address target, bool status) external onlyOwner {
        isAuthorized[target] = status;
    }

    /* =============================================================
                        CORE USER QUERIES
    ============================================================= */

    function users(address user) external view override returns (User memory) {
        User memory u = _users[user];
        
        // 30-Day Rule: If not activated with 10 USDT after 30 days, practice balance is forfeit.
        // basicActivation = 10e18
        if (u.registrationTime > 0 && block.timestamp > u.registrationTime + ACTIVATION_DEADLINE && u.cumulativeDeposit < 10e18) {
            u.practiceBalance = 0;
            u.isPracticePlayer = false;
        }
        return u;
    }

    /* =============================================================
                        REGISTRATION & PRACTICE REWARDS
    ============================================================= */

    function registerUser(address user, address referrer, uint256 bonus) external override onlyAuth returns (uint256) {
        require(!_users[user].isRegistered, "Already registered");
        
        userCounter++;
        totalUsers++;

        User storage u = _users[user];
        u.userId = userCounter;
        u.referrer = referrer;
        
        // Generate Random Code
        string memory code = _generateRandomCode(user, userCounter);
        userToCode[user] = code;
        codeToUser[code] = user;

        u.registrationTime = block.timestamp;
        u.isRegistered = true;
        u.isPracticePlayer = true;
        u.practiceBalance = bonus;

        idToAddress[userCounter] = user;

        if (referrer != address(0)) {
            _users[referrer].directReferrals++;
            directReferralsList[referrer].push(user); // Fix: Add to list
            if (bonus > 0) {
                _distributePracticeReferral(user);
            }
        }

        emit UserRegistered(user, referrer, userCounter);
        return userCounter;
    }


    function _distributePracticeReferral(address newParticipant) internal {
        address current = _users[newParticipant].referrer;
        
        // Distribute strictly to 100 levels as per the whitepaper
        for (uint256 i = 0; i < 100 && current != address(0); i++) {
            uint256 reward;
            
            if (i == 0) reward = 10e18;                // Level 1: 10 USDT
            else if (i < 5) reward = 2e18;             // Level 2-5: 2 USDT (i=1,2,3,4)
            else if (i < 10) reward = 1e18;            // Level 6-10: 1 USDT
            else if (i < 15) reward = 0.5e18;          // Level 11-15: 0.5 USDT
            else if (i < 50) reward = 0.25e18;         // Level 16-50: 0.25 USDT
            else reward = 0.10e18;                     // Level 51-100: 0.10 USDT

            _users[current].practiceBalance += reward;
            _users[current].practiceReferralIncome += reward;
            if (i < 15) {
                _users[current].practiceReferralIncomeByLevel[i] += reward;
            }
            emit PracticeRewardReceived(current, newParticipant, reward, i + 1); // Emit 1-based level
            emit IncomeReceived(current, reward, "Practice Referral", "Practice", block.timestamp);
            
            current = _users[current].referrer;
        }
    }

    function triggerPracticeReferral(address user) external override onlyAuth {
        _distributePracticeReferral(user);
    }

    /* =============================================================
                        BALANCES & DEPOSITS
    ============================================================= */

    function updateBalances(address user, uint256 wallet, uint256 practice, uint256 cash) external override onlyAuth {
        _users[user].walletBalance = wallet;
        _users[user].practiceBalance = practice;
        _users[user].cashGameBalance = cash;
    }

    function addBalances(address user, uint256 wallet, uint256 practice, uint256 cash, uint256 winningDigit, bool isWinner) external override onlyAuth {
        _users[user].walletBalance += wallet;
        _users[user].practiceBalance += practice;
        if (isWinner && winningDigit <= 9) {
            _users[user].digitBalances[winningDigit] += cash;
        } else {
            _users[user].cashGameBalance += cash;
        }
    }

    function subtractBalances(address user, uint256 wallet, uint256 practice, uint256 cash, uint256 digit, uint256 digitAmount) external override onlyAuth {
        require(_users[user].walletBalance >= wallet, "Insufficient wallet balance");
        require(_users[user].practiceBalance >= practice, "Insufficient practice balance");
        require(_users[user].cashGameBalance >= cash, "Insufficient cash balance");
        if (digit <= 9) {
            require(_users[user].digitBalances[digit] >= digitAmount, "Insufficient digit balance");
            _users[user].digitBalances[digit] -= digitAmount;
        }
        
        _users[user].walletBalance -= wallet;
        _users[user].practiceBalance -= practice;
        _users[user].cashGameBalance -= cash;
    }

    function addDeposit(address user, uint256 amount) external override onlyAuth {
        User storage u = _users[user];
        bool wasBelowBridge = u.cumulativeDeposit < FULL_ACTIVATION_BRIDGE; // 100e18

        u.totalDeposit += amount;
        u.cumulativeDeposit += amount;
        u.isCashPlayer = true;
        u.cashGameBalance += amount; // Fix: Credit user wallet for betting
        totalVolume += amount;

        // NEW: Upgrade upline's active direct count if they crossed the 100 USDT threshold
        if (wasBelowBridge && u.cumulativeDeposit >= FULL_ACTIVATION_BRIDGE && u.referrer != address(0)) {
            _users[u.referrer].activeDirects++;
        }

        // Bridge to Cash logic... 
        // Only specific amount of practice balance converts to cash depending on direct referral income
        if (u.cumulativeDeposit >= FULL_ACTIVATION_BRIDGE && u.practiceBalance > 0) {
            _checkAndConvertPractice(user);
        }
    }

    // Mapping to track how much practice balance a user has converted
    mapping(address => uint256) public practiceConvertedToCash;

    // Call this specifically when directReferralIncome increases as well
    function checkAndConvertPractice(address user) external override onlyAuth {
        _checkAndConvertPractice(user);
    }



    function _checkAndConvertPractice(address user) internal {
        User storage u = _users[user];
        if (u.cumulativeDeposit >= FULL_ACTIVATION_BRIDGE && u.practiceBalance > 0) {
            // Only the direct referral component (Level 1) of the practice balance should convert
            uint256 level1PracticeIncome = u.practiceReferralIncomeByLevel[0];
            uint256 alreadyConverted = practiceConvertedToCash[user];
            
            if (level1PracticeIncome > alreadyConverted) {
                uint256 availableToConvert = level1PracticeIncome - alreadyConverted;
                if (availableToConvert > u.practiceBalance) {
                    availableToConvert = u.practiceBalance;
                }
                
                if (availableToConvert > 0) {
                    u.practiceBalance -= availableToConvert;
                    u.cashGameBalance += availableToConvert;
                    practiceConvertedToCash[user] += availableToConvert;
                    emit PracticeConverted(user, availableToConvert, block.timestamp);
                    emit IncomeReceived(user, availableToConvert, "Practice Conversion", "Cash", block.timestamp);
                }
            }
        }
    }

    function addWithdrawal(address user, uint256 amount) external override onlyAuth {
        _users[user].totalWithdrawn += amount;
        totalWithdrawnGlobal += amount;
    }

    /* =============================================================
                        INCOME TRACKING
    ============================================================= */

    function addDirectReferralIncome(address user, uint256 amount, uint256 level) external override onlyAuth {
        _users[user].directReferralIncome += amount;
        if(level < 15) _users[user].directReferralIncomeByLevel[level] += amount;
        _users[user].walletBalance += amount;
        _checkAndConvertPractice(user);
        emit IncomeReceived(user, amount, "Direct Referral", "Main", block.timestamp);
    }

    function addWinnerReferralIncome(address user, uint256 amount, uint256 level) external override onlyAuth {
        _users[user].winnerReferralIncome += amount;
        if(level < 15) _users[user].winnerReferralIncomeByLevel[level] += amount;
        _users[user].walletBalance += amount;
        emit IncomeReceived(user, amount, "Winner Referral", "Main", block.timestamp);
    }

    function addPracticeReferralIncome(address user, uint256 amount, uint256 level) external override onlyAuth {
        // Fallback for custom routing injections
        _users[user].practiceReferralIncome += amount;
        if(level < 15) _users[user].practiceReferralIncomeByLevel[level] += amount;
        _users[user].practiceBalance += amount;
        emit IncomeReceived(user, amount, "Practice Game Referral", "Practice", block.timestamp);
    }

    function addLossReferralIncome(address user, uint256 amount) external override onlyAuth {
        _users[user].lossReferralIncome += amount;
        _users[user].walletBalance += amount;
        emit IncomeReceived(user, amount, "Loss Referral", "Main", block.timestamp);
    }

    function addCashbackIncome(address user, uint256 amount) external override onlyAuth {
        _users[user].cashbackIncome += amount;
        _users[user].cashGameBalance += amount;
        emit IncomeReceived(user, amount, "Daily Cashback", "Game", block.timestamp);
    }

    function addClubIncome(address user, uint256 amount) external override onlyAuth {
        _users[user].clubIncome += amount;
        _users[user].walletBalance += amount;
        emit IncomeReceived(user, amount, "Club Income", "Main", block.timestamp);
    }

    function addLuckyDrawIncome(address user, uint256 amount) external override onlyAuth {
        _users[user].luckyDrawIncome += amount;
        _users[user].walletBalance += amount;
        emit IncomeReceived(user, amount, "Lucky Draw Prize", "Main", block.timestamp);
    }

    function incrementTeamVolume(address user, uint256 amount) external override onlyAuth {
        _users[user].teamVolume += amount;
    }

    function addLuckyDrawWallet(address user, uint256 amount) external override onlyAuth {
        _users[user].luckyDrawWallet += amount;
        _users[user].luckyDrawIncome += amount; // Track lifetime
    }

    function deductLuckyDrawWallet(address user, uint256 amount) external override onlyAuth {
        require(_users[user].luckyDrawWallet >= amount, "Insufficient lucky wallet");
        _users[user].luckyDrawWallet -= amount;
    }

    function setLuckyDrawPreference(address user, uint8 drawType) external override onlyAuth {
        require(drawType <= 1, "Invalid draw type");
        _users[user].preferredLuckyDraw = drawType;
    }

    /* =============================================================
                        GAME STATISTICS
    ============================================================= */

    function addGameStats(address user, bool isCash, uint256 betAmount, uint256 winAmount, bool isLoss) external override onlyAuth {
        User storage u = _users[user];
        uint256 today = block.timestamp / 1 days;
        
        if (u.lastGameDate < today) {
            u.practiceGamesPlayedToday = 0;
            u.cashGamesPlayedToday = 0;
            u.lastGameDate = today;
        }

        if (betAmount > 0) {
            u.totalBets += betAmount;
            if (isCash) {
                u.cashGamesPlayedToday++;
                // Balance subtraction now handled by explicit subtractBalances calls in Router/Engine for better control
            } else {
                u.practiceGamesPlayedToday++;
                u.practiceBalance -= betAmount;
            }
        }

        if (winAmount > 0) {
            u.totalWins += winAmount;
            string memory walletType = isCash ? "Main/Game" : "Practice";
            emit IncomeReceived(user, winAmount, isCash ? "Cash Game Win" : "Practice Game Win", walletType, block.timestamp);
        }

        if (isLoss) {
            u.totalLosses++;
        }
    }

    function recordExternalIncome(address user, uint256 amount, string calldata source, string calldata walletType) external override onlyAuth {
        emit IncomeReceived(user, amount, source, walletType, block.timestamp);
    }

    function ownerActivateUser(address user) external override onlyAuth {
        _users[user].isCashPlayer = true;
    }

    function unpruneUser(address user) external override onlyAuth {
        _users[user].registrationTime = block.timestamp;
    }

    function _generateRandomCode(address user, uint256 seed) internal view returns (string memory) {
        // Simple pseudo-random for unique 5-char code
        // We retry if collision (unlikely with 36^5 = 60M combinations for small user base)
        // But in Solidity we can't easily loop-check in view without gas cost. 
        // We will just derive deterministically and hope for best or add collision handling in write function?
        // Actually, since this is called in 'registerUser' (Write), we can check uniqueness.
        
        uint256 attempts = 0;
        string memory code;
        bool exists = true;
        
        while(exists && attempts < 5) {
            bytes memory buffer = new bytes(5);
            uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, user, seed, attempts)));
            
            for (uint256 i = 0; i < 5; i++) {
                buffer[i] = ALPHANUMERIC[random % 36];
                random /= 36;
            }
            code = string(abi.encodePacked("TRK", buffer));
            
            if (codeToUser[code] == address(0)) {
                exists = false;
            }
            attempts++;
        }
        
        require(!exists, "Failed to generate unique code");
        return code;
    }
}