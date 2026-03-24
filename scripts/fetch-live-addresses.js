const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const TARGET_ADDRESS = "0x5d45dd528e8fAD8B24b2e2657736c759730E7343";

async function main() {
    console.log("Connecting to BSC Mainnet...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // We can't really estimateGas without a signer who has funds, but we can try callStatic or populateTransaction
    // Actually, 'register' is a write function. calling it with call() will likely revert if it modifies state or checks msg.sender.
    // simpler: check selector.
    
    // register(address) selector: keccak256("register(address)")[0..4]
    // 0xf2c298be
    
    // We can use provider.call with the selector and see if it reverts with "fallback" or execution error.
    
    const selector = ethers.id("register(address)").slice(0, 10);
    console.log(`Checking selector ${selector} on ${TARGET_ADDRESS}...`);
    
    try {
        const result = await provider.call({
            to: TARGET_ADDRESS,
            data: selector + "000000000000000000000000c0b2f7181ab450b3e8b8821235a11dadd3aad468" // Fake param
        });
        console.log("Result:", result);
        console.log("✅ Function exists (did not revert instantaneously with 'function not found' - though reverting with execution error is expected)");
    } catch (e) {
        if (e.message.includes("execution reverted")) {
             console.log("✅ Function likely exists (execution reverted)");
        } else {
             console.log("❌ Function check failed:", e.message);
        }
    }

    // Check registerUser(address,address,uint256) selector from UserRegistry
    // registerUser(address,address,uint256)
    const selRegUser = ethers.id("registerUser(address,address,uint256)").slice(0, 10);
    console.log(`Checking selector ${selRegUser} (registerUser) on ${TARGET_ADDRESS}...`);
    try {
        await provider.call({ to: TARGET_ADDRESS, data: selRegUser });
        console.log("✅ registerUser exists");
    } catch (e) { console.log("Result for registerUser:", e.shortMessage || e.message); }

}

main();
