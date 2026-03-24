const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Initialize Prisma with the correct DB path
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../backend/prisma/dev.db',
    },
  },
});

function generateHash() {
    return '0x' + crypto.randomBytes(32).toString('hex');
}

function getRandomAddress() {
    return '0x' + crypto.randomBytes(20).toString('hex');
}

const ADMIN_ADDRESS = '0x0BdbEF5560b41C1bb36b20b79749143c3AcF86f8'.toLowerCase();

const DEMO_USERS = [
    { address: ADMIN_ADDRESS, referralCode: '1000', isRegistered: true }, 
    { address: getRandomAddress().toLowerCase(), referralCode: '1001', isRegistered: true, referrer: ADMIN_ADDRESS },
    { address: getRandomAddress().toLowerCase(), referralCode: '1002', isRegistered: true, referrer: ADMIN_ADDRESS },
    { address: getRandomAddress().toLowerCase(), referralCode: '1003', isRegistered: true, referrer: ADMIN_ADDRESS },
    { address: getRandomAddress().toLowerCase(), referralCode: '1004', isRegistered: true, referrer: '1001' },
];

async function main() {
    console.log('🚀 Starting Demo Data Population...');

    // 1. Create Users
    for (const u of DEMO_USERS) {
        await prisma.user.upsert({
            where: { address: u.address },
            update: u,
            create: u
        });
        console.log(`✅ User created: ${u.address}`);
    }

    const admin = ADMIN_ADDRESS;
    const user1 = DEMO_USERS[1].address;

    // 2. Add Deposits
    await prisma.deposit.createMany({
        data: [
            { hash: generateHash(), userAddress: admin, amount: '50000000000000000000', creditedToCash: '50000000000000000000', timestamp: Math.floor(Date.now() / 1000) - 86400 },
            { hash: generateHash(), userAddress: user1, amount: '10000000000000000000', creditedToCash: '10000000000000000000', timestamp: Math.floor(Date.now() / 1000) - 43200 },
        ],
        skipDuplicates: true
    });

    // 3. Add Bets
    await prisma.bet.createMany({
        data: [
            { hash: generateHash(), userAddress: admin, amount: '1000000000000000000', prediction: 5, isCash: true, roundId: 100, timestamp: Math.floor(Date.now() / 1000) - 3600 },
            { hash: generateHash(), userAddress: admin, amount: '500000000000000000', prediction: 2, isCash: false, roundId: 101, timestamp: Math.floor(Date.now() / 1000) - 1800 },
            { hash: generateHash(), userAddress: user1, amount: '2000000000000000000', prediction: 8, isCash: true, roundId: 100, timestamp: Math.floor(Date.now() / 1000) - 3500 },
        ],
        skipDuplicates: true
    });

    // 4. Add Wins
    await prisma.win.createMany({
        data: [
            { hash: generateHash(), userAddress: admin, amount: '9000000000000000000', isCash: true, roundId: 99, timestamp: Math.floor(Date.now() / 1000) - 7200 },
        ],
        skipDuplicates: true
    });

    // 5. Add Rounds
    await prisma.round.createMany({
        data: [
            { roundId: 100, winningNumber: 5, isCash: true, timestamp: Math.floor(Date.now() / 1000) - 3000 },
            { roundId: 99, winningNumber: 1, isCash: true, timestamp: Math.floor(Date.now() / 1000) - 7100 },
        ],
        skipDuplicates: true
    });

    // 6. Add Lucky Tickets
    await prisma.luckyTicket.createMany({
        data: [
            { hash: generateHash(), userAddress: admin, count: 5, drawId: 10, drawType: 1, timestamp: Math.floor(Date.now() / 1000) - 3600 },
            { hash: generateHash(), userAddress: admin, count: 10, drawId: 10, drawType: 0, timestamp: Math.floor(Date.now() / 1000) - 3600 },
        ],
        skipDuplicates: true
    });

    // 7. Add Draws
    await prisma.draw.createMany({
        data: [
            { drawId: 9, drawType: 1, jackpotWinner: admin, hash: generateHash(), block: 1000000, timestamp: Math.floor(Date.now() / 1000) - 172800 },
            { drawId: 9, drawType: 0, jackpotWinner: getRandomAddress(), hash: generateHash(), block: 1000001, timestamp: Math.floor(Date.now() / 1000) - 172800 },
        ],
        skipDuplicates: true
    });

    // 8. Add Incomes (The most important for testing dashboard)
    await prisma.income.createMany({
        data: [
            { hash: generateHash(), userAddress: admin, amount: '500000000000000000', source: 'Daily Cashback', walletType: 'Cash', timestamp: Math.floor(Date.now() / 1000) - 1000 },
            { hash: generateHash(), userAddress: admin, amount: '1200000000000000000', source: 'Club Pool', walletType: 'Cash', timestamp: Math.floor(Date.now() / 1000) - 2000 },
            { hash: generateHash(), userAddress: admin, amount: '300000000000000000', source: 'Winner Referral', walletType: 'Cash', timestamp: Math.floor(Date.now() / 1000) - 3000 },
            { hash: generateHash(), userAddress: admin, amount: '1000000000000000000', source: 'Lucky Draw Jackpot', walletType: 'Cash', timestamp: Math.floor(Date.now() / 1000) - 5000 },
            { hash: generateHash(), userAddress: admin, amount: '500000000000000000', source: 'Direct Referral', walletType: 'Cash', timestamp: Math.floor(Date.now() / 1000) - 10000 },
        ],
        skipDuplicates: true
    });

    // 9. Global Stats
    await prisma.globalStats.upsert({
        where: { id: 1 },
        update: { totalTicketsGolden: 100, totalTicketsSilver: 500 },
        create: { id: 1, totalTicketsGolden: 100, totalTicketsSilver: 500 }
    });

    console.log('🎉 Demo Data Population Complete!');
    console.log('Check your dashboard at http://localhost:3000 now!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
