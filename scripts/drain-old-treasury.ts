import pkg from "hardhat";
const { ethers } = pkg;
import * as fs from "fs";
import * as path from "path";

async function main() {
  const TREASURY_ABI = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/abis/TRKTreasury.json"), "utf8")).abi;
  const REGISTRY_ABI = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/abis/TRKUserRegistry.json"), "utf8")).abi;
  const USDT_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address recipient, uint256 amount) returns (bool)"
  ];

  const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";
  const ADMIN_WALLET = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";

  const ARCHITECTURES = [
    { name: "Commit 5 (134b451)", treasury: "0x1217d39589Ae44E9f5Bb3c545380f19588f56F75", registry: "0x61741A41D1424A5792E8B9f9c65a6c028F32670E" },
    { name: "Commit 4 (3dcc200)", treasury: "0xAE84DF31FbB4d0F7995282dEB37C565eA3877aBe", registry: "0xD4C93B9530a26f0D57f9B8b3F4fE184B9184b589" },
    { name: "Commit 3 (81ca61d)", treasury: "0x438C50F54Da417fAe18a0D2150379F195D27F1bb", registry: "0x8CFEc57CC87Ff9B91E02B0Ed284fe41c2Ba48b3c" },
    { name: "Commit 2 (022489d)", treasury: "0x860333F3673bd81D9B58Fa65AcF944a3D34647a6", registry: "0x64565b4085aEeaEA4C2Ae744a4e7B6086Cf0B991" },
    { name: "Active (Current)", treasury: "0x5AF9Da8Dc9D2B215D6C7Bf181219e7eDa33d3091", registry: "0x63C8FAC7554883E7653b2A10d87356Fa7f92Db7e" }
  ];

  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  if (signer.address.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
    console.warn("⚠️  Signer is NOT the target admin wallet. Please ensure you are authorized.");
  }

  const usdt = new ethers.Contract(USDT_ADDR, USDT_ABI, signer);

  for (const arch of ARCHITECTURES) {
    console.log(`\n--- Draining ${arch.name} ---`);
    console.log(`Treasury: ${arch.treasury}`);
    console.log(`Registry: ${arch.registry}`);

    const treasury = new ethers.Contract(arch.treasury, TREASURY_ABI, signer);
    const registry = new ethers.Contract(arch.registry, REGISTRY_ABI, signer);

    // 1. Check current contract balance
    let contractBalance;
    try {
        contractBalance = await usdt.balanceOf(arch.treasury);
        console.log(`💳 Treasury Balance: ${ethers.formatUnits(contractBalance, 18)} USDT`);
    } catch (e: any) {
        console.error("❌ Failed to fetch balance or contract doesn't exist at address.");
        continue;
    }

    if (contractBalance === BigInt(0)) {
        console.log("❌ Balance is zero. Skipping.");
        continue;
    }

    // 2. Prepare Registry for withdrawal
    console.log(`🔄 Updating Registry balance for ${ADMIN_WALLET}...`);
    try {
        const tx1 = await registry.updateBalances(ADMIN_WALLET, contractBalance, 0, 0);
        await tx1.wait();
        console.log("✅ Registry updated.");
    } catch (e: any) {
        console.error("❌ Failed to update registry balance:", e.message);
        continue;
    }

    // 3. Set Signer as Router on Treasury
    console.log(`🔄 Setting signer as Router on Treasury...`);
    try {
        const tx2 = await treasury.setRouter(signer.address);
        await tx2.wait();
        console.log("✅ Router set.");
    } catch (e: any) {
        console.warn("⚠️ Failed to set router (might already be set or non-modular treasury branch):", e.message);
    }

    // 4. Set Withdrawal fee to 0% and min withdrawal to 0
    console.log(`🔄 Configuring for immediate withdrawal...`);
    try {
        const txFee = await treasury.setTreasurySettings(
            ethers.parseUnits("0", 18), // minActivation
            ethers.parseUnits("0", 18), // minWithdrawal
            ethers.parseUnits("1000000", 18), // maxDaily
            0 // withdrawFee
        );
        await txFee.wait();
        console.log("✅ Settings updated (Fee 0).");
    } catch (e: any) {
        console.warn("⚠️ Failed to update settings:", e.message);
    }

    // 5. Withdrawal
    console.log(`🚀 Withdrawing ${ethers.formatUnits(contractBalance, 18)} USDT...`);
    try {
        const tx3 = await treasury.withdraw(ADMIN_WALLET, contractBalance, { gasLimit: 500000 });
        await tx3.wait();
        console.log("🎉 SUCCESS!");
    } catch (e: any) {
        console.error("❌ Withdrawal failed:", e.message);
    }
  }

  const finalAdminBal = await usdt.balanceOf(ADMIN_WALLET);
  console.log(`\nFinal Admin Balance: ${ethers.formatUnits(finalAdminBal, 18)} USDT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
