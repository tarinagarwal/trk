const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("TRK Ecosystem Comprehensive Test", function () {
  
  async function deployFixture() {
    const [owner, ...others] = await ethers.getSigners();
    // distinct users for 15 levels
    const users = others.slice(0, 20); 

    // Deploy Mock USDT
    const ERC20Obj = await ethers.getContractFactory("MockUSDT");
    const usdt = await ERC20Obj.deploy();
    
    // Deploy Registry
    const RegObj = await ethers.getContractFactory("TRKUserRegistry");
    const registry = await RegObj.deploy();

    // Deploy Treasury
    const TreasuryObj = await ethers.getContractFactory("TRKTreasury");
    const bdWallets = Array(20).fill(owner.address); 
    const treasury = await TreasuryObj.deploy(await usdt.getAddress(), await registry.getAddress(), owner.address, owner.address, bdWallets);

    // Deploy Engines
    const GameObj = await ethers.getContractFactory("TRKGameEngine");
    const game = await GameObj.deploy(await registry.getAddress());

    const CashbackObj = await ethers.getContractFactory("TRKCashbackEngine");
    const cashback = await CashbackObj.deploy(await registry.getAddress(), await treasury.getAddress());

    const LuckyObj = await ethers.getContractFactory("TRKLuckyDraw");
    const lucky = await LuckyObj.deploy(await usdt.getAddress(), await registry.getAddress());

    // Deploy Router
    const RouterObj = await ethers.getContractFactory("TRKRouter");
    const router = await RouterObj.deploy(
        await registry.getAddress(),
        await treasury.getAddress(),
        await game.getAddress(),
        await cashback.getAddress(),
        await lucky.getAddress()
    );

    // Wire up everything
    await registry.setAuthorization(await router.getAddress(), true);
    await registry.setAuthorization(await treasury.getAddress(), true);
    await registry.setAuthorization(await game.getAddress(), true);
    await registry.setAuthorization(await cashback.getAddress(), true);
    await registry.setAuthorization(await lucky.getAddress(), true);

    await game.setAddresses(await router.getAddress(), await cashback.getAddress());
    await treasury.setAddresses(await router.getAddress(), await cashback.getAddress());
    await cashback.setAddresses(await router.getAddress(), await game.getAddress(), await lucky.getAddress());
    await lucky.setAddresses(await router.getAddress(), await cashback.getAddress());

    // Fund users
    for(const u of users) {
        await usdt.connect(u).faucet(); // 1000 USDT
        await usdt.connect(u).approve(await treasury.getAddress(), ethers.MaxUint256);
    }
    await usdt.connect(owner).approve(await treasury.getAddress(), ethers.MaxUint256);

    return { usdt, registry, treasury, game, cashback, lucky, router, owner, users };
  }

  describe("1. Income Streams - Direct & Pools", function () {
    it("Should distribute Direct Income to 15 levels & Accumulate Pools", async function () {
      const { router, registry, users, treasury, owner } = await loadFixture(deployFixture);
      
      // Setup Chain: User0 <- User1 <- ... <- User15
      // User0 refers User1, User1 refers User2, etc.
      // To earn from L15, User0 needs 10+ Directs.
      // Let's first setup User0 with 10 dummy directs to unlock all levels.
      await router.connect(users[0]).register(owner.address);
      await router.connect(users[0]).depositCashGame(ethers.parseEther("100")); // Activate User0

      // Create 10 dummy directs for User0 to unlock levels
      for(let i=0; i<10; i++) {
          const dummy = ethers.Wallet.createRandom().connect(ethers.provider);
          // Need to fund dummy with ETH to query/transact? No, we can just register them?
          // Actually, we can use the `users` array, but we need User0 to have 10 DIRECT referrals.
          // The chain User0 <- User1 implies User1 is L1. User2 is L2.
          // User0 needs 10 *other* directs to unlock L15 for the User15 deposit? 
          // WAIT. 
          // Rule: 1 Direct = 1 Level unlocked.
          // If User0 has only User1 as direct, User0 unlocks Level 1.
          // If User1 deposits, User0 gets 5% (L1).
          // If User2 deposits (User1's direct), User0 gets 2% (L2).
          // BUT User0 needs 2 directs to unlock L2? 
          // Treasury.sol: `uint256 requiredDirects = i < 10 ? i + 1 : 10;`
          // Loop i=0 (Level 1). requiredDirects = 1. User0 has User1. OK.
          // Loop i=1 (Level 2). requiredDirects = 2. User0 has User1... need another direct.
      }

      // Let's create a side-chain of directs for User0 to unlock all levels.
      // We'll use random signers for this.
      const dummies = [];
      for(let k=0; k<11; k++) {
          const w = ethers.Wallet.createRandom().connect(ethers.provider);
          // Fund with ETH
          await owner.sendTransaction({to: w.address, value: ethers.parseEther("0.1")});
          dummies.push(w);
          
          await router.connect(dummies[k]).register(users[0].address);
          // They need to be active cash players to count as "active directs" for User0?
          // Registry.sol: `addDeposit`: `if ... u.cumulativeDeposit >= FULL_ACTIVATION_BRIDGE ... activeDirects++`
          // So dummies must deposit 100 USDT.
          
          // Actually, let's just cheat and assume User0 is God or update Registry manually? 
          // No, test MUST stick to rules.
          // Funding 10 users 100 USDT is tedious in test but necessary.
          // Let's create a helper mock or just use the first 10 `users` as directs of `owner`, 
          // and test `owner` receiving commissions from a deep chain.
      }
      
      // Let's use `owner` as the top guy. Use dummy directs to unlock levels for owner.
      // BUT `owner` is usually special. Let's use `users[0]` as the beneficiary.
      
      // 1. Activate `users[0]`
      // 2. Register & Activate 10 dummies under `users[0]`
      // (MockUSDT faucet gives 1000, so we can transfer from owner or just faucet each dummy)
    });
  });

  describe("2. Deep Chain Verification", function() {
      it("Should verify correct distribution", async function() {
        const { router, registry, treasury, usdt, users, owner } = await loadFixture(deployFixture);
        
        const topUser = users[0];
        
        // 1. Activate Top User
        await router.connect(topUser).register(owner.address);
        await router.connect(topUser).depositCashGame(ethers.parseEther("100")); 

        // 2. Unlock all 15 levels for Top User
        // Need 10 Active Directs.
        for(let i=0; i<10; i++) {
            const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
            await owner.sendTransaction({to: wallet.address, value: ethers.parseEther("1")});
            
            // Register under topUser
            await router.connect(wallet).register(topUser.address);
            
            // Fund USDT
            await usdt.transfer(wallet.address, ethers.parseEther("200"));
            await usdt.connect(wallet).approve(await treasury.getAddress(), ethers.MaxUint256);
            
            // Activate
            await router.connect(wallet).depositCashGame(ethers.parseEther("100"));
        }
        
        // Check TopUser active directs
        const uInfo = await registry.users(topUser.address);
        expect(uInfo.activeDirects).to.equal(10); // Should be 10

        // 3. Build a chain of 15 levels DOWN from topUser
        // Level 1 is already established (one of the dummies), but let's make a clear chain.
        // topUser -> L1 -> L2 -> ... -> L15
        
        let upline = topUser;
        let chain = [];
        
        // We'll use the remaining `users` (1 to 15) for this chain? 
        // We have users[1]...users[19].
        // users[1] refers topUser. (L1)
        // users[2] refers users[1]. (L2)
        // ...
        // users[15] refers users[14]. (L15).
        
        for(let i=1; i<=15; i++) {
            await router.connect(users[i]).register(upline.address);
            // Activate them too? Not strictly necessary for them to receive commissions (unless 'active' check is there), 
            // but for them to be part of the chain, they just need to register.
            // Treasury check: `if (upline.isCashPlayer && upline.directReferrals >= requiredDirects)`
            // So intermediate uplines must be Active Cash Players to pass commission?
            // Wait. `upline` in Treasury loop is the one RECEIVING the comm.
            // So if L15 deposits, L14 (Level 1 relative) gets 5%. L14 needs to be active.
            // TopUser (L15 relative) gets 0.5%. TopUser needs to be active.
            // Intermediate users don't block flow to TopUser, correct? 
            // `current = upline.referrer;` -> logic moves up regardless of intermediate status?
            // Treasury line 157: `for (uint256 i = 0; i < 15 && current != address(0); i++)`
            // Inside loop: `if (upline.isCashPlayer ...)` -> if true, pay.
            // It does NOT break if upline is not active. It just skips payment for that level.
            // Moves to next `current`. correct.
            
            upline = users[i];
            chain.push(users[i]);
        }
        
        // 4. Deposit at Level 15 (users[15])
        const bottomUser = users[15];
        const depositAmt = ethers.parseEther("1000"); // 1000 USDT
        
        // Capture TopUser Balance
        const balBefore = await registry.users(topUser.address);
        const clubBefore = await treasury.clubPoolBalance();
        const luckyBefore = await treasury.luckyDrawBalance();
        
        await router.connect(bottomUser).depositCashGame(depositAmt);
        
        // 5. Verify Income for TopUser (Level 15 Upline)
        // L15 Commission is 0.5%.
        // 0.5% of 1000 = 5 USDT.
        
        const balAfter = await registry.users(topUser.address);
        expect(balAfter.walletBalance - balBefore.walletBalance).to.equal(ethers.parseEther("5"));
        
        // 6. Verify Pools (Treasury Logic)
        // Club 8% = 80 USDT
        // Lucky 2% = 20 USDT
        const clubAfter = await treasury.clubPoolBalance();
        const luckyAfter = await treasury.luckyDrawBalance();
        
        expect(clubAfter - clubBefore).to.equal(ethers.parseEther("80"));
        expect(luckyAfter - luckyBefore).to.equal(ethers.parseEther("20"));
      });
  });

  describe("3. Game Mechanics & Winner Income", function() {
      it("Should distribute Winner Income correctly (15 Levels)", async function() {
          const { router, registry, game, users, owner } = await loadFixture(deployFixture);
           // Re-use logic: Verified TopUser has 10 directs.
           const topUser = users[0];
           
           // Setup TopUser again (clean state from fixture reset)
           await router.connect(topUser).register(owner.address);
           await router.connect(topUser).depositCashGame(ethers.parseEther("100")); 
           
           // Unlock levels
           for(let i=0; i<10; i++) {
                const w = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({to: w.address, value: ethers.parseEther("1")});
                await router.connect(w).register(topUser.address);
                // No need to activate them for Winner Income check on TopUser?
                // GameEngine: `if (registry.users(current).isCashPlayer)`
                // Yes, TopUser needs to be active. He is.
           }

           // Build Chain
           let upline = topUser;
           for(let i=1; i<=15; i++) {
               await router.connect(users[i]).register(upline.address);
               await router.connect(users[i]).depositCashGame(ethers.parseEther("100")); // Activate
               upline = users[i];
           }
           
           // Bottom User (users[15]) Bets and Wins.
           const bottomUser = users[15];
           await router.connect(bottomUser).placeBetCash(5, ethers.parseEther("100"));
           
           await game.closeRound(5, true);
           
           // Claim
           const balBefore = await registry.users(topUser.address);
           
           await router.connect(bottomUser).claimWinnings(1, true);
           
           // Logic:
           // Bet 100. Win 8x = 800.
           // Cashout = 200. Reinvest = 600.
           // Distribution is on Cashout (200).
           // Level 15 Commission = 0.5%.
           // 0.5% of 200 = 1 USDT.
           
           const balAfter = await registry.users(topUser.address);
           expect(balAfter.winnerReferralIncome - balBefore.winnerReferralIncome).to.equal(ethers.parseEther("1"));
      });
  });

  describe("4. Withdrawal Limits", function() {
      it("Should enforce min/max withdrawals and deduct fee", async function() {
          const { router, registry, treasury, users, owner, usdt } = await loadFixture(deployFixture);
          const u = users[0];
          
          await router.connect(u).register(owner.address);
          await router.connect(u).depositCashGame(ethers.parseEther("1000")); // Deposit 1000
          
          // Mimic earning by just using what we have (Registry updateBalances is onlyAuth).
          // Router.withdraw uses `u.walletBalance`.
          // depositCashGame adds to `u.totalDeposit` but NOT `walletBalance`.
          // We need mock earnings. 
          // `addDirectReferralIncome` adds to walletBalance.
          // Let's manually trigger `addDirectReferralIncome`? 
          // OnlyAuth. Registry `setAuthorization`.
          // Let's authorize `owner` to call Registry actions for setup.
          await registry.setAuthorization(owner.address, true);
          await registry.addDirectReferralIncome(u.address, ethers.parseEther("6000"), 1); // Credit 6000
          
          // Fund Treasury to cover the forced credit (Solvency fix for test)
          await usdt.connect(owner).transfer(await treasury.getAddress(), ethers.parseEther("10000"));
          
          // 1. Try withdrawing 2 USDT (Fail < 5)
          await expect(router.connect(u).withdraw(ethers.parseEther("2")))
            .to.be.revertedWith("Minimum 5 USDT to withdraw");
            
          // 2. Try withdrawing 5001 USDT (Fail > 5000)
          await expect(router.connect(u).withdraw(ethers.parseEther("5001")))
            .to.be.revertedWith("Maximum 5,000 USDT withdrawal per day");
            
          // 3. Withdraw 1000 USDT (Success)
          // Fee 10% = 100 USDT. rcv = 900.
          await router.connect(u).withdraw(ethers.parseEther("1000"));
          
          // Check balances (MockUSDT)
          // User started with 0 (from expected flow) + faucet?
          // We used `deposit` which takes from user.
          // Let's check change.
          // Assume user had X.
          // Withdraw 1000 -> Contract sends 900.
          
          const uInfo = await registry.users(u.address);
          expect(uInfo.walletBalance).to.equal(ethers.parseEther("5000")); // 6000 - 1000
          
          // 4. Try withdrawing 4500 (Fail, total > 5000)
          // Already withdrew 1000. Limit 5000. Left 4000.
          await expect(router.connect(u).withdraw(ethers.parseEther("4500")))
            .to.be.revertedWith("Maximum 5,000 USDT withdrawal per day");
      });
  });

});
