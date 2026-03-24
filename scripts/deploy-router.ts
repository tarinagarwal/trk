import pkg from "hardhat";
import dotenv from "dotenv";

const { ethers } = pkg;

dotenv.config({ path: "backend/.env" });

type AddrKey =
  | "REGISTRY_ADDRESS"
  | "TREASURY_ADDRESS"
  | "GAME_ADDRESS"
  | "CASHBACK_ADDRESS"
  | "LUCKY_DRAW_ADDRESS";

function requireAddress(key: AddrKey): `0x${string}` {
  const value = process.env[key];
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid ${key} in backend/.env`);
  }
  return value as `0x${string}`;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const registryAddr = requireAddress("REGISTRY_ADDRESS");
  const treasuryAddr = requireAddress("TREASURY_ADDRESS");
  const gameAddr = requireAddress("GAME_ADDRESS");
  const cashbackAddr = requireAddress("CASHBACK_ADDRESS");
  const luckyAddr = requireAddress("LUCKY_DRAW_ADDRESS");

  console.log("Using component addresses:");
  console.log("- REGISTRY:", registryAddr);
  console.log("- TREASURY:", treasuryAddr);
  console.log("- GAME:", gameAddr);
  console.log("- CASHBACK:", cashbackAddr);
  console.log("- LUCKY:", luckyAddr);

  const Router = await ethers.getContractFactory("TRKRouter");
  const router = await Router.deploy(
    registryAddr,
    treasuryAddr,
    gameAddr,
    cashbackAddr,
    luckyAddr
  );
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("✅ Router deployed at:", routerAddr);

  const registry = await ethers.getContractAt("TRKUserRegistry", registryAddr);
  const treasury = await ethers.getContractAt("TRKTreasury", treasuryAddr);
  const game = await ethers.getContractAt("TRKGameEngine", gameAddr);
  const cashback = await ethers.getContractAt("TRKCashbackEngine", cashbackAddr);
  const lucky = await ethers.getContractAt("TRKLuckyDraw", luckyAddr);

  let tx;
  tx = await registry.setAuthorization(routerAddr, true); await tx.wait();
  tx = await registry.setAuthorization(gameAddr, true); await tx.wait();
  tx = await registry.setAuthorization(cashbackAddr, true); await tx.wait();
  tx = await registry.setAuthorization(treasuryAddr, true); await tx.wait();
  tx = await registry.setAuthorization(luckyAddr, true); await tx.wait();
  console.log("✅ Registry authorizations updated");

  tx = await game.setAddresses(routerAddr, cashbackAddr); await tx.wait();
  tx = await treasury.setAddresses(routerAddr, cashbackAddr, luckyAddr); await tx.wait();
  tx = await cashback.setAddresses(routerAddr, gameAddr, luckyAddr); await tx.wait();
  tx = await lucky.setAddresses(routerAddr, cashbackAddr, treasuryAddr); await tx.wait();
  console.log("✅ Engine addresses wired to new router");

  console.log("\nNEW_ROUTER_ADDRESS=", routerAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
