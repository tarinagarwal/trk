-- CreateTable
CREATE TABLE "User" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "referralCode" TEXT,
    "referrer" TEXT,
    "registrationTime" INTEGER,
    "isRegistered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PracticeReward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeReward_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Registration" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "referrer" TEXT,
    "userId" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "prediction" INTEGER NOT NULL,
    "isCash" BOOLEAN NOT NULL,
    "roundId" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bet_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roundId" INTEGER NOT NULL,
    "winningNumber" INTEGER NOT NULL,
    "isCash" BOOLEAN NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Draw" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "drawId" INTEGER NOT NULL,
    "drawType" INTEGER NOT NULL,
    "jackpotWinner" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Win" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "isCash" BOOLEAN NOT NULL,
    "roundId" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Win_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversion_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "creditedToCash" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deposit_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Withdraw" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "totalRequested" TEXT NOT NULL,
    "fee" TEXT NOT NULL,
    "amountSent" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Withdraw_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LuckyTicket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "drawId" INTEGER NOT NULL,
    "drawType" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LuckyTicket_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Income" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL DEFAULT 0,
    "userAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "walletType" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Income_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "User" ("address") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "totalTicketsSilver" INTEGER NOT NULL DEFAULT 0,
    "totalTicketsGolden" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeReward_hash_logIndex_key" ON "PracticeReward"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_hash_logIndex_key" ON "Registration"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Bet_hash_logIndex_key" ON "Bet"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_hash_key" ON "Draw"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "Win_hash_logIndex_key" ON "Win"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Conversion_hash_logIndex_key" ON "Conversion"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_hash_logIndex_key" ON "Deposit"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Withdraw_hash_logIndex_key" ON "Withdraw"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "LuckyTicket_hash_logIndex_key" ON "LuckyTicket"("hash", "logIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Income_hash_logIndex_key" ON "Income"("hash", "logIndex");
