const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🔍 Dumping Localhost Registry State...");

    // Read config to get addresses
    const configPath = path.join(process.cwd(), 'src/config/contractAddresses.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const registryAddr = configContent.match(/REGISTRY: '(0x[a-fA-F0-9]{40})'/)[1];
    const routerAddr = configContent.match(/ROUTER: '(0x[a-fA-F0-9]{40})'/)[1];

    console.log(`Registry: ${registryAddr}`);
    console.log(`Router:   ${routerAddr}`);

    const Registry = await ethers.getContractFactory("TRKUserRegistry");
    const registry = Registry.attach(registryAddr);

    const Router = await ethers.getContractFactory("TRKRouter");
    const router = Router.attach(routerAddr);

    const totalUsers = await registry.totalUsers();
    console.log(`\nTotal Users Registered: ${totalUsers.toString()}`);

    if (totalUsers == 0) {
        console.log("⚠️ No users found! The blockchain might have been reset or registration failed.");
        return;
    }

    console.log("\n--- User List ---");
    // Iterate from 1 to totalUsers (IDs are 1-based in contract)
    for (let i = 1; i <= totalUsers; i++) {
        try {
            const userAddr = await registry.idToAddress(i);
            const userStruct = await registry.users(userAddr);
            const refCode = await router.addressToReferralCode(userAddr);

            console.log(`\nID: ${i}`);
            console.log(`Address: ${userAddr}`);
            console.log(`Referral Code: ${refCode}`);
            console.log(`isRegistered: ${userStruct.isRegistered}`);
            console.log(`Practice Balance: ${ethers.formatUnits(userStruct.practiceBalance, 18)}`);
            console.log(`Link: http://localhost:3000/?ref=${refCode}`);
        } catch (e) {
            console.log(`❌ Error fetching ID ${i}: ${e.message}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
