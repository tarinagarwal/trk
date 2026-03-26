const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const routerAddr = "0xf512c061C391fC84B896693BDfc044225C31B8c9";
  const adminAddr = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";

  const [deployer] = await ethers.getSigners();
  console.log("Admin:", deployer.address);

  const router = await ethers.getContractAt(
    require("../src/abis/TRKRouter.json").abi,
    routerAddr,
  );

  // Read current club pool balance
  const pools = await router.getPools();
  const clubPool = pools[1]; // index 1 = clubPool
  console.log("Club Pool Balance:", ethers.formatUnits(clubPool, 18), "USDT");

  if (clubPool === 0n) {
    console.log("Club pool is empty, nothing to claim.");
    return;
  }

  // distributeClubIncome sends to specified addresses and deducts from club pool
  console.log("Claiming club pool to admin wallet...");
  const tx = await router.distributeClubIncome([adminAddr], [clubPool]);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("✅ Club pool claimed to admin wallet!");
}

main().catch(console.error);
