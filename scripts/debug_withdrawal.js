const hre = require("hardhat");

async function main() {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    
    // Load Addresses (Updated from recent deploy)
    // We can import from config or just hardcode/fetch dynamically
    // For reliability in this script, let's fetch from the artifact or usage
    
    // MOCK ADDRESSES FROM LATEST DEPLOY (Step 1136)
    const USDT_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const TREASURY_ADDR = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
    const ROUTER_ADDR = '0x0165878A594ca255338adfa4d48449f69242Eb8F';
    const REGISTRY_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

    const usdt = await ethers.getContractAt("MockUSDT", USDT_ADDR);
    const treasury = await ethers.getContractAt("TRKTreasury", TREASURY_ADDR);
    const router = await ethers.getContractAt("TRKRouter", ROUTER_ADDR);
    const registry = await ethers.getContractAt("TRKUserRegistry", REGISTRY_ADDR);

    console.log(`\n--- Debugging Withdrawal ---`);
    console.log(`User: ${deployer.address}`);

    // 1. Check Treasury Balance
    const treasuryBal = await usdt.balanceOf(TREASURY_ADDR);
    console.log(`Treasury USDT Balance: ${ethers.formatEther(treasuryBal)}`);

    // 2. Check User Balances via Registry
    const userInfo = await registry.users(deployer.address);
    console.log(`User Info:
    - Registered: ${userInfo.isRegistered}
    - Wallet Balance: ${ethers.formatEther(userInfo.walletBalance)} (Withdrawable)
    - Practice Balance: ${ethers.formatEther(userInfo.practiceBalance)}
    - Cash Game Balance: ${ethers.formatEther(userInfo.cashGameBalance)}
    `);

    // 3. Try to Withdraw 5 USDT
    const withdrawAmount = ethers.parseEther("5.0");
    
    if (userInfo.walletBalance < withdrawAmount) {
        console.log("❌ User has insufficient wallet balance to test withdrawal.");
        
        // Let's force-feed the user some wallet balance for testing if possible
        // (Only via engines/referrals usually, but we are admin/owner of Registry?)
        console.log("Attempting to credit user via 'addClubIncome' (Owner Only) to simulate earnings...");
        // Registry.addClubIncome IS protected by onlyAuth (which includes owner if logic allows, or onlyEngines?)
        // TRKUserRegistry.sol: modifier onlyAuth() { require(isAuthorized[msg.sender] || msg.sender == owner(), "Not authorized"); _; }
        // YES, Owner can call it.
        try {
            await registry.addClubIncome(deployer.address, ethers.parseEther("10.0"));
            console.log("✅ Credited 10 USDT to wallet balance for testing.");
        } catch (e) {
            console.error("❌ Failed to credit user:", e.message);
        }
    }

    // 4. Try withdrawal again
    console.log(`\nAttempting Router.withdraw(5.0)...`);
    try {
        const tx = await router.withdraw(withdrawAmount);
        const receipt = await tx.wait();
        console.log(`✅ Withdrawal Successful! Gas Used: ${receipt.gasUsed}`);
    } catch (e) {
        console.error(`❌ Withdrawal Failed:`);
        if (e.reason) console.error("Reason:", e.reason);
        else console.error(e.message);
        
        // Common checks
        if(treasuryBal < withdrawAmount) console.log("⚠️  HINT: Treasury has insufficient funds!");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
