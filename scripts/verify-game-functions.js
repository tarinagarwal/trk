const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const TARGET_ADDRESS = "0x5d45dd528e8fAD8B24b2e2657736c759730E7343";

async function main() {
    console.log("Connecting to BSC Mainnet...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Selectors
    const checks = {
        "currentCashRoundId()": "function currentCashRoundId() view returns (uint256)",
        "practiceBets(address,uint256)": "function practiceBets(address,uint256) view returns (address,uint256,uint256,bool)", // struct return might vary, just check existence
        "claimWinnings(uint256,bool)": "function claimWinnings(uint256,bool)", // write
        "claimLoss(uint256,bool)": "function claimLoss(uint256,bool)", // write - suspect this is missing
        "claimDailyCashback()": "function claimDailyCashback()", // write
    };

    const contract = new ethers.Contract(TARGET_ADDRESS, Object.values(checks), provider);

    console.log(`Verifying Game Features on ${TARGET_ADDRESS}...`);

    try {
        const id = await contract.currentCashRoundId();
        console.log(`✅ currentCashRoundId: ${id}`);
    } catch (e) { console.log(`❌ currentCashRoundId failed`); }

    // Check selectors for write functions
    const selClaimLoss = ethers.id("claimLoss(uint256,bool)").slice(0, 10);
    console.log(`Checking selector ${selClaimLoss} (claimLoss) ...`);
    try {
        await provider.call({ to: TARGET_ADDRESS, data: selClaimLoss });
        console.log("✅ claimLoss exists (reverted as expected)");
    } catch (e) {
        if (e.message.includes("execution reverted")) console.log("✅ claimLoss exists (reverted)");
        else console.log(`❌ claimLoss MISSING: ${e.shortMessage || e.message}`);
    }

}

main();
