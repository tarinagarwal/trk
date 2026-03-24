import pkg from "hardhat";
import * as fs from "fs";
import * as path from "path";
const { ethers } = pkg;

async function main() {
  console.log("🚀 Deploying TRK Modular System...\n");

  const syncContracts = [
      "TRKRouter",
      "TRKUserRegistry",
      "TRKTreasury",
      "TRKGameEngine",
      "TRKCashbackEngine",
      "TRKLuckyDraw"
  ];

  let usdt = "0x55d398326f99059fF775485246999027B3197955"; // Default BSC Mainnet
  const networkName = pkg.network.name;

  if (networkName === "localhost" || networkName === "hardhat" || networkName === "bscTestnet") {
      console.log("⚠️  Testnet/Localhost detected! Deploying MockUSDT...");
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const mockUsdt = await MockUSDT.deploy();
      await mockUsdt.waitForDeployment();
      usdt = await mockUsdt.getAddress();
      console.log("✅ MockUSDT deployed at:", usdt);
      syncContracts.push("MockUSDT");
      
      // OPTIONAL: Mint tokens to deployer for testing
      // await mockUsdt.mint(deployer.address, ethers.parseUnits("10000", 18));
  }

  const creatorWallet = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";
  const fewWallet = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";

  const bdWallets = [
    "0xAF257e206A984971ffF5c8c54Ae89189D43e5C54",
    "0x1Fcaabe807D7164b655D1C2D7Cd9121cB1A0f0bd",
    "0xcd54CDd6646CDB504782B12D51EcAdaEF6249c95",
    "0x69a3fA596d7dA9e5de0285F9f9753139D46D6483",
    "0x99a71B065ca4599d60C9625F9c07C9EFAA4A628c",
    "0xF24903A13CF045564DB34e9325E7d974731a3207",
    "0xF514625889a12EB1dCf58365293C5907bb52f4Bb",
    "0xA8440f025c0E00A62f2742789855fb656fD1Fe93",
    "0x29b3Aa3F590bD1A9424AB4E4e3fb372beF3D28b9",
    "0xF5F73b3bC16134d5dC0bcAe886b198D197198548",
    "0x2531F82DCFA385A8f2Ae1546d1bDa4177E921afD",
    "0xe133aFE4421976c8D7850619F9f6bb1deC32A60f",
    "0x10d27F446cd590378AD07bd20C904ab90b77a195",
    "0x515176F78CB4EA0416e20a586b64f7CD047E598f",
    "0x478Ea96C0847CbD8428830dac17A01B4B2Fe9F49",
    "0x16e81D3c9c983F16187B916F0388980181bdc534",
    "0xA4bAadF55e80C67dEb6e535D1D286F878F5a7d50",
    "0xE80d3897412A09500682f3B52DB7AB0b7A6891aF",
    "0xEE5B23926322d70061551135C5A3C2094cA66bC5",
    "0x2E3a0fc6d33b257800890e1730690ACb447D0b43",
    "0xAF257e206A984971ffF5c8c54Ae89189D43e5C54", // Duplicate for now
    "0x1Fcaabe807D7164b655D1C2D7Cd9121cB1A0f0bd", // Duplicate for now
    "0xcd54CDd6646CDB504782B12D51EcAdaEF6249c95", // Duplicate for now
    "0x69a3fA596d7dA9e5de0285F9f9753139D46D6483"  // Duplicate for now
  ];

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1️⃣ Registry
  const Registry = await ethers.getContractFactory("TRKUserRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ Registry deployed at:", registryAddr);

  // 2️⃣ Treasury (Needs: USDT, Registry, Creator, FEW, BD Wallets)
  const Treasury = await ethers.getContractFactory("TRKTreasury");
  const treasury = await Treasury.deploy(usdt, registryAddr, creatorWallet, fewWallet, bdWallets);
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  console.log("✅ Treasury deployed at:", treasuryAddr);

  // 3️⃣ Game Engine (Needs: Registry)
  const Game = await ethers.getContractFactory("TRKGameEngine");
  const game = await Game.deploy(registryAddr);
  await game.waitForDeployment();
  const gameAddr = await game.getAddress();
  console.log("✅ Game Engine deployed at:", gameAddr);

  // 4️⃣ Cashback Engine (Needs: Registry, Treasury)
  const Cashback = await ethers.getContractFactory("TRKCashbackEngine");
  const cashback = await Cashback.deploy(registryAddr, treasuryAddr);
  await cashback.waitForDeployment();
  const cashbackAddr = await cashback.getAddress();
  console.log("✅ Cashback Engine deployed at:", cashbackAddr);

  // 5️⃣ Lucky Draw (Needs: USDT, Registry)
  const Lucky = await ethers.getContractFactory("TRKLuckyDraw");
  const lucky = await Lucky.deploy(usdt, registryAddr);
  await lucky.waitForDeployment();
  const luckyAddr = await lucky.getAddress();
  console.log("✅ Lucky Draw deployed at:", luckyAddr);

  // 6️⃣ Router / Facade (Needs: Registry, Treasury, Game, Cashback, Lucky)
  const Router = await ethers.getContractFactory("TRKRouter");
  const router = await Router.deploy(registryAddr, treasuryAddr, gameAddr, cashbackAddr, luckyAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("✅ Router deployed at:", routerAddr);

  console.log("\n🔗 Wiring Contracts and Setting Cross-Contract Authorizations...\n");

  // Step A: Registry Authorizations (Allow engines to modify balances)
  let tx;
  tx = await registry.setAuthorization(routerAddr, true); await tx.wait();
  tx = await registry.setAuthorization(gameAddr, true); await tx.wait();
  tx = await registry.setAuthorization(cashbackAddr, true); await tx.wait();
  tx = await registry.setAuthorization(treasuryAddr, true); await tx.wait();
  tx = await registry.setAuthorization(luckyAddr, true); await tx.wait();
  console.log("   ✅ Registry authorizations set.");

  // Step B: Set Addresses inside the individual engines
  tx = await game.setAddresses(routerAddr, cashbackAddr); await tx.wait();
  console.log("   ✅ Game Engine internal addresses set.");

  tx = await treasury.setAddresses(routerAddr, cashbackAddr, luckyAddr); await tx.wait();
  console.log("   ✅ Treasury internal addresses set.");

  tx = await cashback.setAddresses(routerAddr, gameAddr, luckyAddr); await tx.wait();
  console.log("   ✅ Cashback Engine internal addresses set.");

  tx = await lucky.setAddresses(routerAddr, cashbackAddr, treasuryAddr); await tx.wait();
  console.log("   ✅ Lucky Draw internal addresses set.");

  console.log("\n🎉 SYSTEM FULLY DEPLOYED AND WIRED 🎉");
  console.log("👉 USE THIS ROUTER ADDRESS IN FRONTEND ABI:");
  console.log("TRK_ROUTER_ADDRESS =", routerAddr);

  // NEW: Fund Treasury for testing if Localhost or Testnet
  if (networkName === "localhost" || networkName === "hardhat" || networkName === "bscTestnet") {
      console.log("💰 Funding Treasury with 10,000 MockUSDT for liquidity...");
      // @ts-ignore
      const usdtContract = await ethers.getContractAt("MockUSDT", usdt);
      await usdtContract.transfer(treasuryAddr, ethers.parseUnits("10000", 18));
      console.log("✅ Treasury Funded.");
  }

  // --- AUTO-UPDATE FRONTEND CONFIG ---
  const addressesFile = path.join(process.cwd(), "src/config/contractAddresses.ts");
  const content = `import { type Address } from 'viem';

export const TRK_ADDRESSES = {
    USDT: '${usdt}' as Address,
    REGISTRY: '${registryAddr}' as Address,
    CASHBACK: '${cashbackAddr}' as Address,
    GAME: '${gameAddr}' as Address,
    TREASURY: '${treasuryAddr}' as Address,
    LUCKY_DRAW: '${luckyAddr}' as Address,
    ROUTER: '${routerAddr}' as Address,
} as const;
`;

  fs.writeFileSync(addressesFile, content);
  console.log("\n✨ Updated src/config/contractAddresses.ts with new addresses!");

  // --- AUTO-UPDATE FRONTEND ABIS ---
  const abiDir = path.join(process.cwd(), "src/abis");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  console.log("\n📦 Updating Frontend ABIs...");
  syncContracts.forEach(name => {
      const artifactPath = path.join(process.cwd(), `artifacts/contracts/${name}.sol/${name}.json`);
      if (fs.existsSync(artifactPath)) {
          const destPath = path.join(abiDir, `${name}.json`);
          fs.copyFileSync(artifactPath, destPath);
          console.log(`   ✅ Copied ${name}.json to src/abis/`);
      } else {
          console.warn(`   ⚠️ Warning: Artifact for ${name} not found!`);
      }
  });

  // --- AUTO-UPDATE BACKEND .ENV ---
  const envPath = path.join(process.cwd(), "backend/.env");
  if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf8");
      
      const updates = {
          REGISTRY_ADDRESS: registryAddr,
          CASHBACK_ADDRESS: cashbackAddr,
          GAME_ADDRESS: gameAddr,
          TREASURY_ADDRESS: treasuryAddr,
          LUCKY_DRAW_ADDRESS: luckyAddr,
          ROUTER_ADDRESS: routerAddr
      };

      Object.entries(updates).forEach(([key, value]) => {
          const regex = new RegExp(`^${key}=.*`, 'm');
          if (envContent.match(regex)) {
              envContent = envContent.replace(regex, `${key}="${value}"`);
          } else {
              envContent += `\n${key}="${value}"`;
          }
      });

      fs.writeFileSync(envPath, envContent);
      console.log("✨ Updated backend/.env with new addresses!");
  } else {
      console.warn("   ⚠️ Warning: backend/.env not found, skipping auto-update.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});