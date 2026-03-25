const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Admin:", deployer.address);

  const treasuryAddr = "0xE00a116A7F97B47fCef1bC0b6B7caD6D5e220de9";
  const usdtAddr = "0x55d398326f99059fF775485246999027B3197955";

  // Check USDT balance of Treasury
  const usdt = await ethers.getContractAt("IERC20", usdtAddr);
  const balance = await usdt.balanceOf(treasuryAddr);
  console.log(
    "Treasury USDT balance:",
    ethers.formatUnits(balance, 18),
    "USDT",
  );

  if (balance === 0n) {
    console.log("Treasury is empty, nothing to drain.");
    return;
  }

  // The Treasury owner is in onlyEngines modifier, so we can call
  // deductClubPool etc. but those don't transfer USDT.
  // We need to use a different approach.

  // Option: Set router to deployer temporarily, then call withdraw logic
  // But withdraw checks user wallet balance in Registry...

  // Simplest: The Treasury has USDT. We'll add an emergencyWithdraw via
  // a direct low-level call since we're the owner.
  // Actually - we can't call arbitrary functions that don't exist.

  // Real solution: Transfer ownership approach won't work either.
  // The only real option is to have a user with wallet balance withdraw.

  // Let's check if admin is registered and has balance
  const routerAddr = "0xae48CBC919EDe31F636064b821Eb30A8D1D9D50e";
  const router = await ethers.getContractAt(
    require("../src/abis/TRKRouter.json").abi,
    routerAddr,
  );

  const userInfo = await router.getUserInfo(deployer.address);
  console.log(
    "Admin wallet balance:",
    ethers.formatUnits(userInfo.walletBalance, 18),
  );
  console.log("Admin is registered:", userInfo.isRegistered);

  // If admin has wallet balance, withdraw it
  if (userInfo.walletBalance > 0n) {
    const minWithdrawal = ethers.parseUnits("5", 18);
    if (userInfo.walletBalance >= minWithdrawal) {
      console.log(
        "Withdrawing",
        ethers.formatUnits(userInfo.walletBalance, 18),
        "USDT...",
      );
      const tx = await router.withdraw(userInfo.walletBalance);
      await tx.wait();
      console.log("✅ Withdrawn successfully!");
    } else {
      console.log("Balance below minimum withdrawal (5 USDT)");
    }
  } else {
    console.log("\nAdmin has no wallet balance to withdraw.");
    console.log(
      "Treasury holds",
      ethers.formatUnits(balance, 18),
      "USDT in pools.",
    );
    console.log("\nTo recover funds, you need to either:");
    console.log("1. Redeploy Treasury with an emergencyWithdraw function");
    console.log("2. Or deposit+withdraw through normal user flow");
  }
}

main().catch(console.error);
