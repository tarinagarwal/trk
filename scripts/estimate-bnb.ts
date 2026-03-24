import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🚀 Estimating Gas for TRK Modular System Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const usdt = "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT
  const creatorWallet = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";
  const fewWallet = "0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8";
  const bdWallets = Array(20).fill("0xAF257e206A984971ffF5c8c54Ae89189D43e5C54");

  let totalGasLimit = BigInt(0);

  async function estimateDeployment(contractName: string, ...args: any[]) {
    const Factory = await ethers.getContractFactory(contractName);
    const deployTx = await Factory.getDeployTransaction(...args);
    const gas = await ethers.provider.estimateGas(deployTx);
    console.log(`- ${contractName} deployment: ${gas.toString()} gas`);
    totalGasLimit += gas;
    return gas;
  }

  try {
    // 1️⃣ Registry
    await estimateDeployment("TRKUserRegistry");
    
    // 2️⃣ Treasury
    await estimateDeployment("TRKTreasury", usdt, deployer.address, creatorWallet, fewWallet, bdWallets);
    
    // 3️⃣ Game Engine
    await estimateDeployment("TRKGameEngine", deployer.address);
    
    // 4️⃣ Cashback Engine
    await estimateDeployment("TRKCashbackEngine", deployer.address, deployer.address);
    
    // 5️⃣ Lucky Draw
    await estimateDeployment("TRKLuckyDraw", usdt, deployer.address);
    
    // 6️⃣ Router
    await estimateDeployment("TRKRouter", deployer.address, deployer.address, deployer.address, deployer.address, deployer.address);

    console.log("\n🔗 Estimating Configuration Calls...\n");
    const dummyAddr = deployer.address;
    
    const RegistryFactory = await ethers.getContractFactory("TRKUserRegistry");
    const registryAbi = RegistryFactory.interface.format();
    const mockRegistry = new ethers.Contract(dummyAddr, registryAbi, deployer);

    const authGas = await mockRegistry.setAuthorization.estimateGas(dummyAddr, true);
    console.log(`- setAuthorization call (x5): ${authGas.toString()} gas each`);
    totalGasLimit += authGas * BigInt(5);

    const GameFactory = await ethers.getContractFactory("TRKGameEngine");
    const gameAbi = GameFactory.interface.format();
    const mockGame = new ethers.Contract(dummyAddr, gameAbi, deployer);
    const gameSetAddrGas = await mockGame.setAddresses.estimateGas(dummyAddr, dummyAddr);
    console.log(`- Game setAddresses call: ${gameSetAddrGas.toString()} gas`);
    totalGasLimit += gameSetAddrGas;

    const TreasuryFactory = await ethers.getContractFactory("TRKTreasury");
    const treasuryAbi = TreasuryFactory.interface.format();
    const mockTreasury = new ethers.Contract(dummyAddr, treasuryAbi, deployer);
    const treasurySetAddrGas = await mockTreasury.setAddresses.estimateGas(dummyAddr, dummyAddr, dummyAddr);
    console.log(`- Treasury setAddresses call: ${treasurySetAddrGas.toString()} gas`);
    totalGasLimit += treasurySetAddrGas;

    const CashbackFactory = await ethers.getContractFactory("TRKCashbackEngine");
    const cashbackAbi = CashbackFactory.interface.format();
    const mockCashback = new ethers.Contract(dummyAddr, cashbackAbi, deployer);
    const cashbackSetAddrGas = await mockCashback.setAddresses.estimateGas(dummyAddr, dummyAddr, dummyAddr);
    console.log(`- Cashback setAddresses call: ${cashbackSetAddrGas.toString()} gas`);
    totalGasLimit += cashbackSetAddrGas;

    const LuckyFactory = await ethers.getContractFactory("TRKLuckyDraw");
    const luckyAbi = LuckyFactory.interface.format();
    const mockLucky = new ethers.Contract(dummyAddr, luckyAbi, deployer);
    const luckySetAddrGas = await mockLucky.setAddresses.estimateGas(dummyAddr, dummyAddr, dummyAddr);
    totalGasLimit += luckySetAddrGas;
    console.log(`- Lucky Draw setAddresses call: ${luckySetAddrGas.toString()} gas`);

    // --- FINAL CALCULATIONS ---

    const bnbPriceUSD = 625.50; // Current market price (approx)
    const gasPriceGwei = BigInt(3); // Conservative 3 Gwei for BSC
    
    const totalBNB = Number(totalGasLimit * gasPriceGwei * BigInt(10**9)) / 10**18;
    const totalUSD = totalBNB * bnbPriceUSD;

    // Buffers
    const buffer20 = 1.20;
    const buffer30 = 1.30;

    const bnb20 = totalBNB * buffer20;
    const bnb30 = totalBNB * buffer30;
    const usd20 = totalUSD * buffer20;

    console.log("\n===========================================");
    console.log("            DEPLOYMENT COST REPORT         ");
    console.log("===========================================");
    console.log(`Total Gas Limit:   ${totalGasLimit.toString()}`);
    console.log(`Gas Price Used:    ${gasPriceGwei.toString()} Gwei`);
    console.log(`BNB Price (Live):  $${bnbPriceUSD.toFixed(2)}`);
    console.log("-------------------------------------------");
    
    console.log("\n💰 BASE COST (NORMAL):");
    console.log(`- BNB: ${totalBNB.toFixed(6)}`);
    console.log(`- USD: $${totalUSD.toFixed(2)}`);

    console.log("\n🛡️  WITH 20% BUFFER:");
    console.log(`- BNB: ${bnb20.toFixed(6)}`);
    console.log(`- USD: $${usd20.toFixed(2)}`);

    console.log("\n🛡️  WITH 30% BUFFER (RECOMMENDED):");
    console.log(`- BNB: ${bnb30.toFixed(6)}`);
    console.log(`- USD: $${(totalUSD * buffer30).toFixed(2)}`);

    console.log("\n===========================================");
    console.log("👉 ADD AT LEAST " + bnb30.toFixed(4) + " BNB TO YOUR WALLET.");
    console.log("===========================================\n");

  } catch (error) {
    console.error("Estimation failed!");
    console.error(error);
  }
}

main();
