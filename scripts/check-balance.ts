const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const routerAddr = "0xf512c061C391fC84B896693BDfc044225C31B8c9";
  const adminAddr = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";
  const userAddr = "0x4010431129a6bda5736ba8997e68612bb77ff298";

  const router = await ethers.getContractAt(
    require("../src/abis/TRKRouter.json").abi,
    routerAddr,
  );

  const adminInfo = await router.getUserInfo(adminAddr);
  console.log("=== ADMIN (referrer) ===");
  console.log(
    "Practice Balance:",
    ethers.formatUnits(adminInfo.practiceBalance, 18),
  );
  console.log(
    "Practice Referral Income:",
    ethers.formatUnits(adminInfo.practiceReferralIncome, 18),
  );
  console.log(
    "Direct Referral Income:",
    ethers.formatUnits(adminInfo.directReferralIncome, 18),
  );
  console.log(
    "Wallet Balance:",
    ethers.formatUnits(adminInfo.walletBalance, 18),
  );

  const userInfo = await router.getUserInfo(userAddr);
  console.log("\n=== USER (referred) ===");
  console.log(
    "Practice Balance:",
    ethers.formatUnits(userInfo.practiceBalance, 18),
  );
  console.log(
    "Practice Referral Income:",
    ethers.formatUnits(userInfo.practiceReferralIncome, 18),
  );
  console.log("Is Registered:", userInfo.isRegistered);
  console.log("Referrer:", userInfo.referrer);
}

main().catch(console.error);
