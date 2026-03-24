import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  // Your deployed Router address
  const ROUTER_ADDRESS = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
  
  // Get the contract instance
  const router = await ethers.getContractAt("TRKRouter", ROUTER_ADDRESS);

  // Call the owner() function directly from the blockchain
  const adminAddress = await router.owner();

  console.log("\n================================================");
  console.log("🔍 BLOCKCHAIN OWNER CHECK");
  console.log("================================================");
  console.log(`The official Admin address is: ${adminAddress}`);
  console.log("================================================\n");

  // Get all local accounts to see which one matches
  const accounts = await ethers.getSigners();
  const index = accounts.findIndex(acc => acc.address.toLowerCase() === adminAddress.toLowerCase());

  if (index !== -1) {
    console.log(`✅ MATCH FOUND! This is Account #${index} in your Hardhat list.`);
    console.log(`Ensure MetaMask is using this address.`);
  } else {
    console.log("❌ NO MATCH: The owner is an address outside your current local signer list.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});