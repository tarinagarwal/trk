
const { ethers } = require("hardhat");

async function main() {
    const [deployer, user1] = await ethers.getSigners();
    console.log("Checking state for Admin:", deployer.address);

    const routerAddr = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; // Localhost Router
    const Router = await ethers.getContractFactory("TRKRouter");
    const router = Router.attach(routerAddr);

    // 1. Register and Check Admin Info
    console.log("\n--- Registering Admin ---");
    try {
        // Admin registers with 0x0 address
        if (!(await router.getUserInfo(deployer.address)).isRegistered) {
             const tx = await router.connect(deployer).register("0x0000000000000000000000000000000000000000");
             await tx.wait();
             console.log("✅ Admin Registered");
        } else {
             console.log("Admin already registered");
        }

        const userInfo = await router.getUserInfo(deployer.address);
        console.log("Admin UserID:", userInfo.userId.toString());
        console.log("Admin IsRegistered:", userInfo.isRegistered);
        const adminCode = await router.addressToReferralCode(deployer.address);
        console.log("Admin Referral Code:", adminCode);

        // 2. Register User1
        console.log("\n--- Simulating User Registration ---");
        
        if (adminCode !== "TRK00001") {
            console.error("❌ Unexpected Admin Code:", adminCode);
        }

        const referrer = await router.referralCodeToAddress("TRK00001");
        console.log("Resolved Referrer for TRK00001:", referrer);

        if (referrer === "0x0000000000000000000000000000000000000000") {
             console.error("❌ CRITICAL: TRK00001 did not resolve to a valid address!");
        } else {
             // Check if User1 is already registered
             const u1InfoBefore = await router.getUserInfo(user1.address);
             if (u1InfoBefore.isRegistered) {
                 console.log("User1 is ALREADY registered.");
             } else {
                 console.log("Attempting registration with resolved referrer:", referrer);
                 try {
                    const tx = await router.connect(user1).register(referrer);
                    await tx.wait();
                    console.log("✅ Registration TX confirmed.");
                 } catch (e) {
                    console.error("❌ Registration Failed:", e.message);
                 }
             }
        }
    } catch (e) {
        console.error("Error during execution:", e);
    }

    // 3. Verify User1 State after
    console.log("\n--- Verifying User1 State ---");
    const u1InfoAfter = await router.getUserInfo(user1.address);
    console.log("User1 IsRegistered:", u1InfoAfter.isRegistered);
    console.log("User1 ID:", u1InfoAfter.userId.toString());
    console.log("User1 Referral Code:", await router.addressToReferralCode(user1.address));
    
    // INSPECT STRUCT LAYOUT
    console.log("\n--- Struct Layout Inspection ---");
    // Print keys to see if it works as object or array
    // Ethers Result object looks like an array but has string properties too.
    console.log("Keys available on UserInfo:", Object.keys(u1InfoAfter)); 
    
    // Check specific indices matches my count
    console.log("Index 27 (Expected isRegistered):", u1InfoAfter[27]);
    console.log("Index 39 (Frontend uses this):", u1InfoAfter[39]);
    if (u1InfoAfter[27] === true && u1InfoAfter[39] === undefined) {
        console.log("🚨 DIAGNOSIS: Frontend is using wrong index 39! Should be 27.");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
