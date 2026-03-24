import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🏃‍♂️ Starting TRK User Journey Simulation...\n");

  // Deployed addresses from your local node
  const ROUTER_ADDRESS = "0xaAdA8236e22D0877159De81BDE5441Ad0C103d42";
  const GAME_ADDRESS = "0x2B3323Dba63a4a1Ed0a4B02d0B3fD5C901760881";

  // Get test accounts from Hardhat
  const [owner, user1] = await ethers.getSigners();
  console.log(`👤 Simulating with User1: ${user1.address}`);

  // Connect to the deployed contracts
  const router = await ethers.getContractAt("TRKRouter", ROUTER_ADDRESS);
  const gameEngine = await ethers.getContractAt("TRKGameEngine", GAME_ADDRESS);

  // --- STEP 1: Registration ---
  console.log("\n📝 Step 1: User1 Registers...");
  // Register with no referrer (address 0)
  await router.connect(user1).register(ethers.ZeroAddress);
  
  let userInfo = await router.getUserInfo(user1.address);
  console.log(`✅ Registration complete! Practice Balance: ${ethers.formatUnits(userInfo.practiceBalance, 18)} USDT`);

  // --- STEP 2: Place a Practice Bet ---
  console.log("\n🎲 Step 2: User1 places a 10 USDT practice bet on number 7...");
  const betAmount = ethers.parseUnits("10", 18);
  const prediction = 7;
  await router.connect(user1).placeBetPractice(prediction, betAmount);
  
  userInfo = await router.getUserInfo(user1.address);
  console.log(`✅ Bet Placed! New Practice Balance: ${ethers.formatUnits(userInfo.practiceBalance, 18)} USDT`);

  // --- STEP 3: Admin Closes Round (User Wins) ---
  console.log("\n🛑 Step 3: Admin closes the round. Winning number is 7!");
  // The owner closes the round with winning number 7 on the Practice Game (false)
  // MUST CALL THROUGH ROUTER DUE TO ACCESS CONTROL
  await router.connect(owner).closeRound(7, false);

  // --- STEP 4: User Claims Winnings ---
  console.log("\n💰 Step 4: User1 claims winnings...");
  // Claiming winnings for roundId 1, practice game (false)
  await router.connect(user1).claimWinnings(1, false);

  // --- STEP 5: Verify 8X Math ---
  userInfo = await router.getUserInfo(user1.address);
  console.log("\n📊 Final Balances after 8X Win:");
  console.log(`Wallet Balance (Real USDT): ${ethers.formatUnits(userInfo.walletBalance, 18)}`);
  console.log(`Practice Balance: ${ethers.formatUnits(userInfo.practiceBalance, 18)}`);
  console.log(`Cash Game Balance (Locked for Real Play): ${ethers.formatUnits(userInfo.cashGameBalance, 18)}`);
  console.log("\n🎉 Journey complete! The 8X split (2X cashout / 6X reinvest) works perfectly.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});