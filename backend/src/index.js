const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { watchEvents } = require('./watcher');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const BASELINE_FILE = path.join(__dirname, '..', 'soft-reset-baseline.json');

// Only show data from March 24, 2026 1:42 PM UTC onwards
const DATA_CUTOFF_TIMESTAMP = 1774359720;

const normalizeAddress = (address) => (typeof address === 'string' ? address.toLowerCase() : address);
const addressVariants = (address) => {
  const raw = typeof address === 'string' ? address : '';
  const lower = normalizeAddress(address);
  if (!raw) return [];
  return raw === lower ? [raw] : [raw, lower];
};

const toBigIntSafe = (value) => {
  try {
    return BigInt(value ?? 0);
  } catch {
    return BigInt(0);
  }
};

const diffNonNegative = (current, baseline) => {
  const cur = toBigIntSafe(current);
  const base = toBigIntSafe(baseline);
  return cur > base ? (cur - base) : BigInt(0);
};

const readBaselineSnapshot = () => {
  try {
    if (!fs.existsSync(BASELINE_FILE)) return null;
    const raw = fs.readFileSync(BASELINE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeBaselineSnapshot = (snapshot) => {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(snapshot, null, 2));
};

const buildOnchainOverviewSnapshot = async () => {
  const { createPublicClient, http } = require('viem');
  const { bsc } = require('viem/chains');

  const client = createPublicClient({
    chain: bsc,
    transport: http(process.env.RPC_URL)
  });

  const TRKRouterABI = require('./abis/TRKRouter.json');
  const TRKGameEngineABI = require('./abis/TRKGameEngine.json');
  const TRKLuckyDrawABI = require('./abis/TRKLuckyDraw.json');

  const [platformStats, pools, pId, cId, goldenDraw, silverDraw] = await Promise.all([
    client.readContract({
      address: process.env.ROUTER_ADDRESS,
      abi: TRKRouterABI.abi,
      functionName: 'getPlatformStats'
    }),
    client.readContract({
      address: process.env.ROUTER_ADDRESS,
      abi: TRKRouterABI.abi,
      functionName: 'getPools'
    }),
    client.readContract({
      address: process.env.GAME_ADDRESS,
      abi: TRKGameEngineABI.abi,
      functionName: 'currentPracticeRoundId'
    }),
    client.readContract({
      address: process.env.GAME_ADDRESS,
      abi: TRKGameEngineABI.abi,
      functionName: 'currentCashRoundId'
    }),
    client.readContract({
      address: process.env.ROUTER_ADDRESS,
      abi: TRKRouterABI.abi,
      functionName: 'getLuckyDrawStats',
      args: [1]
    }),
    client.readContract({
      address: process.env.ROUTER_ADDRESS,
      abi: TRKRouterABI.abi,
      functionName: 'getLuckyDrawStats',
      args: [0]
    })
  ]);

  const users = platformStats?.[0] ?? 0n;
  const volume = platformStats?.[1] ?? 0n;
  const withdrawn = platformStats?.[2] ?? 0n;

  return {
    timestamp: Math.floor(Date.now() / 1000),
    stats: {
      users: users.toString(),
      volume: volume.toString(),
      withdrawn: withdrawn.toString(),
    },
    pools: (pools || []).map((p) => p.toString()),
    rounds: {
      practiceId: (pId ?? 0n).toString(),
      cashId: (cId ?? 0n).toString(),
    },
    lucky: {
      golden: {
        drawId: (goldenDraw?.[0] ?? 0n).toString(),
        ticketsSold: (goldenDraw?.[1] ?? 0n).toString(),
        maxTickets: (goldenDraw?.[2] ?? 0n).toString(),
        prizePool: (goldenDraw?.[3] ?? 0n).toString(),
      },
      silver: {
        drawId: (silverDraw?.[0] ?? 0n).toString(),
        ticketsSold: (silverDraw?.[1] ?? 0n).toString(),
        maxTickets: (silverDraw?.[2] ?? 0n).toString(),
        prizePool: (silverDraw?.[3] ?? 0n).toString(),
      }
    }
  };
};

const normalizeOverview = (current, baseline) => {
  if (!baseline) {
    return {
      stats: { ...current.stats },
      pools: [...(current.pools || [])],
      rounds: { ...current.rounds },
      lucky: {
        golden: { ...current.lucky.golden },
        silver: { ...current.lucky.silver },
      }
    };
  }

  const pools = Array.from({ length: 9 }, (_, i) => {
    const cur = current.pools?.[i] ?? '0';
    const base = baseline.pools?.[i] ?? '0';
    return diffNonNegative(cur, base).toString();
  });

  return {
    stats: {
      users: diffNonNegative(current.stats?.users, baseline.stats?.users).toString(),
      volume: diffNonNegative(current.stats?.volume, baseline.stats?.volume).toString(),
      withdrawn: diffNonNegative(current.stats?.withdrawn, baseline.stats?.withdrawn).toString(),
    },
    pools,
    rounds: {
      practiceId: diffNonNegative(current.rounds?.practiceId, baseline.rounds?.practiceId).toString(),
      cashId: diffNonNegative(current.rounds?.cashId, baseline.rounds?.cashId).toString(),
    },
    lucky: {
      golden: {
        drawId: diffNonNegative(current.lucky?.golden?.drawId, baseline.lucky?.golden?.drawId).toString(),
        ticketsSold: diffNonNegative(current.lucky?.golden?.ticketsSold, baseline.lucky?.golden?.ticketsSold).toString(),
        maxTickets: (current.lucky?.golden?.maxTickets ?? '0').toString(),
        prizePool: diffNonNegative(current.lucky?.golden?.prizePool, baseline.lucky?.golden?.prizePool).toString(),
      },
      silver: {
        drawId: diffNonNegative(current.lucky?.silver?.drawId, baseline.lucky?.silver?.drawId).toString(),
        ticketsSold: diffNonNegative(current.lucky?.silver?.ticketsSold, baseline.lucky?.silver?.ticketsSold).toString(),
        maxTickets: (current.lucky?.silver?.maxTickets ?? '0').toString(),
        prizePool: diffNonNegative(current.lucky?.silver?.prizePool, baseline.lucky?.silver?.prizePool).toString(),
      }
    }
  };
};

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- SYNC ENDPOINTS ---

// Sync Registration
app.post('/api/sync/register', async (req, res) => {
  const { address, referrer, userId, hash, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  const normalizedReferrer = referrer ? normalizeAddress(referrer) : '0x0000000000000000000000000000000000000000';
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: { isRegistered: true, referralCode: userId.toString(), referrer: normalizedReferrer },
      create: { address: normalizedAddress, isRegistered: true, referralCode: userId.toString(), referrer: normalizedReferrer }
    });

    const reg = await prisma.registration.upsert({
      where: { address: normalizedAddress },
      update: { hash, timestamp: parseInt(timestamp) || Math.floor(Date.now() / 1000) },
      create: { 
        address: normalizedAddress,
        referrer: normalizedReferrer,
        userId: parseInt(userId) || 0, 
        hash, 
        timestamp: parseInt(timestamp) || Math.floor(Date.now() / 1000) 
      }
    });
    res.json({ success: true, reg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Deposit
app.post('/api/sync/deposit', async (req, res) => {
  const { address, hash, amount, creditedToCash, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    // Ensure user exists
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const deposit = await prisma.deposit.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        amount: amount.toString(),
        creditedToCash: creditedToCash.toString(),
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, deposit });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Withdraw
app.post('/api/sync/withdraw', async (req, res) => {
  const { address, hash, totalRequested, fee, amountSent, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const withdraw = await prisma.withdraw.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        totalRequested: totalRequested.toString(),
        fee: fee.toString(),
        amountSent: amountSent.toString(),
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, withdraw });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Lucky Buy
app.post('/api/sync/lucky-buy', async (req, res) => {
  const { address, hash, count, drawId, drawType, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const ticket = await prisma.luckyTicket.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        count: parseInt(count),
        drawId: parseInt(drawId),
        drawType: parseInt(drawType),
        timestamp: parseInt(timestamp)
      }
    });

    // Update global stats
    const statsId = 1;
    const incrementField = drawType === 1 ? 'totalTicketsGolden' : 'totalTicketsSilver';
    await prisma.globalStats.upsert({
      where: { id: statsId },
      update: { [incrementField]: { increment: parseInt(count) } },
      create: { id: statsId, [incrementField]: parseInt(count) }
    });

    res.json({ success: true, ticket });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Bet
app.post('/api/sync/bet', async (req, res) => {
  const { address, hash, amount, prediction, isCash, roundId, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const bet = await prisma.bet.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        amount: amount.toString(),
        prediction: parseInt(prediction),
        isCash: !!isCash,
        roundId: parseInt(roundId) || 0,
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, bet });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Win
app.post('/api/sync/win', async (req, res) => {
  const { address, hash, amount, isCash, roundId, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const win = await prisma.win.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        amount: amount.toString(),
        isCash: !!isCash,
        roundId: parseInt(roundId),
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, win });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Conversion
app.post('/api/sync/convert', async (req, res) => {
  const { address, hash, amount, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const conversion = await prisma.conversion.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        amount: amount.toString(),
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, conversion });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Practice Reward
app.post('/api/sync/reward', async (req, res) => {
  const { address, from, amount, level, hash, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  const normalizedFrom = normalizeAddress(from);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const reward = await prisma.practiceReward.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        fromAddress: normalizedFrom,
        amount: amount.toString(),
        level: parseInt(level),
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, reward });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Sync Income
app.post('/api/sync/income', async (req, res) => {
  const { address, hash, amount, source, walletType, timestamp } = req.body;
  const normalizedAddress = normalizeAddress(address);
  try {
    await prisma.user.upsert({
      where: { address: normalizedAddress },
      update: {},
      create: { address: normalizedAddress }
    });

    const income = await prisma.income.create({
      data: {
        hash,
        userAddress: normalizedAddress,
        amount: amount.toString(),
        source,
        walletType,
        timestamp: parseInt(timestamp)
      }
    });
    res.json({ success: true, income });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Duplicate transaction' });
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- DATA ENDPOINTS ---

// Get History
app.get('/api/history/:address', async (req, res) => {
  const { address } = req.params;
  const variants = addressVariants(address);
  try {
    // Per-user history: no cutoff filter — users only see their own data
    // (new users registered after the fresh-start won't have old records anyway)
    const deposits = await prisma.deposit.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    const withdrawals = await prisma.withdraw.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    const luckyTickets = await prisma.luckyTicket.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    const bets = await prisma.bet.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    const winnings = await prisma.win.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
    const conversions = await prisma.conversion.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    const incomes = await prisma.income.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    const rewards = await prisma.practiceReward.findMany({
      where: { userAddress: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });
    // Registration record (no cutoff — needed to show signup bonus for all registered users)
    const registration = await prisma.registration.findFirst({
      where: { address: { in: variants } },
      orderBy: { timestamp: 'desc' }
    });

    res.json({
      success: true,
      deposits,
      withdrawals,
      luckyTickets,
      bets,
      winnings,
      conversions,
      incomes,
      rewards,
      registration: registration || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin History (All records)
app.get('/api/admin/history', async (req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });
    const withdrawals = await prisma.withdraw.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });
    const luckyTickets = await prisma.luckyTicket.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });
    const bets = await prisma.bet.findMany({ orderBy: { timestamp: 'desc' }, take: 300 });
    const winnings = await prisma.win.findMany({ orderBy: { timestamp: 'desc' }, take: 300 });
    const conversions = await prisma.conversion.findMany({ orderBy: { timestamp: 'desc' }, take: 300 });
    const incomes = await prisma.income.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });
    const rewards = await prisma.practiceReward.findMany({ orderBy: { timestamp: 'desc' }, take: 500 });

    res.json({
      success: true,
      deposits,
      withdrawals,
      luckyTickets,
      bets,
      winnings,
      conversions,
      incomes,
      rewards
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get Lucky Stats (computed from tickets after cutoff date)
app.get('/api/lucky/stats', async (req, res) => {
  try {
    const tickets = await prisma.luckyTicket.findMany({
      where: { timestamp: { gte: DATA_CUTOFF_TIMESTAMP } },
      select: { count: true, drawType: true }
    });
    const totalTicketsGolden = tickets.filter(t => t.drawType === 1).reduce((acc, t) => acc + t.count, 0);
    const totalTicketsSilver = tickets.filter(t => t.drawType === 0).reduce((acc, t) => acc + t.count, 0);
    res.json({
      success: true,
      stats: { totalTicketsSilver, totalTicketsGolden }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Analytics
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const totalUsers = await prisma.user.count({ where: { isRegistered: true } });
    const deposits = await prisma.deposit.findMany();
    const withdrawals = await prisma.withdraw.findMany();

    const totalVolume = deposits.reduce((acc, d) => acc + BigInt(d.amount), BigInt(0)).toString();
    const totalWithdrawn = withdrawals.reduce((acc, w) => acc + BigInt(w.totalRequested), BigInt(0)).toString();

    res.json({
      success: true,
      totalUsers,
      totalVolume,
      totalWithdrawn
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Users List
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isRegistered: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const usersWithActivity = await Promise.all(
      users.map(async (u) => {
        const address = u.address.toLowerCase();

        const [
          reg,
          dep,
          wd,
          bet,
          win,
          inc,
          lucky,
          reward,
          conv,
        ] = await Promise.all([
          prisma.registration.findFirst({ where: { address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.deposit.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.withdraw.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.bet.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.win.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.income.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.luckyTicket.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.practiceReward.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
          prisma.conversion.findFirst({ where: { userAddress: address }, orderBy: { timestamp: 'desc' }, select: { timestamp: true } }),
        ]);

        const tsValues = [
          reg?.timestamp,
          dep?.timestamp,
          wd?.timestamp,
          bet?.timestamp,
          win?.timestamp,
          inc?.timestamp,
          lucky?.timestamp,
          reward?.timestamp,
          conv?.timestamp,
        ].filter((v) => typeof v === 'number');

        const createdAtTs = Math.floor(new Date(u.createdAt).getTime() / 1000);
        const lastActivityTs = tsValues.length > 0 ? Math.max(...tsValues) : createdAtTs;

        return {
          ...u,
          lastActivityTs,
        };
      })
    );

    usersWithActivity.sort((a, b) => Number(b.lastActivityTs || 0) - Number(a.lastActivityTs || 0));

    res.json({ success: true, users: usersWithActivity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Distributions (Pools)
// These are best read from chain but served via backend as requested
app.get('/api/admin/distributions', async (req, res) => {
  try {
    const { createPublicClient, http } = require('viem');
    const { bsc } = require('viem/chains');
    const client = createPublicClient({ chain: bsc, transport: http(process.env.RPC_URL) });
    
    const TRKGameABI = require('./abis/TRKRouter.json');
    const pools = await client.readContract({
      address: process.env.ROUTER_ADDRESS, // getPools is a Router function
      abi: TRKGameABI.abi,
      functionName: 'getPools'
    });

    res.json({
      success: true,
      pools: pools.map(p => p.toString())
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Draws History (only from cutoff date onwards)
app.get('/api/draws', async (req, res) => {
  try {
    const draws = await prisma.draw.findMany({
      where: { timestamp: { gte: DATA_CUTOFF_TIMESTAMP } },
      orderBy: { block: 'desc' },
      take: 50
    });
    res.json({ success: true, draws });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin Game Status
app.get('/api/admin/game-status', async (req, res) => {
  try {
    const { createPublicClient, http } = require('viem');
    const { bsc } = require('viem/chains');
    const client = createPublicClient({ chain: bsc, transport: http(process.env.RPC_URL) });
    
    const TRKGameEngineABI = require('./abis/TRKGameEngine.json');
    const TRKLuckyDrawABI = require('./abis/TRKLuckyDraw.json');
    const [pId, cId, gDrawId, sDrawId] = await Promise.all([
      client.readContract({ address: process.env.GAME_ADDRESS, abi: TRKGameEngineABI.abi, functionName: 'currentPracticeRoundId' }),
      client.readContract({ address: process.env.GAME_ADDRESS, abi: TRKGameEngineABI.abi, functionName: 'currentCashRoundId' }),
      client.readContract({ address: process.env.LUCKY_DRAW_ADDRESS, abi: TRKLuckyDrawABI.abi, functionName: 'currentDrawId', args: [1] }),
      client.readContract({ address: process.env.LUCKY_DRAW_ADDRESS, abi: TRKLuckyDrawABI.abi, functionName: 'currentDrawId', args: [0] })
    ]);

    res.json({
      success: true,
      practiceId: pId.toString(),
      cashId: cId.toString(),
      goldenDrawId: gDrawId.toString(),
      silverDrawId: sDrawId.toString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Create/refresh soft-reset baseline from current on-chain snapshot
app.post('/api/admin/soft-reset/snapshot', async (req, res) => {
  try {
    const snapshot = await buildOnchainOverviewSnapshot();
    writeBaselineSnapshot(snapshot);
    res.json({ success: true, baseline: snapshot });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get baseline + normalized overview values (current - baseline)
app.get('/api/admin/overview-normalized', async (req, res) => {
  try {
    const baseline = readBaselineSnapshot();
    const current = await buildOnchainOverviewSnapshot();
    const normalized = normalizeOverview(current, baseline);

    res.json({
      success: true,
      baselineExists: !!baseline,
      baseline,
      current,
      normalized
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Rounds History
app.get('/api/rounds', async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      orderBy: { roundId: 'desc' },
      take: 100
    });
    res.json({ success: true, rounds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/api/team/:address', async (req, res) => {
  const { address } = req.params;
  try {
    const allRegs = await prisma.registration.findMany();
    const allRewards = await prisma.practiceReward.findMany({
      where: { userAddress: address }
    });
    
    // Build tree with level breakdown
    const levels = {};
    for (let i = 1; i <= 15; i++) {
        // Calculate bonus for this level from synced rewards
        const levelRewards = allRewards.filter(r => r.level === i);
        const levelBonus = levelRewards.reduce((acc, r) => acc + BigInt(r.amount), BigInt(0));
        
        levels[i] = {
            count: 0,
            bonus: levelBonus.toString()
        };
    }

    // Optimized Tree traversal with map lookup
    const refMap = {};
    allRegs.forEach(r => {
        if (!r.referrer) return;
        const ref = r.referrer.toLowerCase();
        if (!refMap[ref]) refMap[ref] = [];
        refMap[ref].push(r.address.toLowerCase());
    });

    const allMembers = [];
    const fillLevels = (addr, depth = 1) => {
      if (depth > 15) return;
      const direct = refMap[addr.toLowerCase()] || [];
      levels[depth].count += direct.length;
      for (const d of direct) {
        allMembers.push(d);
        fillLevels(d, depth + 1);
      }
    };

    fillLevels(address);
    const directChildren = refMap[address.toLowerCase()] || [];
    const totalCount = Object.values(levels).reduce((a, b) => a + b.count, 0);

    res.json({
      success: true,
      count: totalCount,
      direct: directChildren,
      allMembers,
      levels
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
  if (process.env.ENABLE_EVENT_WATCHER === 'false') {
    console.log('Event watcher disabled via ENABLE_EVENT_WATCHER=false');
    return;
  }

  watchEvents().catch(err => {
    console.error("Failed to start event watcher:", err);
  });
});
