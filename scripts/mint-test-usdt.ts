const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const mockUsdtAddr = "0x22e40b76435844075Fd7DC2ef4Ff6Af1791a09c4";
  const recipient =
    process.argv[2] || "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";
  const amount = process.argv[3] || "1000000";

  const [deployer] = await ethers.getSigners();
  console.log("Minter:", deployer.address);
  console.log("Recipient:", recipient);
  console.log("Amount:", amount, "USDT");

  const usdt = await ethers.getContractAt("MockUSDT", mockUsdtAddr);

  // Check if mint function exists, otherwise use transfer
  try {
    const tx = await usdt.mint(recipient, ethers.parseUnits(amount, 18));
    console.log("Tx:", tx.hash);
    await tx.wait();
  } catch {
    // Fallback to transfer from deployer
    const tx = await usdt.transfer(recipient, ethers.parseUnits(amount, 18));
    console.log("Tx:", tx.hash);
    await tx.wait();
  }

  const bal = await usdt.balanceOf(recipient);
  console.log(
    "✅ Done! Recipient balance:",
    ethers.formatUnits(bal, 18),
    "USDT",
  );
}

main().catch(console.error);
