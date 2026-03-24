// import pkg from "hardhat";
// const { ethers } = pkg;

// async function main() {
//     const routerAddr = "0x56fC17a65ccFEC6B7ad0aDe9BD9416CB365B9BE8";
//     const registryAddr = "0xe70f935c32dA4dB13e7876795f1e175465e6458e";
//     const treasuryAddr = "0x3C15538ED063e688c8DF3d571Cb7a0062d2fB18D";
//     const gameAddr = "0xccf1769D8713099172642EB55DDFFC0c5A444FE9";
    
//     const router = await ethers.getContractAt("TRKRouter", routerAddr);
//     const registry = await ethers.getContractAt("TRKUserRegistry", registryAddr);
    
//     console.log("--- Testing Router Calls ---");
    
//     try {
//         const stats = await router.getPlatformStats();
//         console.log("✅ getPlatformStats:", stats.toString());
//     } catch (e) {
//         console.error("❌ getPlatformStats failed:", e.message);
//     }
    
//     try {
//         const settings = await router.getAllSettings();
//         console.log("✅ getAllSettings successful (array of 15)");
//     } catch (e) {
//         console.error("❌ getAllSettings failed:", e.message);
//     }
    
//     try {
//         const lucky = await router.getLuckyDrawStats();
//         console.log("✅ getLuckyDrawStats successful");
//     } catch (e) {
//         console.error("❌ getLuckyDrawStats failed:", e.message);
//     }
    
//     try {
//         const pools = await router.getPools();
//         console.log("✅ getPools successful");
//     } catch (e) {
//         console.error("❌ getPools failed:", e.message);
//     }
    
//     console.log("\n--- Testing Registry/User Calls ---");
//     const testUser = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Admin
    
//     try {
//         const userInfo = await router.getUserInfo(testUser);
//         console.log("✅ getUserInfo (Admin) successful. UserId:", userInfo.userId.toString());
//     } catch (e) {
//         console.error("❌ getUserInfo failed:", e.message);
//     }
    
//     try {
//         const addr = await router.idToAddress(1);
//         console.log("✅ idToAddress(1):", addr);
//     } catch (e) {
//         console.error("❌ idToAddress failed:", e.message);
//     }
// }

// main().catch(console.error);
