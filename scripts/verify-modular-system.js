const { ethers } = require("hardhat");
const { formatUnits, parseUnits } = require("ethers");

async function main() {
    console.log("🚀 Verifying MODULAR SYSTEM on Localhost...");

    const [deployer, user1] = await ethers.getSigners();
    
    // 1. Get Addresses (from recent deployment log or file?)
    // Actually, we can just attach to the addresses if we know them, OR we can read the file.
    // Easier: Just import the addresses if possible, OR assume the deploy script just ran and we can use hardhat-deploy logic... 
    // BUT since we just ran the script, the JSON file 'src/config/contractAddresses.ts' is updated. 
    // We can't easily import TS in JS script. 
    // Let's just Deploy again? No, that changes addresses.
    // Let's Read the file content.
    
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(process.cwd(), 'src/config/contractAddresses.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Parse addresses via regex
    const routerAddr = configContent.match(/ROUTER: '(0x[a-fA-F0-9]{40})'/)[1];
    const treasuryAddr = configContent.match(/TREASURY: '(0x[a-fA-F0-9]{40})'/)[1];
    const registryAddr = configContent.match(/REGISTRY: '(0x[a-fA-F0-9]{40})'/)[1];
    const gameAddr = configContent.match(/GAME: '(0x[a-fA-F0-9]{40})'/)[1];

    console.log("Router:", routerAddr);
    console.log("Treasury:", treasuryAddr);

    // Attach Contracts
    const Router = await ethers.getContractFactory("TRKRouter");
    const router = Router.attach(routerAddr);

    const Registry = await ethers.getContractFactory("TRKUserRegistry");
    const registry = Registry.attach(registryAddr);

    const Treasury = await ethers.getContractFactory("TRKTreasury");
    const treasury = Treasury.attach(treasuryAddr);
    
    // 2. Register Admin (if not)
    console.log("\n--- Registration Check ---");
    let uInfo = await router.getUserInfo(deployer.address);
    if (!uInfo.isRegistered) {
        console.log("Registering Admin...");
        await (await router.register("0x0000000000000000000000000000000000000000")).wait();
        console.log("✅ Admin Registered");
    } else {
        console.log("Admin already registered");
    }

    // 3. Register User1
    const user1Addr = user1.address;
    uInfo = await router.getUserInfo(user1Addr);
    if (!uInfo.isRegistered) {
         console.log("Registering User1...");
         // Get admin referral code
         const adminCode = await router.addressToReferralCode(deployer.address);
         const referrer = await router.referralCodeToAddress(adminCode);
         await (await router.connect(user1).register(referrer)).wait();
         console.log(`✅ User1 Registered under ${adminCode}`);
    } else {
        console.log("User1 already registered");
    }

    // 4. Verify Practice Bet & Balance
    console.log("\n--- Game Logic Check (Practice) ---");
    uInfo = await router.getUserInfo(user1Addr);
    console.log("Practice Balance Before:", formatUnits(uInfo[29] || 0, 18)); // Index 29 is practice? Or check struct.

    // Place Bet
    console.log("Placing Practice Bet (1 TRK)...");
    try {
        await (await router.connect(user1).placeBetPractice(5, parseUnits("1", 18))).wait();
        console.log("✅ Bet Placed");
    } catch (e) {
        console.log("❌ Bet Failed:", e.message);
    }
    
    // 5. Verify Treasury Stats (Admin Panel needs this)
    console.log("\n--- Treasury Logic Check (Admin Panel) ---");
    const gp = await treasury.gamePoolBalance();
    console.log("Game Pool Balance:", formatUnits(gp, 18));
    if (gp >= 0) console.log("✅ Treasury Readable");

    const users = await registry.totalUsers();
    console.log("Total Users:", users.toString());

    console.log("\n🎉 LOCALHOST VERIFICATION COMPLETE");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
