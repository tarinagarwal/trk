const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const TARGET_ADDRESS = "0x5d45dd528e8fAD8B24b2e2657736c759730E7343";

async function main() {
    console.log("Connecting to BSC Mainnet...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Selectors to check
    const checks = {
        "addressToReferralCode(address)": "function addressToReferralCode(address) view returns (string)",
        "referralCodeToAddress(string)": "function referralCodeToAddress(string) view returns (address)",
        "register(address)": "function register(address)", // write
        "totalUsers()": "function totalUsers() view returns (uint256)",
        "gamePoolBalance()": "function gamePoolBalance() view returns (uint256)",
        "protectionPoolBalance()": "function protectionPoolBalance() view returns (uint256)",
        "treasury()": "function treasury() view returns (address)", // If missing, we must hardcode
    };

    const contract = new ethers.Contract(TARGET_ADDRESS, Object.values(checks), provider);

    console.log(`Verifying Monolith Features on ${TARGET_ADDRESS}...`);

    // Check View Functions
    try {
        const adminCode = await contract.addressToReferralCode("0xC0b2F7181ab450B3e8b8821235a11dadD3aaD468");
        console.log(`✅ addressToReferralCode: ${adminCode}`);
    } catch (e) { 
        console.log(`❌ addressToReferralCode failed: ${e.shortMessage || e.message}`); 
    }

    try {
        const addr = await contract.referralCodeToAddress("TRK00001");
        console.log(`✅ referralCodeToAddress(TRK00001): ${addr}`);
    } catch (e) {
        console.log(`❌ referralCodeToAddress failed: ${e.shortMessage || e.message}`);
    }

    try {
        const users = await contract.totalUsers();
        console.log(`✅ totalUsers: ${users}`);
    } catch (e) {
        console.log(`❌ totalUsers failed`);
    }

    try {
        const bal = await contract.gamePoolBalance();
        console.log(`✅ gamePoolBalance: ${bal}`);
    } catch (e) {
        console.log(`❌ gamePoolBalance failed (maybe private?)`);
    }

    try {
        const t = await contract.treasury();
        console.log(`✅ treasury(): ${t}`);
    } catch (e) {
        console.log(`❌ treasury() getter MISSING. (Confirmation: Monolith doesn't point to external treasury)`);
    }

}

main();
