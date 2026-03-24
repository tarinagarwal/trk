import pkg from "hardhat";
const { ethers } = pkg;
import * as readline from "readline";

// Helper for interactive prompts
function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("🚀 Starting TRK MASS SEED & TEST SYSTEM...");

  // 1. Get Signers
  const [owner, user1, user2, user3] = await ethers.getSigners();
  console.log(`👤 Owner/Admin: ${owner.address}`);

  const ADDR = {
    USDT: "0x59Bb4180cEAf9160BE93d4bA3172D67f983FfC62",
    ROUTER: "0xaAdA8236e22D0877159De81BDE5441Ad0C103d42",
    GAME: "0x2B3323Dba63a4a1Ed0a4B02d0B3fD5C901760881",
    TREASURY: "0xA68a91FCf064aE09f06D198503EDa896d0F04459",
    LUCKY: "0x8DA6b6Dd929deed2237eBE41e0AABF4862d0b93A",
    CASHBACK: "0x9D7b35BFA6e230A198B37220f83B63882Eae0680",
    REGISTRY: "0x1f871a3fe5956F642CfF1671eEe7a886E4986a2d"
  };

  const usdt = await ethers.getContractAt("MockUSDT", ADDR.USDT);
  const router = await ethers.getContractAt("TRKRouter", ADDR.ROUTER);
  const game = await ethers.getContractAt("TRKGameEngine", ADDR.GAME);
  const lucky = await ethers.getContractAt("TRKLuckyDraw", ADDR.LUCKY);

  console.log("\n--- STEP 1: MASS USER GENERATION (150 Users) ---");
  const massUsers = [];
  const TOTAL_MASS_USERS = 150;
  
  for (let i = 0; i < TOTAL_MASS_USERS; i++) {
    const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
    massUsers.push(wallet);
  }
  console.log(`✅ Generated ${TOTAL_MASS_USERS} unique user wallets.`);

  console.log("\n--- STEP 2: FUNDING MASS USERS (Native ETH + MockUSDT) ---");
  // Owner needs to send ETH for gas and USDT for play
  const fundAmountUSDT = ethers.parseUnits("500", 18);
  const fundAmountETH = ethers.parseUnits("0.1", 18);

  // Batch transactions for efficiency
  for (let i = 0; i < massUsers.length; i++) {
    const user = massUsers[i];
    // Send Gas
    await owner.sendTransaction({ to: user.address, value: fundAmountETH });
    // Send USDT
    await usdt.connect(owner).transfer(user.address, fundAmountUSDT);
    
    if (i % 50 === 0) console.log(`   Funded ${i} users...`);
  }
  console.log("✅ Funding complete.");

  console.log("\n--- STEP 3: MASS REGISTRATION (Referral Tree) ---");
  // Structure:
  // Owner -> Top 10
  // Top 10 -> Next 40
  // Next 40 -> Remaining 100
  
  for (let i = 0; i < 10; i++) {
    await router.connect(massUsers[i]).register(owner.address);
  }
  for (let i = 10; i < 50; i++) {
    const referrer = massUsers[i % 10].address;
    await router.connect(massUsers[i]).register(referrer);
  }
  for (let i = 50; i < TOTAL_MASS_USERS; i++) {
    const referrer = massUsers[(i % 40) + 10].address;
    await router.connect(massUsers[i]).register(referrer);
  }
  console.log("✅ 150 Users Registered. Tree: 10 -> 40 -> 100.");
  
  await ask("Check Admin 'Users' tab. You should see 150+ users now. Press Enter to proceed to Mass Deposits...");

  console.log("\n--- STEP 4: MASS DEPOSITS (Activating 50 Cash Players) ---");
  for (let i = 0; i < 50; i++) {
    const user = massUsers[i];
    await usdt.connect(user).approve(ADDR.TREASURY, ethers.MaxUint256);
    await router.connect(user).depositCashGame(ethers.parseUnits("100", 18));
    if (i % 10 === 0) console.log(`   Activated ${i} players...`);
  }
  console.log("✅ 50 Users are now Cash Players with 100 USDT each.");

  await ask("Check Admin 'Overview' tab for Total Volume (should be ~5000 USDT). Press Enter to start Game Rounds...");

  console.log("\n--- STEP 5: MASS GAMEPLAY (Generating Winners & Losers) ---");
  // Group 1: 20 players bet on number 7 (Winning Group)
  // Group 2: 30 players bet on number 3 (Losing Group)
  
  console.log("Simulating 50 bets on Cash Round...");
  const firstGameplayRound = await game.currentCashRoundId();
  console.log(`Current Cash Round: ${firstGameplayRound}`);

  for (let i = 0; i < 20; i++) {
    await router.connect(massUsers[i]).placeBetCash(7, ethers.parseUnits("10", 18));
  }
  for (let i = 20; i < 50; i++) {
    await router.connect(massUsers[i]).placeBetCash(3, ethers.parseUnits("10", 18));
  }

  console.log(`Admin closing Cash Round ${firstGameplayRound} with winning number 7...`);
  await router.connect(owner).closeRound(7, true);

  console.log(`Winners claiming 8X payout for Round ${firstGameplayRound}...`);
  for (let i = 0; i < 20; i++) {
    await router.connect(massUsers[i]).claimWinnings(firstGameplayRound, true);
  }
  console.log("✅ Game round complete. Check 'Income' page for Winner Income distribution.");

  await ask("Check User1's balance if they were in the referral chain. Press Enter for Cashback & Lucky Draw...");

  console.log("\n--- STEP 6: DAILY CASHBACK (Volume Test) ---");
  // Losers claim cashback
  console.log(" Losers claiming Daily Cashback...");
  const cashbackRound = await game.currentCashRoundId();
  console.log(`Using Round ${cashbackRound} for cashback simulation`);

  for (let i = 20; i < 30; i++) {
    const loser = massUsers[i];
    // Loser already lost 10 in Step 5. Now lose 90 more to hit the 100 threshold.
    await router.connect(loser).placeBetCash(0, ethers.parseUnits("90", 18));
  }
  
  await router.connect(owner).closeRound(1, true); // Admin closes round with winning number 1

  for (let i = 20; i < 30; i++) {
    const loser = massUsers[i];
    await router.connect(loser).claimDailyCashback();
    if (i % 2 === 0) console.log(`   User ${i} claimed daily cashback.`);
  }
  console.log("✅ Daily Cashback triggered for 10 losers.");

  console.log("\n--- STEP 7: MASS LUCKY DRAW TICKET SALES ---");
  console.log("All 150 users buying 1 ticket each to populate Lucky Draw Table...");
  for (let i = 0; i < TOTAL_MASS_USERS; i++) {
    const user = massUsers[i];
    await usdt.connect(user).approve(ADDR.LUCKY, ethers.MaxUint256);
    await router.connect(user).buyLuckyTickets(1, 1); // Golden
    if (i % 50 === 0) console.log(`   Purchased ${i} tickets...`);
  }

  console.log("Admin triggering Lucky Draw manually...");
  await router.connect(owner).adminTriggerLuckyDraw(1);
  console.log("✅ Lucky Draw executed for 150 participants.");

  await ask("Check 'Lucky Draw' page. You should see a long list of previous winners. Press Enter for Club Pool...");

  console.log("\n--- STEP 8: CLUB POOL DISTRIBUTION (150 addresses) ---");
  console.log("Distributing 2 USDT each to ALL 150 users from Club Pool...");
  const winners = massUsers.map(u => u.address);
  const amounts = massUsers.map(() => ethers.parseUnits("2", 18));
  
  // Split into chunks of 50 to avoid block gas limit (even on local)
  const chunkSize = 50;
  for (let i = 0; i < winners.length; i += chunkSize) {
    const wChunk = winners.slice(i, i + chunkSize);
    const aChunk = amounts.slice(i, i + chunkSize);
    await router.connect(owner).distributeClubIncome(wChunk, aChunk);
    console.log(`   Distributed club income to chunk starting at ${i}...`);
  }

  console.log("\n--- 🎇 TOTAL MASS SEEDING COMPLETE 🎇 ---");
  console.log("150 Users Fully Active.");
  console.log("Referral Tree: Check");
  console.log("Total Volume: Check");
  console.log("Game History: Check");
  console.log("Winner Income: Check");
  console.log("Daily Cashback: Check");
  console.log("Lucky Draw History: Check");
  console.log("Club Pool distribution: Check");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
