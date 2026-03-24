// import pkg from "hardhat";
// import { formatUnits, parseUnits } from "ethers";
// import * as fs from "fs";
// import * as path from "path";
// const { ethers } = pkg;

// function getContractAddresses() {
//   const file = fs.readFileSync(path.join(process.cwd(), "src/config/contractAddresses.ts"), "utf8");
//   const parseAddr = (key: string) => {
//     const regex = new RegExp(`${key}:\\s*'([^']+)'`);
//     const match = file.match(regex);
//     return match ? match[1] : null;
//   };
//   return {
//     USDT: parseAddr("USDT"),
//     ROUTER: parseAddr("ROUTER"),
//     REGISTRY: parseAddr("REGISTRY"),
//     TREASURY: parseAddr("TREASURY"),
//     GAME: parseAddr("GAME"),
//     LUCKY_DRAW: parseAddr("LUCKY_DRAW"),
//     CASHBACK: parseAddr("CASHBACK"),
//   };
// }

// async function main() {
//   console.log("🚀 Starting Mesh Referral System Test Generation...\n");

//   const addresses = getContractAddresses();
//   if (!addresses.ROUTER || !addresses.USDT || !addresses.REGISTRY || !addresses.TREASURY || !addresses.GAME) {
//     throw new Error("Could not parse contract addresses from src/config/contractAddresses.ts");
//   }

//   const [admin] = await ethers.getSigners();
//   const provider = admin.provider!;

//   const usdt      = await ethers.getContractAt("MockUSDT",          addresses.USDT,       admin);
//   const router    = await ethers.getContractAt("TRKRouter",          addresses.ROUTER,     admin);
//   const registry  = await ethers.getContractAt("TRKUserRegistry",    addresses.REGISTRY,   admin);
//   const gameEngine= await ethers.getContractAt("TRKGameEngine",      addresses.GAME,       admin);
//   const treasury  = await ethers.getContractAt("TRKTreasury",        addresses.TREASURY,   admin);
//   const cashback  = await ethers.getContractAt("TRKCashbackEngine",  addresses.CASHBACK!,  admin);

//   console.log("Root Admin Address:", admin.address);

//   // ─── 1. Register & Fund Admin ──────────────────────────────────────────────
//   const adminInfo = await registry.users(admin.address);
//   if (!adminInfo.isRegistered) {
//     console.log("Registering Root Admin...");
//     await (await router.register(ethers.ZeroAddress)).wait();
//   }
//   if (adminInfo.cumulativeDeposit < parseUnits("100", 18)) {
//     console.log("Admin needs 100 USDT deposit. Funding & Depositing...");
//     await (await usdt.faucet()).wait();
//     await (await usdt.approve(addresses.TREASURY, ethers.MaxUint256)).wait();
//     await (await router.depositCashGame(parseUnits("100", 18))).wait();
//   }

//   // ─── 2. Generate & Fund Wallets ────────────────────────────────────────────
//   const NUM_WALLETS = 40; // 15 directs + 25 deep chain
//   const wallets: any[] = [];
//   console.log(`\n⏳ Generating and funding ${NUM_WALLETS} test wallets...`);
//   for (let i = 0; i < NUM_WALLETS; i++) {
//     const w = ethers.Wallet.createRandom().connect(provider);
//     wallets.push(w);
//     const tx = await admin.sendTransaction({ to: w.address, value: parseUnits("0.1", "ether") });
//     await tx.wait();
//   }

//   // ─── 3. Register, Deposit, and Place FIRST BETS (all bet on 3) ────────────
//   console.log(`\n🕸️  Creating Referral Mesh...`);
//   const winRoundId = await gameEngine.currentCashRoundId();

//   for (let i = 0; i < NUM_WALLETS; i++) {
//     const user = wallets[i];
//     const referrer = i >= 15 ? wallets[i - 1].address : admin.address;
//     try {
//       await (await usdt.connect(user).faucet()).wait();
//       await (await usdt.connect(user).approve(addresses.TREASURY, ethers.MaxUint256)).wait();
//       await (await router.connect(user).register(referrer)).wait();
//       await (await router.connect(user).depositCashGame(parseUnits("100", 18), { gasLimit: 5_000_000 })).wait();
//       // Each user bets 10 USDT on 3 (will win)
//       await (await router.connect(user).placeBetCash(3, parseUnits("10", 18), { gasLimit: 5_000_000 })).wait();
//       console.log(`✅ [${i+1}/${NUM_WALLETS}] Wallet setup complete (Referred by: ${i < 15 ? "ADMIN" : "W"+(i)})`);
//     } catch (e: any) {
//       console.error(`❌ Error setting up wallet ${i}:`, e.message);
//     }
//   }

//   // ─── 4. Close WINNING round (number 3 → everyone wins) ────────────────────
//   console.log("\n🎲 Closing Round 1 — Winning Number: 3 (Everyone Wins!)");
//   await (await router.closeRound(3, true, { gasLimit: 3_000_000 })).wait();

//   console.log("💰 Claiming 8X winnings for all users...");
//   for (let i = 0; i < NUM_WALLETS; i++) {
//     try {
//       await (await router.connect(wallets[i]).claimWinnings(winRoundId, true, { gasLimit: 3_000_000 })).wait();
//     } catch (e: any) {
//       console.error(`   ❌ User ${i+1} failed to claim:`, e.message);
//     }
//   }
//   console.log(`   ✅ All ${NUM_WALLETS} users claimed 8X winnings!\n`);

//   // ─── 5. LOSING ROUND — everyone bets on 3, winning number is 7 ────────────
//   // This creates net losses ≥ 100 USDT for each user, enabling daily cashback
//   console.log("🎲 Starting Round 2 — LOSING round to seed Lucky Draw Wallet...");
//   const loseRoundId = await gameEngine.currentCashRoundId();

//   for (let i = 0; i < NUM_WALLETS; i++) {
//     try {
//       // Place a 100 USDT losing bet (on number 3, but winning will be 7)
//       await (await router.connect(wallets[i]).placeBetCash(3, parseUnits("100", 18), { gasLimit: 3_000_000 })).wait();
//     } catch (e: any) {
//       console.error(`   ❌ Losing bet error for user ${i+1}:`, e.message);
//     }
//   }

//   console.log("   Closing Round 2 — Winning Number: 7 (Everyone LOSES!)");
//   await (await router.closeRound(7, true, { gasLimit: 3_000_000 })).wait();
//   console.log("   ✅ Losing round closed. All users now have 100 USDT net losses.\n");

//   // ─── 6. Claim Loss Cashback (funds protectionPool → luckyDrawWallet)  ─────
//   console.log("🔁 Claiming loss cashback for all users (seeds Lucky Draw Wallet)...");
//   for (let i = 0; i < NUM_WALLETS; i++) {
//     try {
//       await (await router.connect(wallets[i]).claimImmediateLoss(loseRoundId, true, { gasLimit: 3_000_000 })).wait();
//     } catch (e: any) {
//       // silently skip — some may not qualify or already claimed
//     }
//   }
//   console.log("   ✅ Loss cashback claimed.\n");

//   // ─── 7. Admin directly buys Lucky Draw tickets (funds the prize pool) ─────
//   console.log("🎟️  Admin buying Lucky Draw tickets to seed the prize pool...");
//   try {
//     // Ensure admin has enough USDT
//     await (await usdt.faucet()).wait();
//     await (await usdt.approve(addresses.LUCKY_DRAW!, parseUnits("500", 18))).wait();
//     // Admin buys 20 tickets @ 10 USDT each via router (real USDT)
//     await (await router.buyLuckyTickets(20, { gasLimit: 3_000_000 })).wait();
//     // Approve treasury for router call
//     await (await usdt.approve(addresses.TREASURY, ethers.MaxUint256)).wait();
//     console.log("   ✅ Admin purchased 20 Lucky Draw tickets (200 USDT deposited into prize pool).\n");
//   } catch (e: any) {
//     console.error("   ❌ Admin ticket buy failed:", e.message);
//   }

//   // ─── 8. Users with winnings also buy Lucky Draw tickets ───────────────────
//   console.log("🎟️  First 15 users buying Lucky Draw tickets...");
//   for (let i = 0; i < Math.min(15, NUM_WALLETS); i++) {
//     try {
//       // Each user approves and buys 2 tickets (20 USDT) from their USDT balance
//       await (await usdt.connect(wallets[i]).approve(addresses.LUCKY_DRAW!, parseUnits("30", 18))).wait();
//       await (await router.connect(wallets[i]).buyLuckyTickets(2, { gasLimit: 3_000_000 })).wait();
//       console.log(`   🎟️  User ${i+1} bought 2 tickets!`);
//     } catch (e: any) {
//       console.error(`   ❌ User ${i+1} ticket buy failed:`, e.message);
//     }
//   }

//   // ─── 9. MASS TICKET TEST: Buy remaining tickets to reach 10,000 ─────────────
//   console.log("\n🚀 Starting Mass Ticket Test (Target: 10,000 tickets)...");
  
//   // Diagnostic Check
//   if (!addresses.LUCKY_DRAW) throw new Error("LUCKY_DRAW address not found");
//   const luckyAuthorized = await registry.isAuthorized(addresses.LUCKY_DRAW);
//   console.log(`🔍 Registry Auth Check (LuckyDraw): ${luckyAuthorized ? "Authorized ✅" : "NOT AUTHORIZED ❌"}`);
  
//   const statsBefore = await router.getLuckyDrawStats();
//   const soldSoFar = Number(statsBefore.ticketsSold);
//   const target = 10000;
//   const needed = target - soldSoFar;

//   if (needed > 0) {
//     console.log(`⏳ Buying ${needed} more tickets in batches of 500...`);
//     // ensure admin has enough balance
//     const currentBal = (await registry.users(admin.address)).luckyDrawWallet;
//     const neededUSDT = parseUnits((needed * 10).toString(), 18);
//     if (currentBal < neededUSDT) {
//         process.stdout.write("   🔹 Seeding admin lucky draw wallet... ");
//         await (await registry.addLuckyDrawWallet(admin.address, neededUSDT)).wait();
//         console.log("Done ✅");
//     }

//     let remaining = needed;
//     while (remaining > 0) {
//       const batch = Math.min(remaining, 500);
//       process.stdout.write(`   🔹 Buying batch of ${batch}... `);
      
//       try {
//         // Stay within typical Hardhat tx gas cap (16,777,216)
//         const gasLimit = 16_700_000;
//         const tx = await router.buyLuckyTicketsVirtual(batch, { gasLimit });
//         await tx.wait();
//         remaining -= batch;
//         console.log(`(${needed - remaining}/${needed} done)`);
//       } catch (e: any) {
//         console.log("\n❌ Transaction failed!");
//         if (e.message.includes("out of gas")) {
//             console.error("   Reason: Out of Gas. 1000 winner distributions is very heavy.");
//         } else if (e.stack && e.stack.includes("Transaction reverted")) {
//             console.error("   Revert detected.");
//         }
//         console.error("   Error Details:", e.message);
//         break; 
//       }
//     }
//   }

//   // ─── 10. Admin Force Draw Test (if not already triggered) ───────────────────
//   const finalLuckyStats = await router.getLuckyDrawStats();
//   if (Number(finalLuckyStats.ticketsSold) > 0) {
//     console.log("\n🎰 Testing Admin Force Draw...");
//     try {
//       await (await router.adminTriggerLuckyDraw({ gasLimit: 16_700_000 })).wait();
//       console.log("✅ Admin Force Draw successful!");
//     } catch (e: any) {
//       console.error("❌ Admin Force Draw failed:", e.message);
//     }
//   } else {
//      console.log("\n✨ Draw was already triggered automatically or reset.");
//   }

//   // ─── 11. Verification ───────────────────────────────────────────────────────
//   console.log("\n📊 --- FINAL VERIFICATION ---");
//   const finalAdminInfo = await registry.users(admin.address);
//   const luckyStats = await router.getLuckyDrawStats();

//   console.log(`Current Draw ID:        ${luckyStats.drawId.toString()}`);
//   console.log(`Tickets Sold:           ${luckyStats.ticketsSold.toString()}`);
//   console.log(`Prize Pool Balance:     ${Number(formatUnits(luckyStats.prizePoolBalance, 18)).toFixed(2)} USDT`);
//   console.log(`Admin Lucky Income:     ${Number(formatUnits(finalAdminInfo.luckyDrawIncome, 18)).toFixed(4)} USDT`);

//   console.log("\n🎉 TEST COMPLETE!");
// }

// main().catch(console.error);
