const { ethers } = require("ethers");

const SENDER = "0xC0b2F7181ab450B3e8b8821235a11dadD3aaD468";
const START_NONCE = 111; // Registry found here
const SCAN_DEPTH = 20;
const RPC_URL = "https://bsc-dataseed.binance.org/";

async function main() {
    console.log(`Scanning nonces ${START_NONCE} to ${START_NONCE + SCAN_DEPTH} for contracts...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Fingerprints
    const CHECK_ABI = [
        "function owner() view returns (address)", 
        "function totalUsers() view returns (uint256)", // Registry
        "function usdtToken() view returns (address)", // Treasury
        "function lastRoundId() view returns (uint256)", // Game
        "function luckyDrawBalance() view returns (uint256)", // Lucky (via treasury?) No, Lucky contract usually has 'tickets' or similar
        "function router() view returns (address)", // Treasury/Game/Cashback/Lucky/UserRegistry? No, usually not Registry
        "function registry() view returns (address)"  // Router/Treasury/Game...
    ];

    const results = [];

    for (let n = START_NONCE; n < START_NONCE + SCAN_DEPTH; n++) {
        const addr = ethers.getCreateAddress({ from: SENDER, nonce: n });
        try {
            const code = await provider.getCode(addr);
            if (code === "0x") {
                // console.log(`Nonce ${n}: ${addr} (EOA/Empty)`);
                continue;
            }

            const c = new ethers.Contract(addr, CHECK_ABI, provider);
            
            // Try identifying
            let type = "Unknown Contract";
            let details = "";

            // Check Owner
            const owner = await c.owner().catch(() => null);
            if (owner === SENDER) details += "VerifiedOwner ";
            
            // Check specific features
            if (await c.totalUsers().catch(() => null)) type = "REGISTRY";
            if (await c.usdtToken().catch(() => null)) type = "TREASURY"; // Treasury has usdtToken
            if (await c.lastRoundId().catch(() => null)) type = "GAME_ENGINE";
            // Check for Router: has registry() but likely NOT usdtToken
            if (await c.registry().catch(() => null)) {
                if (type === "Unknown Contract") type = "POSSIBLE_ROUTER_OR_ENGINE";
            }

            console.log(`Nonce ${n}: ${addr} -> ${type} (${details})`);
            results.push({ nonce: n, address: addr, type });

        } catch (e) {
            console.log(`Nonce ${n}: Error checking ${addr}`);
        }
    }
}

main();
