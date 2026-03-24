const { createPublicClient, http, parseAbiItem } = require("viem");
const { bsc } = require("viem/chains");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("redis");
require("dotenv").config();

const prisma = new PrismaClient();

const client = createPublicClient({
  chain: bsc,
  transport: http(process.env.RPC_URL),
});

// Configure Redis
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));

const lastBlockKey = "trk_last_processed_block";
let startBlock = parseInt(process.env.START_BLOCK || "0");
const blockTimestampCache = new Map();
const DEFAULT_CATCHUP_CHUNK_SIZE = parseInt(
  process.env.CATCHUP_CHUNK_SIZE || "500",
  10,
);
const MIN_CATCHUP_CHUNK_SIZE = parseInt(
  process.env.CATCHUP_MIN_CHUNK_SIZE || "5",
  10,
);

const ABIS = {
  REGISTRY: [
    "event UserRegistered(address indexed user, address indexed referrer, uint256 userId)",
    "event IncomeReceived(address indexed user, uint256 amount, string source, string walletType, uint256 timestamp)",
    "event PracticeRewardReceived(address indexed user, address indexed from, uint256 amount, uint256 level)",
  ],
  GAME: [
    "event TicketsBought(address indexed user, uint256 count, uint256 drawId, uint8 drawType)",
    "event BetPlaced(address indexed user, uint256 amount, uint256 prediction, bool isCash, uint256 roundId)",
    "event GameWon(address indexed user, uint256 amount, bool isCash, uint256 roundId)",
    "event RoundClosed(uint256 indexed roundId, uint256 winningNumber, bool isCash)",
    "event DrawExecuted(uint256 indexed drawId, uint8 drawType, address jackpotWinner)",
  ],
  TREASURY: [
    "event Deposit(address indexed user, uint256 amount, uint256 creditedToCash)",
    "event Withdraw(address indexed user, uint256 totalRequested, uint256 fee, uint256 amountSent)",
  ],
};

async function syncUser(address, referrer, userId) {
  const addr = address.toLowerCase();
  const ref = referrer ? referrer.toLowerCase() : null;
  try {
    await prisma.user.upsert({
      where: { address: addr },
      update: {
        isRegistered: true,
        referralCode: userId.toString(),
        referrer: ref,
      },
      create: {
        address: addr,
        isRegistered: true,
        referralCode: userId.toString(),
        referrer: ref,
      },
    });
  } catch (e) {
    console.error(`Error syncing user ${address}:`, e.message);
  }
}

async function ensureUserExists(address) {
  const addr = address.toLowerCase();
  try {
    const user = await prisma.user.findUnique({ where: { address: addr } });
    if (!user) {
      await prisma.user.create({
        data: {
          address: addr,
          isRegistered: false,
        },
      });
      console.log(`👤 Created temporary user record for ${addr}`);
    }
  } catch (e) {
    console.error(`Error ensuring user ${addr}:`, e.message);
  }
}

function isLimitError(err) {
  const msg = (err && err.message ? err.message : "").toLowerCase();
  return (
    msg.includes("request exceeds defined limit") ||
    msg.includes("query returned more than") ||
    msg.includes("response size exceeded") ||
    msg.includes("block range") ||
    msg.includes("limit exceeded")
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getLogsChunked(config, fromBlock, toBlock) {
  const allLogs = [];
  let cursor = Number(fromBlock);
  const end = Number(toBlock);
  let chunkSize = Math.max(MIN_CATCHUP_CHUNK_SIZE, DEFAULT_CATCHUP_CHUNK_SIZE);
  let retries = 0;
  const MAX_RETRIES = 3;

  while (cursor <= end) {
    const chunkEnd = Math.min(cursor + chunkSize - 1, end);
    try {
      const logs = await client.getLogs({
        address: config.address,
        event: parseAbiItem(config.abi),
        fromBlock: BigInt(cursor),
        toBlock: BigInt(chunkEnd),
      });
      if (logs.length > 0) allLogs.push(...logs);
      cursor = chunkEnd + 1;
      retries = 0;
      // Small delay between chunks to avoid rate limiting
      await sleep(200);
    } catch (e) {
      if (isLimitError(e) && chunkSize > MIN_CATCHUP_CHUNK_SIZE) {
        chunkSize = Math.max(MIN_CATCHUP_CHUNK_SIZE, Math.floor(chunkSize / 2));
        console.warn(
          `⚠️ ${config.name} catch-up chunk reduced to ${chunkSize} blocks due to RPC limits.`,
        );
        await sleep(500);
        continue;
      }
      // Retry on transient errors
      if (retries < MAX_RETRIES) {
        retries++;
        console.warn(
          `⚠️ ${config.name} retry ${retries}/${MAX_RETRIES} at block ${cursor}...`,
        );
        await sleep(1000 * retries);
        continue;
      }
      throw e;
    }
  }

  return allLogs;
}

async function watchEvents() {
  await redisClient.connect();
  console.log("🚀 Event Watcher Connected to Chain & Redis...");

  const savedBlock = await redisClient.get(lastBlockKey);
  if (savedBlock) {
    startBlock = Math.max(startBlock, parseInt(savedBlock));
  }

  const eventConfigs = [
    // Registry
    {
      address: process.env.REGISTRY_ADDRESS,
      abi: ABIS.REGISTRY[0],
      name: "UserRegistered",
    },
    {
      address: process.env.REGISTRY_ADDRESS,
      abi: ABIS.REGISTRY[1],
      name: "IncomeReceived",
    },
    {
      address: process.env.REGISTRY_ADDRESS,
      abi: ABIS.REGISTRY[2],
      name: "PracticeRewardReceived",
    },
    // Game
    {
      address: process.env.GAME_ADDRESS,
      abi: ABIS.GAME[0],
      name: "TicketsBought",
    },
    { address: process.env.GAME_ADDRESS, abi: ABIS.GAME[1], name: "BetPlaced" },
    { address: process.env.GAME_ADDRESS, abi: ABIS.GAME[2], name: "GameWon" },
    {
      address: process.env.GAME_ADDRESS,
      abi: ABIS.GAME[3],
      name: "RoundClosed",
    },
    {
      address: process.env.LUCKY_DRAW_ADDRESS,
      abi: ABIS.GAME[4],
      name: "DrawExecuted",
    },
    // Treasury
    {
      address: process.env.TREASURY_ADDRESS,
      abi: ABIS.TREASURY[0],
      name: "Deposit",
    },
    {
      address: process.env.TREASURY_ADDRESS,
      abi: ABIS.TREASURY[1],
      name: "Withdraw",
    },
  ];

  console.log(`📡 Resuming from block: ${startBlock}`);

  // 1. Catch up missed events
  const currentBlock = await client.getBlockNumber();
  if (startBlock < currentBlock) {
    console.log(`🔄 Catching up from ${startBlock} to ${currentBlock}...`);
    for (const config of eventConfigs) {
      try {
        const logs = await getLogsChunked(
          config,
          startBlock,
          Number(currentBlock),
        );
        if (logs.length > 0) {
          console.log(`📥 Found ${logs.length} missed ${config.name} events.`);
          await handleLogs(logs, config.name);
        }
      } catch (e) {
        console.error(`Error catching up ${config.name}: ${e.message}`);
      }
    }
    await redisClient.set(lastBlockKey, currentBlock.toString());
    startBlock = Number(currentBlock);
  }

  for (const config of eventConfigs) {
    client.watchEvent({
      address: config.address,
      event: parseAbiItem(config.abi),
      onLogs: async (logs) => {
        await handleLogs(logs, config.name);
      },
    });
  }
}

async function handleLogs(logs, eventName) {
  for (const log of logs) {
    const { transactionHash, blockNumber } = log;
    const args = log.args;
    const blockNum = Number(blockNumber);
    let ts = blockTimestampCache.get(blockNum);
    if (!ts) {
      try {
        const block = await client.getBlock({ blockNumber });
        ts = Number(block.timestamp);
        blockTimestampCache.set(blockNum, ts);
      } catch {
        ts = Math.floor(Date.now() / 1000);
      }
    }
    console.log(
      `🔔 Event Caught: ${eventName} | Tx: ${transactionHash.slice(0, 10)}...`,
    );

    try {
      switch (eventName) {
        case "UserRegistered":
          await syncUser(args.user, args.referrer, args.userId);
          await prisma.registration.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: { timestamp: ts },
            create: {
              address: args.user.toLowerCase(),
              referrer: args.referrer.toLowerCase(),
              userId: Number(args.userId),
              hash: transactionHash,
              logIndex: log.logIndex,
              timestamp: ts,
            },
          });
          break;
        case "IncomeReceived":
          await ensureUserExists(args.user);
          await prisma.income.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              amount: args.amount.toString(),
              source: args.source,
              walletType: args.walletType,
              timestamp: Number(args.timestamp),
            },
          });
          break;
        case "PracticeRewardReceived":
          await ensureUserExists(args.user);
          await prisma.practiceReward.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              fromAddress: args.from,
              amount: args.amount.toString(),
              level: Number(args.level),
              timestamp: ts,
            },
          });
          break;
        case "TicketsBought":
          await ensureUserExists(args.user);
          await prisma.luckyTicket.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              count: Number(args.count),
              drawId: Number(args.drawId),
              drawType: Number(args.drawType),
              timestamp: ts,
            },
          });
          const field =
            Number(args.drawType) === 1
              ? "totalTicketsGolden"
              : "totalTicketsSilver";
          await prisma.globalStats.upsert({
            where: { id: 1 },
            update: { [field]: { increment: Number(args.count) } },
            create: { id: 1, [field]: Number(args.count) },
          });
          break;
        case "RoundClosed":
          await prisma.round.create({
            data: {
              roundId: Number(args.roundId),
              winningNumber: Number(args.winningNumber),
              isCash: !!args.isCash,
              timestamp: ts,
            },
          });
          break;
        case "DrawExecuted":
          await prisma.draw.upsert({
            where: { hash: transactionHash },
            update: {},
            create: {
              drawId: Number(args.drawId),
              drawType: Number(args.drawType),
              jackpotWinner: args.jackpotWinner,
              hash: transactionHash,
              block: Number(blockNumber),
              timestamp: ts,
            },
          });
          break;
        case "BetPlaced":
          await ensureUserExists(args.user);
          await prisma.bet.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              amount: args.amount.toString(),
              prediction: Number(args.prediction),
              isCash: !!args.isCash,
              roundId: Number(args.roundId),
              timestamp: ts,
            },
          });
          break;
        case "GameWon":
          await ensureUserExists(args.user);
          await prisma.win.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              amount: args.amount.toString(),
              isCash: !!args.isCash,
              roundId: Number(args.roundId),
              timestamp: ts,
            },
          });
          break;
        case "Deposit":
          await ensureUserExists(args.user);
          await prisma.deposit.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              amount: args.amount.toString(),
              creditedToCash: args.creditedToCash.toString(),
              timestamp: ts,
            },
          });
          break;
        case "Withdraw":
          await ensureUserExists(args.user);
          await prisma.withdraw.upsert({
            where: {
              hash_logIndex: { hash: transactionHash, logIndex: log.logIndex },
            },
            update: {},
            create: {
              hash: transactionHash,
              logIndex: log.logIndex,
              userAddress: args.user.toLowerCase(),
              totalRequested: args.totalRequested.toString(),
              fee: args.fee.toString(),
              amountSent: args.amountSent.toString(),
              timestamp: ts,
            },
          });
          break;
      }
      // Update last processed block in Redis
      await redisClient.set(lastBlockKey, blockNumber.toString());
    } catch (e) {
      console.error(`Sync Fail [${eventName}]:`, e.message);
    }
  }
}

module.exports = { watchEvents };
