const hre = require("hardhat");

async function main() {
    const { ethers } = hre;
    const [deployer] = await ethers.getSigners();
    console.log("Debugging with account:", deployer.address);

    // Load addresses from config (or you can hardcode the recent deployment addresses if known)
    // For now, let's try to attach to the contracts.
    // We'll read the 'src/config/contractAddresses.ts' file or just rely on what we see in the logs if available.
    // Actually, simpler to just re-read the file since I can't import TS easily in JS script without setup.
    // I will read the file content.
    
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../src/config/contractAddresses.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    const extractAddress = (name) => {
        const match = configContent.match(new RegExp(`${name}: '(0x[a-fA-F0-9]{40})'`));
        return match ? match[1] : null;
    };

    const TRK_ADDRESSES = {
        USDT: extractAddress('USDT'),
        REGISTRY: extractAddress('REGISTRY'),
        TREASURY: extractAddress('TREASURY'),
        ROUTER: extractAddress('ROUTER'),
    };

    console.log("Addresses found:", TRK_ADDRESSES);

    const router = await ethers.getContractAt("TRKRouter", TRK_ADDRESSES.ROUTER);
    const treasury = await ethers.getContractAt("TRKTreasury", TRK_ADDRESSES.TREASURY);
    const registry = await ethers.getContractAt("TRKUserRegistry", TRK_ADDRESSES.REGISTRY);
    const usdt = await ethers.getContractAt("MockUSDT", TRK_ADDRESSES.USDT); // Assuming MockUSDT ABI is compatible

    // 1. Check Permissions
    console.log("\n--- Checking Permissions ---");
    
    const treasuryRouter = await treasury.router();
    console.log(`Treasury.router(): ${treasuryRouter}`);
    console.log(`Expected (Router): ${TRK_ADDRESSES.ROUTER}`);
    console.log(`Match? ${treasuryRouter === TRK_ADDRESSES.ROUTER ? "✅ YES" : "❌ NO"}`);

    const isTreasuryAuth = await registry.isAuthorized(TRK_ADDRESSES.TREASURY);
    console.log(`Registry.isAuthorized(Treasury): ${isTreasuryAuth ? "✅ YES" : "❌ NO"}`);

    // Check BD Wallets
    console.log("\n--- Checking BD Wallets ---");
    for(let i=0; i<5; i++) { // Check first 5
        const bd = await treasury.bdWallets(i);
        console.log(`BD[${i}]: ${bd}`);
        if(bd === ethers.ZeroAddress) console.error("❌ BD Wallet is ZERO!");
    }

    // 2. Simulate User Activation (New User)
    console.log("\n--- Simulating Activation (New User) ---");
    const signers = await ethers.getSigners();
    const user = signers[1]; // Use account #1 (Alice)
    console.log("Testing with User:", user.address);
    
    // Register User first (if not registered)
    const userInfo = await router.getUserInfo(user.address);
    if (!userInfo.isRegistered) {
        console.log("Registering user...");
        await router.connect(user).register(ethers.ZeroAddress);
    } else {
        console.log("User already registered.");
    }

    // Check USDT Balance
    let bal = await usdt.balanceOf(user.address);
    const amount = ethers.parseUnits("1.0", 18);
    
    if (bal < amount) {
        console.log("Calling faucet() for user...");
        await usdt.connect(user).faucet(); // Mints 1000 USDT
    }

    // Approve
    console.log("Approving Treasury...");
    await usdt.connect(user).approve(TRK_ADDRESSES.TREASURY, amount);
    
    const allowance = await usdt.allowance(user.address, TRK_ADDRESSES.TREASURY);
    console.log(`Allowance for Treasury: ${ethers.formatUnits(allowance, 18)}`);

    // Call Deposit
    console.log("Calling Router.depositCashGame(1.0)...");
    try {
        const tx = await router.connect(user).depositCashGame(amount);
        const receipt = await tx.wait();
        console.log("✅ Transaction Succeeded!");
        console.log("Gas Used:", receipt.gasUsed.toString());
    } catch (error) {
        console.error("❌ Transaction Failed!");
        // Try to decode error
        if (error.data) {
             // ... manual decoding if needed
        }
        console.error("Error Message:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
