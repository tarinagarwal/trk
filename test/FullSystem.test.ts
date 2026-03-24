const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TRK Ecosystem Full System Test", function () {
  let usdt, registry, treasury, game, cashback, lucky, router;
  let owner, user1, user2, user3;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy Mock USDT
    const ERC20Obj = await ethers.getContractFactory("MockUSDT");
    usdt = await ERC20Obj.deploy();
    
    // Deploy Registry
    const RegObj = await ethers.getContractFactory("TRKUserRegistry");
    registry = await RegObj.deploy();

    // Deploy Treasury
    const TreasuryObj = await ethers.getContractFactory("TRKTreasury");
    const bdWallets = Array(20).fill(owner.address); 
    treasury = await TreasuryObj.deploy(await usdt.getAddress(), await registry.getAddress(), owner.address, owner.address, bdWallets);

    // Deploy Engines
    const GameObj = await ethers.getContractFactory("TRKGameEngine");
    game = await GameObj.deploy(await registry.getAddress());

    const CashbackObj = await ethers.getContractFactory("TRKCashbackEngine");
    cashback = await CashbackObj.deploy(await registry.getAddress(), await treasury.getAddress());

    const LuckyObj = await ethers.getContractFactory("TRKLuckyDraw");
    lucky = await LuckyObj.deploy(await usdt.getAddress(), await registry.getAddress());

    // Deploy Router
    const RouterObj = await ethers.getContractFactory("TRKRouter");
    router = await RouterObj.deploy(
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
    await treasury.setAddresses(await router.getAddress(), await cashback.getAddress(), await lucky.getAddress());
    await cashback.setAddresses(await router.getAddress(), await game.getAddress(), await lucky.getAddress());
    await lucky.setAddresses(await router.getAddress(), await cashback.getAddress(), await treasury.getAddress());

    // Mint USDT to users
    await usdt.connect(user1).faucet(); // 1000 USDT
    await usdt.connect(user2).faucet();
    await usdt.connect(user3).faucet();

    await usdt.connect(user1).approve(await treasury.getAddress(), ethers.MaxUint256);
    await usdt.connect(user2).approve(await treasury.getAddress(), ethers.MaxUint256);
  });

  describe("1. Registration & Practice", function () {
    it("Should register user with 100 USDT practice bonus", async function () {
      await router.connect(user1).register(owner.address); // Referrer is owner
      
      const u = await registry.users(user1.address);
      expect(u.isRegistered).to.be.true;
      expect(u.practiceBalance).to.equal(ethers.parseEther("100"));
    });

    it("Should allow practice bets and process wins (8x)", async function () {
      await router.connect(user1).register(owner.address);

      // Place Bet: 10 USDT on number 5 (Practice)
      await router.connect(user1).placeBetPractice(5, ethers.parseEther("10"));
      
      // Check balance deducted
      let u = await registry.users(user1.address);
      expect(u.practiceBalance).to.equal(ethers.parseEther("90"));

      // Close round with winning number 5
      await router.closeRound(5, false);

      // Claim
      await router.connect(user1).claimWinnings(1, false);

      u = await registry.users(user1.address);
      // 10 * 8 = 80 USDT Win.
      // New Balance = 90 + 80 = 170.
      expect(u.practiceBalance).to.equal(ethers.parseEther("170"));
    });
  });

  describe("2. Cash Game Activation", function () {
    it("Should allow activation with exactly 1 USDT", async function () {
      await router.connect(user1).register(owner.address);

      // Deposit 1 USDT
      await router.connect(user1).depositCashGame(ethers.parseEther("1"));

      const u = await registry.users(user1.address);
      expect(u.isCashPlayer).to.be.true;
      expect(u.totalDeposit).to.equal(ethers.parseEther("1"));
    });

    it("Should distribute direct referral income (5% for L1)", async function () {
      // Setup: user2 refers user1. User2 activates first.
      await router.connect(user2).register(owner.address);
      await router.connect(user2).depositCashGame(ethers.parseEther("100")); // User2 activates

      await router.connect(user1).register(user2.address);
      
      const balBefore = await registry.users(user2.address);
      
      // User1 deposits 100 USDT
      await router.connect(user1).depositCashGame(ethers.parseEther("100"));

      const balAfter = await registry.users(user2.address);
      
      // 5% of 100 = 5 USDT
      // Expect walletBalance to increase by 5
      expect(balAfter.walletBalance - balBefore.walletBalance).to.equal(ethers.parseEther("5"));
    });
  });

  describe("3. Game Mechanics & Income", function () {
    it("Should distribute Winner Income (15% spread)", async function () {
      // User2 refers User1
      await router.connect(user2).register(owner.address);
      await router.connect(user2).depositCashGame(ethers.parseEther("100")); 

      await router.connect(user1).register(user2.address);
      await router.connect(user1).depositCashGame(ethers.parseEther("100"));

      // User1 plays Cash Game: 10 USDT on 7
      // Note: placeBetCash does not take boolean arg in Router, it's specific function
      await router.connect(user1).placeBetCash(7, ethers.parseEther("10"));
      
      // Close round winner 7
      await router.closeRound(7, true);

      // Snapshot User2 balance
      const u2Before = await registry.users(user2.address);

      // User1 Claims
      // Win = 80 USDT. Cashout = 20 USDT (2x). Reinvest = 60 USDT (6x).
      // Referral Comm is on Cashout (20 USDT).
      // L1 gets 5% of 20 = 1 USDT.
      await router.connect(user1).claimWinnings(1, true);

      const u2After = await registry.users(user2.address);
      
      // Check User2 got 1 USDT
      expect(u2After.winnerReferralIncome - u2Before.winnerReferralIncome).to.equal(ethers.parseEther("1"));
    });
  });

  describe("4. Cashback System", function () {
    it("Should allow claiming daily cashback after 100 USDT losses", async function () {
       await router.connect(user1).register(owner.address);
       await router.connect(user1).depositCashGame(ethers.parseEther("200"));

       // Lose 100 USDT (10 bets of 10)
       for(let i=0; i<10; i++) {
         // placeBetCash(prediction, amount)
         await router.connect(user1).placeBetCash(0, ethers.parseEther("10"));
         
         // Close round with 1 (Loss)
         await router.closeRound(1, true);
       }
       
       // Trigger Cashback
       await router.connect(user1).claimDailyCashback();
       
       const u = await registry.users(user1.address);
       expect(u.cashbackIncome).to.be.gt(0);
    });
  });
});
