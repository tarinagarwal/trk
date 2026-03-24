const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    const configPath = path.join(process.cwd(), 'src/config/contractAddresses.ts');
    const configContent = fs.readFileSync(configPath, 'utf8');
    const routerAddr = configContent.match(/ROUTER: '(0x[a-fA-F0-9]{40})'/)[1];

    console.log(`\n🔍 Inspecting State via Router: ${routerAddr}\n`);

    const Router = await ethers.getContractFactory("TRKRouter");
    const router = Router.attach(routerAddr);

    // Get signer address (usually the one you use in frontend if using hardhat node/metamask with imported key)
    // or just list all users.
    const [deployer] = await ethers.getSigners();
    
    // Check Admin
    console.log("--- Checking Admin/Deployer ---");
    try {
        const u = await router.getUserInfo(deployer.address);
        // We know from calculation: 
        // 27: isRegistered
        // 30: directReferrals
        console.log(`Address: ${deployer.address}`);
        console.log(`isRegistered (Index 27): ${u[27]}`);
        console.log(`User ID: ${u[0]}`);
        console.log(`Referrer: ${u[1]}`);
    } catch (e) {
        console.log("Error reading admin:", e.message);
    }

    // Check generic "User 1" from Registry count
    const registryAddr = configContent.match(/REGISTRY: '(0x[a-fA-F0-9]{40})'/)[1];
    const Registry = await ethers.getContractFactory("TRKUserRegistry");
    const registry = Registry.attach(registryAddr);
    
    const count = await registry.totalUsers();
    console.log(`\nTotal Users in Registry: ${count}`);

    for(let i=1; i<=count; i++) {
        const addr = await registry.idToAddress(i);
        const code = await router.addressToReferralCode(addr);
        const u = await router.getUserInfo(addr);
        console.log(`\n[User ID ${i}]`);
        console.log(`Addr: ${addr}`);
        console.log(`Code: ${code}`);
        console.log(`isRegistered: ${u[27]}`); // Index 27 check
        console.log(`Raw Struct: ${u}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
