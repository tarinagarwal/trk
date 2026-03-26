const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { ethers } = hre;

async function main() {
  const TREASURY_ABI = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src/abis/TRKTreasury.json"),
      "utf8",
    ),
  ).abi;
  const REGISTRY_ABI = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "src/abis/TRKUserRegistry.json"),
      "utf8",
    ),
  ).abi;
  const USDT_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)",
  ];

  const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";
  const ADMIN_WALLET = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";

  const TREASURY_ADDR = "0x1Fda2130C22502B004e14239543C4093509EaB52";
  const REGISTRY_ADDR = "0xb81C5b7e32714E7f800E00E19610D305C58eF76D";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const usdt = new ethers.Contract(USDT_ADDR, USDT_ABI, signer);
  const treasury = new ethers.Contract(TREASURY_ADDR, TREASURY_ABI, signer);
  const registry = new ethers.Contract(REGISTRY_ADDR, REGISTRY_ABI, signer);

  const contractBalance = await usdt.balanceOf(TREASURY_ADDR);
  console.log("Treasury USDT:", ethers.formatUnits(contractBalance, 18));

  if (contractBalance === 0n) {
    console.log("Treasury is empty.");
    return;
  }

  console.log("1. Updating Registry balance...");
  const tx1 = await registry.updateBalances(
    ADMIN_WALLET,
    contractBalance,
    0,
    0,
  );
  await tx1.wait();
  console.log("   ✅ Done");

  console.log("2. Setting signer as Router...");
  try {
    const tx2 = await treasury.setRouter(signer.address);
    await tx2.wait();
    console.log("   ✅ Done");
  } catch (e) {
    console.log("   ⚠️ Skipped (may already be set)");
  }

  console.log("3. Setting fee to 0, min withdrawal to 0...");
  const tx3 = await treasury.setTreasurySettings(
    0,
    0,
    ethers.parseUnits("1000000", 18),
    0,
  );
  await tx3.wait();
  console.log("   ✅ Done");

  console.log("4. Withdrawing all USDT...");
  const tx4 = await treasury.withdraw(ADMIN_WALLET, contractBalance, {
    gasLimit: 500000,
  });
  await tx4.wait();
  console.log("   🎉 SUCCESS!");

  const finalBal = await usdt.balanceOf(ADMIN_WALLET);
  console.log("\nAdmin USDT Balance:", ethers.formatUnits(finalBal, 18));
}

main().catch(console.error);
