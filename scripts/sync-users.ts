// Run: npx ts-node scripts/sync-users.ts
// Or: node -e "require('./scripts/sync-users.ts')" -- won't work, use hardhat
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const routerAddr = "0x16eD18c5D31D695Bd8115F95Eb7F524654cE7F4D";
  const backendUrl = "http://localhost:3001";

  const router = await ethers.getContractAt(
    require("../src/abis/TRKRouter.json").abi,
    routerAddr,
  );

  const stats = await router.getPlatformStats();
  const totalUsers = Number(stats[0]);
  console.log("Total users:", totalUsers);

  for (let i = 1; i <= totalUsers; i++) {
    const addr = await router.idToAddress(BigInt(i));
    const info = await router.getUserInfo(addr);
    const referrer = info.referrer;
    const userId = info.userId;

    console.log(`Syncing user ${i}: ${addr} (referrer: ${referrer})`);

    try {
      const res = await fetch(`${backendUrl}/api/sync/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addr.toLowerCase(),
          referrer:
            referrer === "0x0000000000000000000000000000000000000000"
              ? null
              : referrer.toLowerCase(),
          userId: userId.toString(),
          hash: `0x${"0".repeat(63)}${i}`, // fake hash
          timestamp: Math.floor(Date.now() / 1000),
        }),
      });
      const data = await res.json();
      console.log(`  ✅ Synced:`, data.success ? "OK" : data.error);
    } catch (e: any) {
      console.error(`  ❌ Failed:`, e.message);
    }
  }

  console.log("\n✅ All users synced!");
}

main().catch(console.error);
