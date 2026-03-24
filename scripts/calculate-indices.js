const fs = require('fs');

// Based on ITRKCore.sol
const structDefinition = [
    { name: "userId", type: "uint256" }, // 0
    { name: "referrer", type: "address" }, // 1
    { name: "registrationTime", type: "uint256" }, // 2
    { name: "walletBalance", type: "uint256" }, // 3
    { name: "practiceBalance", type: "uint256" }, // 4
    { name: "cashGameBalance", type: "uint256" }, // 5
    { name: "totalDeposit", type: "uint256" }, // 6
    { name: "totalWithdrawn", type: "uint256" }, // 7
    { name: "cumulativeDeposit", type: "uint256" }, // 8
    { name: "directReferralIncome", type: "uint256" }, // 9
    { name: "winnerReferralIncome", type: "uint256" }, // 10
    { name: "practiceReferralIncome", type: "uint256" }, // 11
    { name: "cashbackIncome", type: "uint256" }, // 12
    { name: "lossReferralIncome", type: "uint256" }, // 13
    { name: "clubIncome", type: "uint256" }, // 14
    { name: "luckyDrawIncome", type: "uint256" }, // 15
    { name: "luckyDrawWallet", type: "uint256" }, // 16
    { name: "directReferralIncomeByLevel", type: "uint256[15]" }, // 17
    { name: "winnerReferralIncomeByLevel", type: "uint256[15]" }, // 18
    { name: "practiceReferralIncomeByLevel", type: "uint256[15]" }, // 19
    { name: "teamVolume", type: "uint256" }, // 20
    { name: "totalBets", type: "uint256" }, // 21
    { name: "totalWins", type: "uint256" }, // 22
    { name: "totalLosses", type: "uint256" }, // 23
    { name: "practiceGamesPlayedToday", type: "uint256" }, // 24
    { name: "cashGamesPlayedToday", type: "uint256" }, // 25
    { name: "lastGameDate", type: "uint256" }, // 26
    { name: "isRegistered", type: "bool" }, // 27
    { name: "isPracticePlayer", type: "bool" }, // 28
    { name: "isCashPlayer", type: "bool" }, // 29
    { name: "directReferrals", type: "uint256" }, // 30
    { name: "activeDirects", type: "uint256" } // 31
];

console.log("Calculated Indices based on ITRKCore.sol:");
structDefinition.forEach((field, index) => {
    console.log(`${index}: ${field.name} (${field.type})`);
});
