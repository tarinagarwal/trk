const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const routerAddr = "0xf512c061C391fC84B896693BDfc044225C31B8c9";
  const userAddr = "0x4010431129a6bda5736ba8997e68612bb77ff298";

  const [deployer] = await ethers.getSigners();
  console.log("Admin:", deployer.address);

  const router = await ethers.getContractAt(
    require("../src/abis/TRKRouter.json").abi,
    routerAddr,
  );

  console.log("Triggering practice referral for", userAddr, "...");
  const tx = await router.triggerPracticeReferral(userAddr);
  console.log("Tx:", tx.hash);
  await tx.wait();
  console.log("✅ Done! Practice referral rewards distributed.");
}

main().catch(console.error);
