"use client";

import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { TRK_GAME_ADDRESS, TRK_ADDRESSES } from "../../config";
import { API_ENDPOINTS } from "@/config/backend";
import TRKGameABI from "@/abis/TRKRouter.json";
import TRKTreasuryABI from "@/abis/TRKTreasury.json";
import TRKGameEngineABI from "@/abis/TRKGameEngine.json";
import TRKCashbackEngineABI from "@/abis/TRKCashbackEngine.json";
import TRKLuckyDrawABI from "@/abis/TRKLuckyDraw.json";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import UsersTab from "./users/page";
import LuckyDrawTab from "./luckydraw/page";

const USDT_DECIMALS = 18;

const safeFormat = (val: any, isUSDT = false) => {
  if (!val) return "0";
  try {
    const num = isUSDT ? Number(formatUnits(val, USDT_DECIMALS)) : Number(val);
    return isUSDT ? num.toFixed(2) : num.toString();
  } catch (e) {
    return "0";
  }
};

const TABS = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "rounds", label: "Rounds", icon: "🎲" },
  { id: "luckydraw", label: "Lucky Draw", icon: "🎰" },
  { id: "economics", label: "Economics", icon: "💎" },
  { id: "transactions", label: "History", icon: "📜" },
  { id: "settings", label: "Settings", icon: "⚙️" },
  { id: "wallets", label: "Wallets", icon: "💳" },
];

// Safe parsers that never throw on empty/invalid input
const safeBigInt = (v: string | number | undefined | null) => {
  try { return BigInt(v ?? 0); }
  catch { return BigInt(0); }
};
const safeParseUnits = (v: string, decimals = 18) => {
  try { return parseUnits(v && v.trim() !== '' ? v : '0', decimals); }
  catch { return parseUnits('0', decimals); }
};
const safePad15 = (arr: any[]): bigint[] => {
  const result: bigint[] = Array(15).fill(BigInt(0));
  for (let i = 0; i < Math.min(arr.length, 15); i++) result[i] = safeBigInt(arr[i]);
  return result;
};

export default function ComprehensiveAdminPanel() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState("overview");
  const [txFilter, setTxFilter] = useState("all");
  const { writeContract, isPending, error: writeError } = useWriteContract();
  const [adminAnalytics, setAdminAnalytics] = useState<any>(null);
  const [adminDistributions, setAdminDistributions] = useState<any>(null);
  const [adminGameStatus, setAdminGameStatus] = useState<any>(null);
  const [normalizedOverview, setNormalizedOverview] = useState<any>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Contract Reads
  const { data: ownerAddress } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "owner",
  });

  const { data: allSettings, refetch: refetchSettings } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getAllSettings",
  });

  const { data: systemSettings, refetch: refetchSystemSettings } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getSystemSettings",
  });

  const { data: userStats } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getPlatformStats",
  });

  const { data: poolStatsRaw } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getPools",
  });

  // Round IDs from Engine
  const { data: currentPracticeId } = useReadContract({
    address: TRK_ADDRESSES.GAME as `0x${string}`,
    abi: TRKGameEngineABI.abi,
    functionName: "currentPracticeRoundId",
  });

  const { data: currentCashId } = useReadContract({
    address: TRK_ADDRESSES.GAME as `0x${string}`,
    abi: TRKGameEngineABI.abi,
    functionName: "currentCashRoundId",
  });

  const { data: practiceRoundData } = useReadContract({
    address: TRK_ADDRESSES.GAME,
    abi: TRKGameEngineABI.abi,
    functionName: "practiceRounds",
    args: [currentPracticeId || BigInt(0)],
    query: { enabled: !!currentPracticeId }
  });

  const { data: cashRoundData } = useReadContract({
    address: TRK_ADDRESSES.GAME,
    abi: TRKGameEngineABI.abi,
    functionName: "cashRounds",
    args: [currentCashId || BigInt(0)],
    query: { enabled: !!currentCashId }
  });

  // Lucky Draw live stats
  const { data: luckyGoldenStats } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getLuckyDrawStats",
    args: [1], // Golden = 1
  });

  const { data: luckySilverStats } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getLuckyDrawStats",
    args: [0], // Silver = 0
  });

  const isOwner =
    ownerAddress &&
    address &&
    (ownerAddress as string).toLowerCase() === address.toLowerCase();

  const fetchAdminData = async () => {
    setIsDataLoading(true);
    try {
      const [analyticsRes, distributionsRes, statusRes] = await Promise.all([
        fetch(API_ENDPOINTS.GET_ADMIN_ANALYTICS),
        fetch(API_ENDPOINTS.GET_ADMIN_DISTRIBUTIONS),
        fetch(API_ENDPOINTS.GET_ADMIN_GAME_STATUS)
      ]);
      const normalizedRes = await fetch(API_ENDPOINTS.GET_ADMIN_OVERVIEW_NORMALIZED);
      const [analytics, distributions, status] = await Promise.all([
        analyticsRes.json(),
        distributionsRes.json(),
        statusRes.json()
      ]);
      const normalized = await normalizedRes.json();

      if (analytics.success) setAdminAnalytics(analytics);
      if (distributions.success) setAdminDistributions(distributions);
      if (status.success) setAdminGameStatus(status);
      if (normalized.success) setNormalizedOverview(normalized);
      
    } catch (e) {
      console.error("Failed to fetch admin data from backend:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && isOwner) {
      fetchAdminData();
    }
  }, [isConnected, isOwner, activeTab]);

  // Show write errors in console for debugging
  useEffect(() => {
    if (writeError) {
      console.error("Contract write error:", writeError);
    }
  }, [writeError]);

  if (!isConnected || !isOwner) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-sm"
        >
          <h2 className="text-2xl font-bold mb-2">
            {!isConnected ? "🔐 Wallet Required" : "⛔ Restricted"}
          </h2>
          <p className="text-gray-500 mb-6">
            {!isConnected
              ? "Please connect your admin wallet."
              : "You do not have owner permissions."}
          </p>
        </motion.div>
      </div>
    );
  }

  const fmt = (v: any, decimals = 18) =>
    v != null ? Number(formatUnits(BigInt(v), decimals)).toFixed(2) : '0.00';

  const backAnalytics = adminAnalytics || { totalUsers: 0, totalVolume: '0', totalWithdrawn: '0' };
  const normalizedStats = normalizedOverview?.normalized?.stats;
  const stats = normalizedStats
    ? {
        users: String(normalizedStats.users ?? '0'),
        volume: String(normalizedStats.volume ?? '0'),
        withdrawn: String(normalizedStats.withdrawn ?? '0')
      }
    : {
        users: userStats ? (Array.isArray(userStats) ? String(userStats[0]) : String((userStats as any).users)) : backAnalytics.totalUsers,
        volume: userStats ? (Array.isArray(userStats) ? String(userStats[1]) : String((userStats as any).volume)) : backAnalytics.totalVolume,
        withdrawn: userStats ? (Array.isArray(userStats) ? String(userStats[2]) : String((userStats as any).withdrawn)) : backAnalytics.totalWithdrawn
      };

  const settings = allSettings as any;
  const normalizedPools = normalizedOverview?.normalized?.pools;
  const poolStats = normalizedPools
    ? {
        gamePool: fmt(normalizedPools[0] ?? '0'),
        clubPool: fmt(normalizedPools[1] ?? '0'),
        goldenPool: fmt(normalizedPools[2] ?? '0'),
        silverPool: fmt(normalizedPools[3] ?? '0'),
        protectionPool: fmt(normalizedPools[4] ?? '0'),
        creatorPool: fmt(normalizedPools[5] ?? '0'),
        bdPool: fmt(normalizedPools[6] ?? '0'),
        fewPool: fmt(normalizedPools[7] ?? '0'),
        referralPool: fmt(normalizedPools[8] ?? '0'),
      }
    : {
        gamePool:        poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[0] : (poolStatsRaw as any).gamePool) : '0.00',
        clubPool:        poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[1] : (poolStatsRaw as any).clubPool) : '0.00',
        goldenPool:      poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[2] : (poolStatsRaw as any).golden) : '0.00',
        silverPool:      poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[3] : (poolStatsRaw as any).silver) : '0.00',
        protectionPool:  poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[4] : (poolStatsRaw as any).protection) : '0.00',
        creatorPool:     poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[5] : (poolStatsRaw as any).creator) : '0.00',
        bdPool:          poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[6] : (poolStatsRaw as any).bd) : '0.00',
        fewPool:         poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[7] : (poolStatsRaw as any).few) : '0.00',
        referralPool:    poolStatsRaw ? fmt(Array.isArray(poolStatsRaw) ? poolStatsRaw[8] : (poolStatsRaw as any).referral) : '0.00',
      };
  const normalizedRounds = normalizedOverview?.normalized?.rounds;
  const roundIds = normalizedRounds
    ? {
        practiceId: String(normalizedRounds.practiceId ?? '0'),
        cashId: String(normalizedRounds.cashId ?? '0')
      }
    : {
        practiceId: currentPracticeId != null ? String(currentPracticeId) : (adminGameStatus?.practiceId || '0'),
        cashId: currentCashId != null ? String(currentCashId) : (adminGameStatus?.cashId || '0'),
      };
  // Pre-convert settings array BigInts to plain strings
  const settingsStr: string[] = settings
    ? Array.from({ length: 15 }, (_, i) =>
        settings[i] != null ? fmt(settings[i]) : '0.00'
      )
    : Array(15).fill('0.00');

  // SAFE Lucky Draw Stats (No BigInts)
  const goldenLive = Array.isArray(luckyGoldenStats)
    ? luckyGoldenStats
    : [
        (luckyGoldenStats as any)?.drawId,
        (luckyGoldenStats as any)?.ticketsSold,
        (luckyGoldenStats as any)?.maxTickets,
        (luckyGoldenStats as any)?.prizePoolBalance,
      ];
  const silverLive = Array.isArray(luckySilverStats)
    ? luckySilverStats
    : [
        (luckySilverStats as any)?.drawId,
        (luckySilverStats as any)?.ticketsSold,
        (luckySilverStats as any)?.maxTickets,
        (luckySilverStats as any)?.prizePoolBalance,
      ];

  const normalizedLucky = normalizedOverview?.normalized?.lucky;
  const luckyGoldenSafe = normalizedLucky
    ? {
        drawId: Number(normalizedLucky.golden?.drawId ?? 0),
        ticketsSold: Number(normalizedLucky.golden?.ticketsSold ?? 0),
        maxTickets: Number(normalizedLucky.golden?.maxTickets ?? 10000),
        prizePool: fmt(normalizedLucky.golden?.prizePool ?? 0)
      }
    : {
        drawId: Number(goldenLive?.[0] ?? adminGameStatus?.goldenDrawId ?? 1),
        ticketsSold: Number(goldenLive?.[1] ?? 0),
        maxTickets: Number(goldenLive?.[2] ?? 10000),
        prizePool: fmt(goldenLive?.[3] ?? 0)
      };
  const luckySilverSafe = normalizedLucky
    ? {
        drawId: Number(normalizedLucky.silver?.drawId ?? 0),
        ticketsSold: Number(normalizedLucky.silver?.ticketsSold ?? 0),
        maxTickets: Number(normalizedLucky.silver?.maxTickets ?? 10000),
        prizePool: fmt(normalizedLucky.silver?.prizePool ?? 0)
      }
    : {
        drawId: Number(silverLive?.[0] ?? adminGameStatus?.silverDrawId ?? 1),
        ticketsSold: Number(silverLive?.[1] ?? 0),
        maxTickets: Number(silverLive?.[2] ?? 10000),
        prizePool: fmt(silverLive?.[3] ?? 0)
      };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 md:p-8 selection:bg-blue-500/30">
      {/* Global write error banner */}
      {writeError && (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-red-950 border border-red-500/50 rounded-xl p-4 text-sm font-mono text-red-300 break-all shadow-xl">
          <p className="font-bold text-red-400 mb-1">⚠️ Contract Interaction Failed</p>
          <p>{(writeError as any)?.shortMessage ?? (writeError as any)?.message ?? 'Unknown error'}</p>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500"
          >
            TRK ENGINE <span className="text-blue-500">ADMIN</span>
          </motion.h1>
          <p className="text-gray-600 font-mono text-xs mt-1 uppercase tracking-widest">
            {TRK_GAME_ADDRESS}
          </p>
        </header>

        {/* Navigation */}
        <nav className="flex gap-1 mb-8 overflow-x-auto pb-2 no-scrollbar bg-white/5 p-1 rounded-2xl border border-white/5 w-full md:w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-blue-600 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                />
              )}
              <span className="relative z-10">{tab.icon}</span>
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8"
          >
            {activeTab === "overview" && (
              <OverviewTab
                stats={stats}
                settingsStr={settingsStr}
                poolStats={poolStats}
                roundIds={roundIds}
                luckyGoldenSafe={luckyGoldenSafe}
                luckySilverSafe={luckySilverSafe}
                writeContract={writeContract}
                isPending={isPending}
              />
            )}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "luckydraw" && <LuckyDrawTab />}
            {activeTab === "rounds" && (
              <RoundsManagementTab
                practiceRound={practiceRoundData}
                cashRound={cashRoundData}
                writeContract={writeContract}
                isPending={isPending}
              />
            )}
            {activeTab === "settings" && (
              <GameSettingsTab
                settings={settings}
                writeContract={writeContract}
                isPending={isPending}
              />
            )}
            {activeTab === "economics" && (
              <AdvancedEconomicsTab
                systemSettings={systemSettings}
                writeContract={writeContract}
                isPending={isPending}
                treasuryAddr={TRK_ADDRESSES.TREASURY}
                gameAddr={TRK_ADDRESSES.GAME}
                cashbackAddr={TRK_ADDRESSES.CASHBACK}
                luckyAddr={TRK_ADDRESSES.LUCKY_DRAW}
              />
            )}
            {activeTab === "wallets" && (
              <WalletsTab writeContract={writeContract} isPending={isPending} />
            )}
            {activeTab === "transactions" && (
              <TransactionsTab filter={txFilter} setFilter={setTxFilter} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function OverviewTab({
  stats,
  settingsStr,
  poolStats,
  roundIds,
  luckyGoldenSafe,
  luckySilverSafe,
  writeContract,
  isPending
}: any) {
  // stats and settings are plain JS objects from wagmi (named struct)
  const users     = stats?.users     != null ? String(stats.users)     : stats?.[0] != null ? String(stats[0]) : '0';
  const volume    = stats?.volume    ? Number(formatUnits(BigInt(stats.volume),    18)).toFixed(2) : stats?.[1] ? Number(formatUnits(BigInt(stats[1]), 18)).toFixed(2) : '0.00';
  const withdrawn = stats?.withdrawn ? Number(formatUnits(BigInt(stats.withdrawn), 18)).toFixed(2) : stats?.[2] ? Number(formatUnits(BigInt(stats[2]), 18)).toFixed(2) : '0.00';

  return (
    <div className="space-y-8">
      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickStat label="Total Registered" value={users} sub="Users" />
        <QuickStat label="Total Deposits"   value={volume}    sub="USDT" />
        <QuickStat label="Total Withdrawn"  value={withdrawn} sub="USDT" />
        <QuickStat 
           label="Total Wallet Liquidity" 
           value={(
             Number(poolStats.gamePool) + 
             Number(poolStats.protectionPool) + 
             Number(poolStats.clubPool) + 
             Number(poolStats.goldenPool) + 
             Number(poolStats.silverPool)
           ).toFixed(2)} 
           sub="USDT (Live Pool Balances)" 
           color="text-green-500 border-2 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
        />
      </div>

      {/* Round Status */}
      <h3 className="text-xl font-bold mt-8 mb-4">🎲 Active Rounds</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <QuickStat
           label="Current Practice Round"
           value={`#${roundIds.practiceId || '0'}`}
           sub="Active"
           color="text-blue-400"
         />
         <QuickStat
           label="Current Cash Round"
           value={`#${roundIds.cashId || '0'}`}
           sub="Active"
           color="text-yellow-400"
         />
      </div>

      {/* Treasury Pools & Cumulative Splits */}
      <h3 className="text-xl font-bold mt-8 mb-4">🏦 Ecosystem Split & Pools</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        <QuickStat label="Game Pool"       value={poolStats.gamePool}       sub="USDT" color="text-green-400"  />
        <QuickStat label="Protection Pool" value={poolStats.protectionPool}  sub="USDT" color="text-blue-400"   />
        <QuickStat label="Club Pool"       value={poolStats.clubPool}        sub="USDT" color="text-purple-400" />
        <QuickStat label="Golden Draw"      value={poolStats.goldenPool}     sub="USDT" color="text-yellow-400" />
        <QuickStat label="Silver Draw"      value={poolStats.silverPool}     sub="USDT" color="text-gray-400" />
        
        <QuickStat label="Creator Distributed" value={poolStats.creatorPool}  sub="USDT (Cumulative)" color="text-pink-400" />
        <QuickStat label="BD Distributed"      value={poolStats.bdPool}       sub="USDT (Cumulative)" color="text-indigo-400" />
        <QuickStat label="Ops/FEW Distributed" value={poolStats.fewPool}      sub="USDT (Cumulative)" color="text-cyan-400" />
        <QuickStat label="Referral Distributed" value={poolStats.referralPool} sub="USDT (Cumulative)" color="text-orange-400" />
      </div>

      <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4 text-xs text-blue-200">
        <p className="font-semibold mb-1">Protection Pool</p>
        <p>
          Protection is a reserve used for loss-cashback and safety payouts. It helps absorb downside during weak rounds and supports payout stability.
        </p>
      </div>

      {/* 🎰 Lucky Draw Control Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LuckyDrawCard 
          title="Golden Lucky Draw"
          type={1}
          safe={luckyGoldenSafe}
          writeContract={writeContract}
          isPending={isPending}
          baseColor="pink"
        />
        <LuckyDrawCard 
          title="Silver Lucky Draw"
          type={0}
          safe={luckySilverSafe}
          writeContract={writeContract}
          isPending={isPending}
          baseColor="gray"
        />
      </div>

      <div className="bg-black/40 border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          ⚙️ Current Thresholds
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="border-2 border-yellow-500 rounded-xl p-3 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
            <p className="text-yellow-500 font-black uppercase text-[10px] mb-1">🔥 Current Minimum</p>
            <p className="font-mono font-black text-lg">{settingsStr?.[0] ?? '1.00'} USDT</p>
          </div>
          <div>
            <p className="text-gray-500">Sign-up Bonus</p>
            <p className="font-mono font-bold">{settingsStr?.[1] ?? '10.00'} USDT</p>
          </div>
          <div>
            <p className="text-gray-500">Win Multiplier</p>
            <p className="font-mono font-bold">8X</p>
          </div>
          <div>
            <p className="text-gray-500 font-bold uppercase text-[9px]">Min Active Deposit For Referral Payout</p>
            <p className="font-mono font-bold">{settingsStr?.[5] ?? '0.00'} USDT</p>
            <p className="text-[8px] text-gray-600 italic">Referral income is released only after this active deposit threshold is met.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LuckyDrawCard({ title, type, safe, writeContract, isPending, baseColor }: any) {
  const { drawId, ticketsSold, maxTickets, prizePool: prizePoolUSDT } = safe;
  const pct = maxTickets > 0 ? Math.round((ticketsSold / maxTickets) * 100) : 0;

  const handleForceDraw = () => {
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "adminTriggerLuckyDraw",
      args: [type],
      gas: BigInt(15000000),
    });
  };

  const prizes = type === 0 
    ? [
        { tier: '🥇 1st', prize: '$10,000', count: 1 },
        { tier: '🥈 2nd', prize: '$5,000', count: 1 },
        { tier: '🥉 3rd', prize: '$4,000', count: 1 },
        { tier: '🎖 4–10', prize: '$1,000', count: 7 },
        { tier: '11–50', prize: '$300', count: 40 },
        { tier: '51–100', prize: '$120', count: 50 },
        { tier: '101–500', prize: '$40', count: 400 },
        { tier: '501–1000', prize: '$20', count: 500 },
      ]
    : [
        { tier: '🥇 1st', prize: '$1,000', count: 1 },
        { tier: '🥈 2nd', prize: '$500', count: 1 },
        { tier: '🥉 3rd', prize: '$400', count: 1 },
        { tier: '🎖 4–10', prize: '$100', count: 7 },
        { tier: '11–50', prize: '$30', count: 40 },
        { tier: '51–100', prize: '$12', count: 50 },
        { tier: '101–500', prize: '$4', count: 400 },
        { tier: '501–1000', prize: '$2', count: 500 },
      ];

  const colorClasses = baseColor === 'pink' 
    ? 'from-pink-900/30 to-purple-900/30 border-pink-500/30 shadow-pink-900/30 text-pink-300'
    : 'from-blue-900/30 to-gray-900/30 border-blue-500/30 shadow-blue-900/30 text-blue-300';

  const btnClasses = baseColor === 'pink'
    ? 'from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500'
    : 'from-blue-600 to-gray-600 hover:from-blue-500 hover:to-gray-500';

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${colorClasses} border rounded-2xl p-6`}>
      <div className={`absolute inset-0 ${baseColor === 'pink' ? 'bg-pink-500/5' : 'bg-blue-500/5'} blur-3xl -z-10`} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className={`text-xl font-bold flex items-center gap-2`}>
            🎰 {title} — #{drawId}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Ticket Price: {type === 0 ? '10' : '1'} USDT
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-mono`}>
            Prize Pool: <span className="text-white font-bold">${prizePoolUSDT} USDT</span>
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono">
          <span>{ticketsSold.toLocaleString()} tickets sold</span>
          <span>{maxTickets.toLocaleString()} needed</span>
        </div>
        <div className="h-4 bg-black/40 rounded-full overflow-hidden border border-white/10">
          <div
            className={`h-full bg-gradient-to-r ${baseColor === 'pink' ? 'from-pink-600 to-purple-500' : 'from-blue-600 to-gray-500'} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${Math.max(pct, ticketsSold > 0 ? 2 : 0)}%` }}
          />
        </div>
        <p className="text-center text-xs text-pink-400 mt-1 font-mono">{pct}% filled</p>
      </div>

      {/* Prize Tiers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-xs">
        {prizes.map(t => (
          <div key={t.tier} className="bg-black/30 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-white font-bold">{t.tier}</div>
            <div className="text-blue-400 font-mono font-bold">{t.prize}</div>
            <div className="text-gray-500 text-[10px]">×{t.count} winner{t.count > 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {/* Force Execute Button */}
      <button
        onClick={handleForceDraw}
        disabled={isPending || ticketsSold === 0}
        className={`w-full py-4 bg-gradient-to-r ${btnClasses} disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest`}
      >
        {isPending ? '⏳ Executing...' : ticketsSold === 0 ? '⚠️ No Tickets' : `🎰 Force Draw #${drawId} (${ticketsSold} tix)`}
      </button>
    </div>
  );
}

function QuickStat({ label, value, sub, color }: any) {
  return (
    <div className={`bg-gradient-to-br from-white/[0.05] to-transparent p-6 rounded-2xl border border-white/10 ${color ? 'border-l-4 ' + color.replace('text', 'border') : ''}`}>
      <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-2">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black">{value}</span>
        <span className="text-blue-500 font-bold text-xs">{sub}</span>
      </div>
    </div>
  );
}

const ConfigRow = ({ label, value }: any) => (
  <div className="flex justify-between border-b border-gray-800 pb-2">
    <span className="text-gray-400">{label}:</span>
    <span className="text-white font-mono font-bold">{value}</span>
  </div>
);

// Rounds Management Tab
function RoundsManagementTab({
  practiceRound,
  cashRound,
  writeContract,
  isPending,
}: any) {
  const [activeSubTab, setActiveSubTab] = useState("practice");
  const [winningNumber, setWinningNumber] = useState("");

  const currentRound = activeSubTab === "practice" ? practiceRound : cashRound;
  const isCash = activeSubTab === "cash";

  const handleCloseRound = () => {
    if (!winningNumber || isPending) return;
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "closeRound",
      args: [Number(winningNumber), isCash],
    });
    setWinningNumber("");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-black flex items-center gap-2">
            <span className="text-blue-500">🎲</span> Round Management
        </h2>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full sm:w-auto overflow-hidden">
            <button 
                onClick={() => setActiveSubTab("practice")}
                className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'practice' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white'}`}
            >
                Practice
            </button>
            <button 
                onClick={() => setActiveSubTab("cash")}
                className={`flex-1 sm:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'cash' ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-500 hover:text-white'}`}
            >
                Real Cash
            </button>
        </div>
      </div>

      <motion.div 
          key={activeSubTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-white/[0.02] backdrop-blur-3xl border-2 p-8 md:p-12 rounded-[2.5rem] text-center ${isCash ? 'border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.1)]' : 'border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.1)]'}`}
      >
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400/40 mb-4">{isCash ? 'Global Cash Arena' : 'Demo Practice Lab'}</div>
          
          <div className="flex flex-col items-center justify-center mb-10">
              <div className="relative">
                  <div className={`absolute inset-0 blur-2xl opacity-20 ${isCash ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                  <div className={`relative text-7xl md:text-9xl font-black tracking-tighter ${isCash ? 'text-yellow-400' : 'text-blue-400'}`}>
                      #{currentRound ? currentRound[0].toString() : "0"}
                  </div>
              </div>
              <div className="mt-4 flex items-center gap-2 justify-center">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${currentRound && !currentRound[2] ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${currentRound && !currentRound[2] ? 'text-green-500' : 'text-red-500'}`}>
                      {currentRound && currentRound[2] ? 'Round Finalized' : 'Accepting Bets'}
                  </span>
              </div>
          </div>

          <div className="max-w-md mx-auto space-y-6">
              <div className="relative group">
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent group-focus-within:via-white/40 transition-all duration-500"></div>
                  <input
                      type="number"
                      min="0"
                      max="9"
                      value={winningNumber}
                      onChange={(e) => setWinningNumber(e.target.value)}
                      className="w-full bg-transparent border-none text-white text-4xl md:text-6xl text-center font-black outline-none placeholder:text-white/5 py-4"
                      placeholder="0-9"
                  />
                  <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-2">{isCash ? 'Inject Cash Outcome' : 'Set Demo Outcome'}</div>
              </div>

              <button
                  onClick={handleCloseRound}
                  disabled={isPending || !winningNumber}
                  className={`w-full py-5 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-2xl disabled:opacity-30 ${isCash ? 'bg-yellow-500 text-black shadow-yellow-500/20 hover:bg-yellow-400' : 'bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-500'}`}
              >
                  {isPending ? "⏳ TRANSMITTING ORACLE..." : "🏁 FINALIZE & DISBURSE"}
              </button>
              
              <p className="text-[9px] text-gray-600 font-medium leading-relaxed italic uppercase">
                  Caution: This action acts as the final oracle. Payouts are irreversible on the BSC ledger.
              </p>
          </div>
      </motion.div>
    </div>
  );
}

// Game Settings Tab
function GameSettingsTab({ settings, writeContract, isPending }: any) {
  const [activeSubTab, setActiveSubTab] = useState("system");
  const [form, setForm] = useState({
    minActivation: "",
    signupBonusTier1: "",
    tier1Limit: "",
    signupBonusTier2: "",
    tier2Limit: "",
    minReferral: "",
    practiceGames: "",
    cashGames: "",
    fullBridge: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        minActivation: formatUnits(settings[0] || BigInt(0), USDT_DECIMALS),
        signupBonusTier1: formatUnits(settings[1] || BigInt(0), USDT_DECIMALS),
        tier1Limit: settings[2]?.toString() || "0",
        signupBonusTier2: formatUnits(settings[3] || BigInt(0), USDT_DECIMALS),
        tier2Limit: settings[4]?.toString() || "0",
        minReferral: formatUnits(settings[5] || BigInt(0), USDT_DECIMALS),
        practiceGames: settings[6]?.toString() || "0",
        cashGames: settings[7]?.toString() || "0",
        fullBridge: formatUnits(settings[8] || BigInt(0), USDT_DECIMALS),
      });
    }
  }, [settings]);

  const handleUpdateRouterSettings = () => {
    if (isPending) return;
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "updateSettings",
      args: [
        safeParseUnits(form.minActivation, USDT_DECIMALS),
        safeParseUnits(form.signupBonusTier1, USDT_DECIMALS),
        safeBigInt(form.tier1Limit),
        safeParseUnits(form.signupBonusTier2, USDT_DECIMALS),
        safeBigInt(form.tier2Limit),
        safeParseUnits(form.minReferral, USDT_DECIMALS),
        safeBigInt(form.practiceGames),
        safeBigInt(form.cashGames),
        safeParseUnits(form.fullBridge, USDT_DECIMALS),
      ],
    });
  };

  const handleUpdateGameEngine = () => {
    if (isPending) return;
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "setGameSettings",
      args: [BigInt(2), BigInt(6), safeBigInt(form.practiceGames), safeBigInt(form.cashGames)],
    });
  };

  const updateField = (field: string, val: string) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-black">⚙️ Game Parameters</h2>
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full md:w-auto overflow-hidden">
           <button 
               onClick={() => setActiveSubTab("system")}
               className={`flex-1 md:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'system' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}
           >
               System
           </button>
           <button 
               onClick={() => setActiveSubTab("limits")}
               className={`flex-1 md:px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'limits' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-white'}`}
           >
               Limits
           </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
        >
          {activeSubTab === "system" ? (
            <SectionCard title="Registration & Bonus Settings" onSave={handleUpdateRouterSettings} isPending={isPending}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    <InputGroup label="Min Activation (USDT)" value={form.minActivation} onChange={(v:any)=>updateField("minActivation", v)} />
                    <InputGroup label="Signup Bonus Tier 1 (USDT)" value={form.signupBonusTier1} onChange={(v:any)=>updateField("signupBonusTier1", v)} />
                    <InputGroup label="Tier 1 User Limit" value={form.tier1Limit} onChange={(v:any)=>updateField("tier1Limit", v)} />
                    <InputGroup label="Signup Bonus Tier 2 (USDT)" value={form.signupBonusTier2} onChange={(v:any)=>updateField("signupBonusTier2", v)} />
                    <InputGroup label="Tier 2 User Limit" value={form.tier2Limit} onChange={(v:any)=>updateField("tier2Limit", v)} />
                    <InputGroup label="Min Ref Payout (USDT)" value={form.minReferral} onChange={(v:any)=>updateField("minReferral", v)} />
                    <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                      <InputGroup label="Full Activation Bridge (USDT)" value={form.fullBridge} onChange={(v:any)=>updateField("fullBridge", v)} />
                      <p className="text-[8px] text-blue-400 mt-2 font-bold uppercase tracking-tighter italic">Amount needed to convert Practice Balance to Real Balance</p>
                    </div>
                </div>
                <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs text-center">ℹ️</div>
                   <p className="text-[10px] text-gray-500 font-medium">These settings govern account activation and initial bonus eligibility across the platform. Changes are applied via the Router contract.</p>
                </div>
            </SectionCard>
          ) : (
            <SectionCard title="Gameplay & Engine Limits" onSave={handleUpdateGameEngine} isPending={isPending}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <InputGroup label="Practice Games / Day" value={form.practiceGames} onChange={(v:any)=>updateField("practiceGames", v)} />
                    <InputGroup label="Cash Games / Day" value={form.cashGames} onChange={(v:any)=>updateField("cashGames", v)} />
                </div>
                <div className="mt-8 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs text-center">⚙️</div>
                   <p className="text-[10px] text-gray-500 font-medium">These limits are stored directly on the Game Engine contract for high-performance throughput and distinct access control.</p>
                </div>
            </SectionCard>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const InputGroup = ({ label, value, onChange }: any) => (
  <div className="bg-gray-800/50 p-4 rounded-lg">
    <label className="text-gray-400 text-xs uppercase font-bold mb-2 block">
      {label}
    </label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none transition-colors"
    />
  </div>
);

// Distribution Tab
// Distribution Tab - READ ONLY
function DistributionTab() {
  // Hardcoded from Contract Logic
  const creator = 10;
  const bd = 5;
  const few = 2; // Tech/Ops
  const referral = 70; // 15 Levels
  const gamePool = 5;
  const total = 92;

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">📊 Distribution % (Immutable)</h2>
      <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg text-center">
        <p className="text-2xl font-bold">
          Total Distributed:{" "}
          <span className="text-green-400">
            {total}%
          </span>
        </p>
        <p className="text-sm text-gray-400">Fixed Smart Contract Logic</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">Creator %</label>
          <div className="text-white text-xl font-bold">{creator}%</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">BD %</label>
          <div className="text-white text-xl font-bold">{bd}%</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">FEW %</label>
          <div className="text-white text-xl font-bold">{few}%</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">Referral %</label>
          <div className="text-white text-xl font-bold">{referral}%</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg md:col-span-2">
          <label className="text-gray-400 text-sm block mb-2">
            Game Pool %
          </label>
          <div className="text-white text-xl font-bold">{gamePool}%</div>
        </div>
      </div>
    </div>
  );
}

// Multipliers Tab
// Multipliers Tab - READ ONLY
function MultipliersTab({ settings }: any) {
    // Hardcoded from Contract
    const cashout = 2;
    const reinvest = 6;
    const winnerReferral = 15;

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">🎰 Win Multipliers (Immutable)</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">
            Cashout (X)
          </label>
            <div className="text-white text-center text-3xl font-bold">{cashout}X</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">
            Reinvest (X)
          </label>
            <div className="text-white text-center text-3xl font-bold">{reinvest}X</div>
        </div>
        <div className="bg-gray-800/50 p-4 rounded-lg">
          <label className="text-gray-400 text-sm block mb-2">
            Winner Referral (%)
          </label>
            <div className="text-white text-center text-3xl font-bold">{winnerReferral}%</div>
        </div>
      </div>
    </div>
  );
}

// Wallets Tab
function WalletsTab({ writeContract, isPending }: any) {
  const defaultAddr = "0x0933535DBcec563725Ba08a30927CBaC83B3Bf63";
  const [creatorWallet, setCreatorWallet] = useState(defaultAddr);
  const [fewWallet, setFewWallet] = useState(defaultAddr);
  const [bdWallets, setBdWallets] = useState<string[]>(Array(24).fill(defaultAddr));

  // Fetch current wallets on mount
  const { data: walletsData } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getWallets",
  });

  useEffect(() => {
    if (walletsData) {
      const [creator, few, bd] = walletsData as any;

      setCreatorWallet(creator && creator !== "0x0000000000000000000000000000000000000000" ? creator : defaultAddr);
      setFewWallet(few && few !== "0x0000000000000000000000000000000000000000" ? few : defaultAddr);

      const newBd = (Array.from(bd) as string[]).map((addr) =>
        addr && addr !== "0x0000000000000000000000000000000000000000" ? addr : defaultAddr
      );
      setBdWallets(newBd.length ? newBd : Array(24).fill(defaultAddr));
    } else {
      setCreatorWallet(defaultAddr);
      setFewWallet(defaultAddr);
      setBdWallets(Array(24).fill(defaultAddr));
    }
  }, [walletsData]);

  const handleUpdate = () => {
    if (isPending) return;
    const safeBdWallets = bdWallets.map((addr) => (addr && addr.trim() !== "" ? addr : defaultAddr));

    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "updateWallets",
      args: [creatorWallet || defaultAddr, fewWallet || defaultAddr, safeBdWallets],
    });
  };

  const handleBdWalletChange = (index: number, value: string) => {
    const newWallets = [...bdWallets];
    newWallets[index] = value;
    setBdWallets(newWallets);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold">💳 Wallet Addresses</h2>
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <label className="text-gray-400 text-sm block mb-2">
          Creator Wallet
        </label>
        <input
          type="text"
          value={creatorWallet}
          onChange={(e) => setCreatorWallet(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
          placeholder="0x..."
        />
      </div>
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <label className="text-gray-400 text-sm block mb-2">FEW Wallet</label>
        <input
          type="text"
          value={fewWallet}
          onChange={(e) => setFewWallet(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
          placeholder="0x..."
        />
      </div>
      <div className="bg-gray-800/50 p-4 rounded-lg">
        <label className="text-gray-400 text-sm block mb-4">
          BD Wallets (24)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {bdWallets.map((wallet, index) => (
            <div key={index}>
              <label className="text-gray-500 text-xs mb-1 block">
                BD #{index + 1}
              </label>
              <input
                type="text"
                value={wallet}
                onChange={(e) => handleBdWalletChange(index, e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-xs"
                placeholder={`0x... (BD ${index + 1})`}
              />
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={() => {
          setCreatorWallet(defaultAddr);
          setFewWallet(defaultAddr);
          setBdWallets(Array(24).fill(defaultAddr));
        }}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
      >
        Fill All With Default Address
      </button>

      <button
        onClick={handleUpdate}
        disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg"
      >
        {isPending ? "⏳ Updating..." : "💾 Update Wallets"}
      </button>
    </div>
  );
}

// --------------------------------------------------------------------------
// HELPERS
// --------------------------------------------------------------------------
const timeAgo = (timestamp: string) => {
  if (!timestamp) return "-";
  const seconds = Math.floor(
    (new Date().getTime() - Number(timestamp) * 1000) / 1000,
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const formatValue = (val: string) => {
  if (!val || val === "0") return "-";
  return Number(formatUnits(BigInt(val), 18)).toFixed(4);
};

// --------------------------------------------------------------------------
// COMPONENT
// --------------------------------------------------------------------------

export function TransactionsTab({ filter, setFilter }: any) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [debugMsg, setDebugMsg] = useState("");
  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d' | 'all'>('24h');

  useEffect(() => {
    const fetchHistoryFromBackend = async () => {
      setLoading(true);
      setDebugMsg("");

      try {
        const res = await fetch(API_ENDPOINTS.GET_ADMIN_HISTORY);
        if (!res.ok) throw new Error("Failed to reach backend");
        const data = await res.json();
        
        if (data.success) {
          const combined = [
            ...data.deposits.map((tx: any) => ({ ...tx, type: "deposit", functionName: "Deposit USDT" })),
            ...data.withdrawals.map((tx: any) => ({ ...tx, type: "withdrawal", functionName: "Withdraw USDT", value: tx.totalRequested })),
            ...data.luckyTickets.map((tx: any) => ({ ...tx, type: "lucky", functionName: `Buy Lucky Tickets (${tx.drawType === 1 ? 'Golden' : 'Silver'})`, value: parseUnits((tx.count * (tx.drawType === 1 ? 10 : 1)).toString(), 18).toString() })),
            ...data.bets.map((tx: any) => ({ ...tx, type: "bet", functionName: `Place Bet (${tx.isCash ? 'Cash' : 'Practice'})` })),
            ...data.winnings.map((tx: any) => ({ ...tx, type: "win", functionName: "Claim Win" })),
            ...data.incomes.map((tx: any) => ({ ...tx, type: "income", functionName: `Income: ${tx.source}` })),
            ...(data.conversions || []).map((tx: any) => ({ ...tx, type: "conversion", functionName: "Convert Practice to Cash", value: tx.amount })),
            ...(data.rewards || []).map((tx: any) => ({ ...tx, type: "reward", functionName: `Practice Reward (L${tx.level})`, value: tx.amount })),
          ];

          // Sort by timestamp descending
          combined.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
          setTransactions(combined);
          
          if (combined.length === 0) {
            setDebugMsg("No records found in the backend database yet.");
          }
        } else {
          throw new Error("Backend failed to return records.");
        }
      } catch (err: any) {
        console.error("Fetch Error:", err);
        setDebugMsg(err.message || "Failed to fetch data from backend. Make sure the backend server is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistoryFromBackend();
    const interval = setInterval(fetchHistoryFromBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter Logic
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart =
    timeWindow === '24h' ? nowSec - 24 * 60 * 60 :
    timeWindow === '7d' ? nowSec - 7 * 24 * 60 * 60 :
    timeWindow === '30d' ? nowSec - 30 * 24 * 60 * 60 :
    0;

  const filteredTx = transactions.filter((tx) => {
    const typeOk = filter === "all" ? true : tx.type === filter;
    const timeOk = timeWindow === 'all' ? true : Number(tx.timestamp || 0) >= windowStart;
    return typeOk && timeOk;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">📜 Platform Transaction History</h2>
          <p className="text-gray-400 text-sm">
            Fetching activity from <span className="text-blue-400 font-mono">Backend Database</span>
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none w-full"
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white outline-none w-full"
          >
            <option value="all">All Transactions</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="bet">Bets</option>
            <option value="win">Winnings</option>
            <option value="lucky">Lucky Tickets</option>
            <option value="income">Incomes</option>
            <option value="conversion">Conversions</option>
            <option value="reward">Practice Rewards</option>
          </select>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {debugMsg && (
        <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-lg text-blue-400 text-sm font-mono break-all leading-tight">
          ℹ️ {debugMsg}
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left">
            <thead className="bg-gray-800 sticky top-0">
              <tr className="text-gray-400 text-xs uppercase">
                <th className="p-4">Type</th>
                <th className="p-4">Hash</th>
                <th className="p-4">Action</th>
                <th className="p-4">Age</th>
                <th className="p-4">Address</th>
                <th className="p-4 text-right">Value (USDT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center animate-pulse">
                    Loading Backend Data...
                  </td>
                </tr>
              ) : filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No records found
                  </td>
                </tr>
              ) : (
                filteredTx.map((tx, idx) => (
                  <tr key={`${tx.hash}-${idx}`} className="hover:bg-white/5">
                    <td className="p-4">
                      <span className={`text-[10px] border px-2 py-0.5 rounded uppercase font-black ${
                        tx.type === 'deposit' ? 'text-green-400 border-green-500/30' :
                        tx.type === 'withdrawal' ? 'text-red-400 border-red-500/30' :
                        tx.type === 'win' ? 'text-yellow-400 border-yellow-500/30' :
                        tx.type === 'income' ? 'text-purple-300 border-purple-500/30' :
                        tx.type === 'reward' ? 'text-cyan-300 border-cyan-500/30' :
                        'text-blue-400 border-blue-500/30'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-blue-400">
                      <a
                        href={tx.hash ? `https://bscscan.com/tx/${tx.hash}` : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {tx.hash ? `${tx.hash.slice(0, 8)}...` : 'N/A'}
                      </a>
                    </td>
                    <td className="p-4 text-xs text-gray-300 font-mono">
                      {tx.functionName}
                    </td>
                    <td className="p-4 text-xs text-gray-400 whitespace-nowrap">
                      {timeAgo(tx.timestamp)}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-500">
                      {tx.userAddress?.slice(0, 6)}...{tx.userAddress?.slice(-4)}
                    </td>
                    <td className="p-4 text-right font-mono text-xs font-bold">
                      {tx.amount ? Number(formatUnits(BigInt(tx.amount), 18)).toFixed(2) : 
                       tx.value ? Number(formatUnits(BigInt(tx.value), 18)).toFixed(2) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


// Finance Tab
function FinanceTab({ adminBalance, writeContract, isPending }: any) {
  const handleWithdraw = () => {
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "withdraw",
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">💰 Finance Management</h2>

      <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
        <div className="text-green-400 text-sm mb-2">
          Available Admin Balance
        </div>
        <div className="text-5xl font-bold text-center">
          {adminBalance
            ? Number(formatUnits(adminBalance as bigint, 18)).toFixed(2)
            : "0"}{" "}
          USDT
        </div>
        <div className="text-center text-gray-400 text-sm mt-2">
          Platform fees collected
        </div>
      </div>

      <button
        onClick={handleWithdraw}
        disabled={isPending || !adminBalance || Number(adminBalance) === 0}
        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 rounded-lg text-lg transition-colors"
      >
        {isPending
          ? "⏳ Processing Withdrawal..."
          : "💸 Withdraw All Fees to Owner"}
      </button>

      {/* Financial Breakdown */}
      <div className="bg-gray-800/30 p-4 rounded-lg">
        <h4 className="text-white font-bold mb-3">💵 Fee Structure</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Platform Fee on Bets:</span>
            <span className="text-white font-bold">5%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Withdrawal Fee:</span>
            <span className="text-white font-bold">2 USDT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Activation Fee:</span>
            <span className="text-white font-bold">10 USDT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Registration Bonus:</span>
            <span className="text-white font-bold">100 USDT (Frozen)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Settings Tab
function SettingsTab({ writeContract, isPending }: any) {
  const [userAddress, setUserAddress] = useState("");

  const handleActivateUser = () => {
    if (!userAddress || isPending) return;
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "ownerActivateUser",
      args: [userAddress],
    });
    setUserAddress("");
  };

  const handleUnpruneUser = () => {
    if (!userAddress || isPending) return;
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: TRKGameABI.abi,
      functionName: "unpruneUser",
      args: [userAddress],
    });
    setUserAddress("");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">⚙️ Admin Settings & Tools</h2>

      <div className="bg-gray-800/50 p-6 rounded-lg space-y-4">
        <h3 className="text-lg font-bold">👤 User Management Tools</h3>
        <div>
          <label className="text-gray-400 text-sm">User Address</label>
          <input
            type="text"
            value={userAddress}
            onChange={(e) => setUserAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={handleActivateUser}
            disabled={isPending || !userAddress}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg"
          >
            {isPending ? "⏳..." : "✅ Activate User (Free)"}
          </button>
          <button
            onClick={handleUnpruneUser}
            disabled={isPending || !userAddress}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg"
          >
            {isPending ? "⏳..." : "♻️ Unprune User"}
          </button>
        </div>
        <p className="text-gray-500 text-xs italic">
          💡 Activate User: Bypass 10 USDT activation fee for specific users
          <br />
          💡 Unprune User: Restore accounts marked as inactive (30-day system)
        </p>
      </div>

      {/* Contract Info */}
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <h4 className="text-yellow-400 font-bold mb-2">
          📋 Contract Information
        </h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Contract Address:</span>
            <span className="text-white font-mono">
              {TRK_GAME_ADDRESS.slice(0, 10)}...
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Network:</span>
            <span className="text-white">BSC Mainnet (Chain ID: 56)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">USDT Decimals:</span>
            <span className="text-white">6</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Min Deposit:</span>
            <span className="text-white">1 USDT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Min Bet:</span>
            <span className="text-white">1 USDT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Min Withdrawal:</span>
            <span className="text-white">5 USDT</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-gray-800/30 p-4 rounded-lg">
        <h4 className="text-white font-bold mb-3">🔗 Quick Links</h4>
        <div className="space-y-2">
          <a
            href={`https://bscscan.com/address/${TRK_GAME_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-center"
          >
            📊 View on BSCScan
          </a>
          <a
            href={`https://bscscan.com/address/${TRK_GAME_ADDRESS}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-center"
          >
            📝 View Contract Code
          </a>
          <a
            href={`https://bscscan.com/address/${TRK_GAME_ADDRESS}#events`}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-center"
          >
            📜 View All Events
          </a>
        </div>
      </div>
    </div>
  );
}

// --- Advanced Economics Tab ---

function AdvancedEconomicsTab({ systemSettings, writeContract, isPending, treasuryAddr, gameAddr, cashbackAddr, luckyAddr }: any) {
  const [activeSubTab, setActiveSubTab] = useState("treasury");
  
  if (!systemSettings) return <div className="p-20 text-center animate-pulse">Loading system settings...</div>;

  const [tParams, tRef, cParams, cRoi, gParams, gRef, lParams, capsBefore, capsAfter, phaseThreshold] = systemSettings as any;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black">💎 Platform Economics</h2>
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full no-scrollbar pb-1">
          {["treasury", "cashback", "game", "luckydraw", "caps"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveSubTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-widest whitespace-nowrap ${
                activeSubTab === t ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
           key={activeSubTab}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           exit={{ opacity: 0, x: -20 }}
           transition={{ duration: 0.2 }}
        >
          {activeSubTab === "treasury" && (
            <TreasuryEconomics 
              params={tParams} 
              refs={tRef} 
              writeContract={writeContract} 
              isPending={isPending}
              treasuryAddr={treasuryAddr}
            />
          )}
          {activeSubTab === "cashback" && (
            <CashbackEconomics 
              params={cParams} 
              rois={cRoi} 
              writeContract={writeContract} 
              isPending={isPending}
              cashbackAddr={cashbackAddr}
            />
          )}
          {activeSubTab === "game" && (
            <GameEconomics 
              params={gParams} 
              refs={gRef} 
              writeContract={writeContract} 
              isPending={isPending}
              gameAddr={gameAddr}
            />
          )}
          {activeSubTab === "luckydraw" && (
            <LuckyEconomics 
              params={lParams} 
              writeContract={writeContract} 
              isPending={isPending}
              luckyAddr={luckyAddr}
            />
          )}
          {activeSubTab === "caps" && (
            <ReferralCapEconomics 
              capsBefore={capsBefore}
              capsAfter={capsAfter}
              threshold={phaseThreshold}
              writeContract={writeContract}
              isPending={isPending}
              cashbackAddr={cashbackAddr}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TreasuryEconomics({ params, refs, writeContract, isPending, treasuryAddr }: any) {
  const makeForm = (p: any) => ({
    minA: p ? formatUnits(BigInt(p[0] ?? 0), 18) : '',
    minW: p ? formatUnits(BigInt(p[1] ?? 0), 18) : '',
    maxW: p ? formatUnits(BigInt(p[2] ?? 0), 18) : '',
    fee:  p ? (p[3] ?? 0).toString() : '0',
    cP:   p ? (p[4] ?? 0).toString() : '0',
    bdP:  p ? (p[5] ?? 0).toString() : '0',
    fwP:  p ? (p[6] ?? 0).toString() : '0',
    rfP:  p ? (p[7] ?? 0).toString() : '0',
    clP:  p ? (p[8] ?? 0).toString() : '0',
    lkP:  p ? (p[9] ?? 0).toString() : '0',
    ptP:  p ? (p[10] ?? 0).toString() : '0',
  });
  const [form, setForm] = useState(() => makeForm(params));
  const [refPercents, setRefPercents] = useState<string[]>(() =>
    refs ? Array.from({ length: 15 }, (_, i) => (Number(refs[i] ?? 0) / 100).toString()) : Array(15).fill('0')
  );

  useEffect(() => { setForm(makeForm(params)); }, [params]);
  useEffect(() => {
    if (refs) setRefPercents(Array.from({ length: 15 }, (_, i) => (Number(refs[i] ?? 0) / 100).toString()));
  }, [refs]);

  // ✅ Call Treasury directly — Router's forwarders use onlyOwner on treasury, not onlyRouter
  const handleUpdateTreasury = () => {
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setTreasurySettings",
        args: [safeParseUnits(form.minA, 18), safeParseUnits(form.minW, 18), safeParseUnits(form.maxW, 18), safeBigInt(form.fee)],
      });
    } catch (e) { console.error(e); }
  };

  const handleUpdateDist = () => {
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setDistributions",
        args: [safeBigInt(form.cP), safeBigInt(form.bdP), safeBigInt(form.fwP), safeBigInt(form.rfP), safeBigInt(form.clP), safeBigInt(form.lkP), safeBigInt(form.ptP)],
      });
    } catch (e) { console.error(e); }
  };

  const handleUpdateRefs = () => {
    try {
      const padded = safePad15(refPercents.map(p => Math.round(Number(p || 0) * 100)));
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setReferralPercents",
        args: [padded as any],
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      <SectionCard title="General Thresholds" onSave={handleUpdateTreasury} isPending={isPending}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InputGroup label="Min Activation" value={form.minA} onChange={(v:any)=>setForm({...form, minA:v})} />
          <InputGroup label="Min Withdrawal" value={form.minW} onChange={(v:any)=>setForm({...form, minW:v})} />
          <InputGroup label="Max Daily Withdr" value={form.maxW} onChange={(v:any)=>setForm({...form, maxW:v})} />
          <InputGroup label="Withdraw Fee (%)" value={form.fee} onChange={(v:any)=>setForm({...form, fee:v})} />
        </div>
      </SectionCard>

      <SectionCard title="Ecosystem Distributions (%)" onSave={handleUpdateDist} isPending={isPending}>
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <InputGroup label="Creator" value={form.cP} onChange={(v:any)=>setForm({...form, cP:v})} />
          <InputGroup label="BD Org" value={form.bdP} onChange={(v:any)=>setForm({...form, bdP:v})} />
          <InputGroup label="Ops/FEW" value={form.fwP} onChange={(v:any)=>setForm({...form, fwP:v})} />
          <InputGroup label="Referral" value={form.rfP} onChange={(v:any)=>setForm({...form, rfP:v})} />
          <InputGroup label="Club" value={form.clP} onChange={(v:any)=>setForm({...form, clP:v})} />
          <InputGroup label="Lucky" value={form.lkP} onChange={(v:any)=>setForm({...form, lkP:v})} />
          <InputGroup label="Protection" value={form.ptP} onChange={(v:any)=>setForm({...form, ptP:v})} />
        </div>
      </SectionCard>

      <SectionCard title="Direct Referral Levels (%)" onSave={handleUpdateRefs} isPending={isPending}>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          {refPercents.map((p: string, i: number) => (
             <InputGroup 
               key={i} 
               label={`Level ${i+1}`} 
               value={p} 
               onChange={(v:any)=> {
                 const newP = [...refPercents];
                 newP[i] = v;
                 setRefPercents(newP);
               }} 
             />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function CashbackEconomics({ params, rois, writeContract, isPending, cashbackAddr }: any) {
  const makeForm = (p: any) => ({
    lcBps:     p ? (Number(p[0] ?? 0) / 10).toString() : '0',
    threshold: p ? formatUnits(BigInt(p[2] ?? 0), 18) : '0',
    luckyS:    p ? (p[3] ?? 0).toString() : '0',
    roiR:      p ? (p[4] ?? 0).toString() : '0',
    maxDaily:  p ? formatUnits(BigInt(p[5] ?? 0), 18) : '10',
  });
  const [form, setForm] = useState(() => makeForm(params));
  const [roiPercents, setRoiPercents] = useState<string[]>(() =>
    rois ? Array.from({ length: 15 }, (_, i) => (rois[i] ?? 0).toString()) : Array(15).fill('0')
  );

  useEffect(() => { setForm(makeForm(params)); }, [params]);
  useEffect(() => {
    if (rois) setRoiPercents(Array.from({ length: 15 }, (_, i) => (rois[i] ?? 0).toString()));
  }, [rois]);

  // ✅ Call CashbackEngine directly
  const handleUpdateCashback = () => {
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setCashbackSettings",
        args: [
          BigInt(Math.round(Number(form.lcBps || 0) * 10)),
          BigInt(0), // Removed Loss Referral
          safeParseUnits(form.threshold, 18),
          safeBigInt(form.luckyS),
          safeBigInt(form.roiR),
          safeParseUnits(form.maxDaily, 18)
        ],
      });
    } catch (e) { console.error(e); }
  };

  const handleUpdateRoiRefs = () => {
    try {
      const padded = safePad15(roiPercents.map(p => p || '0'));
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setRoiPercents",
        args: [padded as any],
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      <SectionCard title="Immediate Loss Protection & ROI" onSave={handleUpdateCashback} isPending={isPending}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <InputGroup label="Loss Cashback (%)" value={form.lcBps} onChange={(v:any)=>setForm({...form, lcBps:v})} />
          <InputGroup label="Minimum Net Loss (USDT)" value={form.threshold} onChange={(v:any)=>setForm({...form, threshold:v})} />
          <div className="bg-pink-500/10 p-4 rounded-xl border border-pink-500/20">
            <InputGroup label="Lucky Share (%)" value={form.luckyS} onChange={(v:any)=>setForm({...form, luckyS:v})} />
            <p className="text-[10px] text-pink-400 mt-2 font-bold uppercase tracking-tighter">Pool Split</p>
          </div>
          <InputGroup label="ROI Pool Ratio (%)" value={form.roiR} onChange={(v:any)=>setForm({...form, roiR:v})} />
          <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
            <InputGroup label="Max Daily Cashback (USDT)" value={form.maxDaily} onChange={(v:any)=>setForm({...form, maxDaily:v})} />
            <p className="text-[10px] text-blue-400 mt-2 font-bold uppercase tracking-tighter">Per ID Daily Cap</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Sustainable ROI Levels (%)" onSave={handleUpdateRoiRefs} isPending={isPending}>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          {roiPercents.map((p: string, i: number) => (
             <InputGroup 
               key={i} 
               label={`Level ${i+1}`} 
               value={p} 
               onChange={(v:any)=> {
                 const newP = [...roiPercents];
                 newP[i] = v;
                 setRoiPercents(newP);
               }} 
             />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function GameEconomics({ params, refs, writeContract, isPending, gameAddr }: any) {
  const makeForm = (p: any) => ({
    wc: p ? (p[0] ?? 0).toString() : '0',
    wr: p ? (p[1] ?? 0).toString() : '0',
    pl: p ? (p[2] ?? 0).toString() : '0',
    cl: p ? (p[3] ?? 0).toString() : '0',
  });
  const [form, setForm] = useState(() => makeForm(params));
  const [refPercents, setRefPercents] = useState<string[]>(() =>
    refs ? Array.from({ length: 15 }, (_, i) => (Number(refs[i] ?? 0) / 100).toString()) : Array(15).fill('0')
  );

  useEffect(() => { setForm(makeForm(params)); }, [params]);
  useEffect(() => {
    if (refs) setRefPercents(Array.from({ length: 15 }, (_, i) => (Number(refs[i] ?? 0) / 100).toString()));
  }, [refs]);

  // ✅ Call GameEngine directly
  const handleUpdateGame = () => {
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setGameSettings",
        args: [safeBigInt(form.wc), safeBigInt(form.wr), safeBigInt(form.pl), safeBigInt(form.cl)],
      });
    } catch (e) { console.error(e); }
  };

  const handleUpdateWinRefs = () => {
    try {
      const padded = safePad15(refPercents.map(p => Math.round(Number(p || 0) * 100)));
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setWinnerReferralPercents",
        args: [padded as any],
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      <SectionCard title="Win Multipliers & Limits" onSave={handleUpdateGame} isPending={isPending}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <InputGroup label="Win Cashout (X)" value={form.wc} onChange={(v:any)=>setForm({...form, wc:v})} />
          <InputGroup label="Win Reinvest (X)" value={form.wr} onChange={(v:any)=>setForm({...form, wr:v})} />
          <InputGroup label="Practice Limit / Day" value={form.pl} onChange={(v:any)=>setForm({...form, pl:v})} />
          <InputGroup label="Cash Limit / Day" value={form.cl} onChange={(v:any)=>setForm({...form, cl:v})} />
        </div>
        <p className="text-xs text-gray-500 mt-4">Total Win Payout is {(Number(form.wc) + Number(form.wr))}X. Whitepaper standard is 8X (2X Cash + 6X Re-bet).</p>
      </SectionCard>

      <SectionCard title="Winner Referral Levels (%)" onSave={handleUpdateWinRefs} isPending={isPending}>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          {refPercents.map((p: string, i: number) => (
             <InputGroup 
               key={i} 
               label={`Level ${i+1}`} 
               value={p} 
               onChange={(v:any)=> {
                 const newP = [...refPercents];
                 newP[i] = v;
                 setRefPercents(newP);
               }} 
             />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function LuckyEconomics({ params, writeContract, isPending, luckyAddr }: any) {
  const makeForm = (p: any) => ({
    mt: p ? (p[0] ?? 0).toString() : '0',
    gp: p ? formatUnits(BigInt(p[1] ?? 0), 18) : '0',
    sp: p ? formatUnits(BigInt(p[2] ?? 0), 18) : '0',
  });
  const [form, setForm] = useState(() => makeForm(params));

  useEffect(() => { setForm(makeForm(params)); }, [params]);

  // ✅ Call LuckyDraw directly
  const handleUpdateLucky = () => {
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setLuckyDrawSettings",
        args: [safeBigInt(form.mt), safeParseUnits(form.gp, 18), safeParseUnits(form.sp, 18)],
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-8">
      <SectionCard title="Lucky Draw Parameters" onSave={handleUpdateLucky} isPending={isPending}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputGroup label="Max Tickets (per draw)" value={form.mt} onChange={(v:any)=>setForm({...form, mt:v})} />
          <InputGroup label="Golden Price (USDT)" value={form.gp} onChange={(v:any)=>setForm({...form, gp:v})} />
          <InputGroup label="Silver Price (USDT)" value={form.sp} onChange={(v:any)=>setForm({...form, sp:v})} />
        </div>
      </SectionCard>
      
      <div className="bg-yellow-900/10 border border-yellow-500/20 p-6 rounded-2xl">
         <h3 className="font-bold text-yellow-500 mb-2">💡 Prize Tiers Logic</h3>
         <p className="text-sm text-gray-400">Prize Amounts for all 8 tiers of Golden & Silver draws can be updated via specific contract functions if needed. Currently using standard whitepaper ratios.</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children, onSave, isPending }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 md:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h3 className="text-lg font-bold text-gray-300">{title}</h3>
        {onSave && (
          <button 
            onClick={onSave}
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            {isPending ? "⏳ Updating..." : "💾 Save Changes"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// User Detail Modal
function UserDetailModal({ userId, onClose }: any) {
  const { data: addr } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "idToAddress",
    args: [BigInt(userId)],
  });

  const { data: userData } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getUserInfo",
    args: [addr || "0x0000000000000000000000000000000000000000"],
  });

  const { data: refCode } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "addressToReferralCode",
    args: [addr || "0x0000000000000000000000000000000000000000"],
  });

  if (!userData) return null;

  const user = userData as any;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            User #{userId} Complete Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* Address */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Wallet Address</div>
            <div className="text-white font-mono text-sm break-all">
              {addr as string}
            </div>
            <a
              href={`https://bscscan.com/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-xs"
            >
              View on BSCScan →
            </a>
          </div>

          {/* Referral Code */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Referral Code</div>
            <div className="text-white font-mono text-lg font-bold">
              {refCode as string}
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
              <div className="text-green-400 text-sm">Active Wallet</div>
              <div className="text-2xl font-bold text-white">
                {Number(formatUnits(user[3] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
              <div className="text-blue-400 text-sm">Practice Balance</div>
              <div className="text-2xl font-bold text-white">
                {Number(formatUnits(user[4] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Total Deposited</div>
              <div className="text-xl font-bold text-yellow-400">
                {Number(formatUnits(user[6] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Total Withdrawn</div>
              <div className="text-xl font-bold text-red-400">
                {Number(formatUnits(user[7] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Direct Income</div>
              <div className="text-xl font-bold text-purple-400">
                {Number(formatUnits(user[9] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
            <div className="bg-gray-800/50 p-4 rounded-lg">
              <div className="text-gray-400 text-sm">Total Bets</div>
              <div className="text-xl font-bold text-blue-400">
                {Number(formatUnits(user[22] ?? BigInt(0), 18)).toFixed(2)} USDT
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <div className="text-gray-400 text-sm mb-2">Account Status</div>
            <div className="flex gap-2">
              {user[28] ? (
                <span className="bg-green-900/50 text-green-400 px-3 py-1 rounded border border-green-800">
                  ✅ Registered
                </span>
              ) : (
                <span className="bg-red-900/50 text-red-400 px-3 py-1 rounded border border-red-800">
                  ❌ Not Registered
                </span>
              )}
              {user[30] && (
                <span className="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded border border-yellow-800">
                  💎 Cash Player
                </span>
              )}
            </div>
          </div>

          {/* Referrer */}
          <div className="bg-gray-800/50 p-4 rounded-lg">
            <div className="text-gray-400 text-sm">Referrer Address</div>
            <div className="text-white font-mono text-sm">
              {user[1] !== "0x0000000000000000000000000000000000000000"
                ? user[1]
                : "No Referrer"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferralCapEconomics({ capsBefore, capsAfter, threshold, writeContract, isPending, cashbackAddr }: any) {
  const makeSettings = () => ({
    threshold: threshold ? Number(threshold) : 10000,
    before: { 
      5:  capsBefore ? Number(capsBefore[2]?.multiplier ?? 2) * 100 : 200, 
      10: capsBefore ? Number(capsBefore[1]?.multiplier ?? 4) * 100 : 400, 
      20: capsBefore ? Number(capsBefore[0]?.multiplier ?? 8) * 100 : 800 
    },
    after: { 
      5:  capsAfter ? Number(capsAfter[2]?.multiplier ?? 2) * 100 : 200, 
      10: capsAfter ? Number(capsAfter[1]?.multiplier ?? 3) * 100 : 300, 
      20: capsAfter ? Number(capsAfter[0]?.multiplier ?? 4) * 100 : 400 
    }
  });

  const [settings, setSettings] = useState(makeSettings);

  useEffect(() => {
    setSettings(makeSettings());
  }, [capsBefore, capsAfter, threshold]);

  const handleSave = async () => {
    try {
      // 1. Update Threshold
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setPhaseThreshold",
        args: [BigInt(settings.threshold)],
      });

      // 2. Update Before Caps
      const capsBeforeArr = [
        { directs: BigInt(20), multiplier: BigInt(settings.before[20]) / BigInt(100) },
        { directs: BigInt(10), multiplier: BigInt(settings.before[10]) / BigInt(100) },
        { directs: BigInt(5),  multiplier: BigInt(settings.before[5]) / BigInt(100) },
        { directs: BigInt(0),  multiplier: BigInt(1) }
      ];
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setCapMultipliersBefore10k",
        args: [capsBeforeArr as any],
      });

      // 3. Update After Caps
      const capsAfterArr = [
        { directs: BigInt(20), multiplier: BigInt(settings.after[20]) / BigInt(100) },
        { directs: BigInt(10), multiplier: BigInt(settings.after[10]) / BigInt(100) },
        { directs: BigInt(5),  multiplier: BigInt(settings.after[5]) / BigInt(100) },
        { directs: BigInt(0),  multiplier: BigInt(1) }
      ];
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "setCapMultipliersAfter10k",
        args: [capsAfterArr as any],
      });

      alert("Transaction(s) submitted to blockchain! Confirm up to 3 transactions in sequence.");
    } catch (e) {
      console.error(e);
      alert("Failed to update settings");
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl transition-all hover:bg-white/[0.07]">
         <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
           <span className="text-yellow-400">🚀</span> 
           Income Cap Thresholds
         </h3>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2 block">User Count Milestone</label>
                  <input 
                    type="number" 
                    value={settings.threshold} 
                    onChange={e => setSettings({...settings, threshold: Number(e.target.value)})}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xl font-bold focus:border-yellow-500 outline-none transition-all placeholder-gray-700"
                    placeholder="10000"
                  />
                  <p className="text-[10px] text-gray-500 mt-2 px-1 italic font-medium">When the platform reaches this many users, the 'After Milestone' caps will apply.</p>
               </div>
            </div>

            <div className="flex items-center justify-center p-6 bg-yellow-500/5 rounded-3xl border border-yellow-500/10">
               <div className="text-center">
                  <div className="text-4xl font-black text-yellow-500 mb-1 leading-none">{settings.threshold.toLocaleString()}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60 mt-1">Target Users</div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* BEFORE BOX */}
         <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl transition-all hover:bg-white/[0.07]">
            <h4 className="text-lg font-black mb-6 text-blue-400 uppercase tracking-widest flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
               Before Milestone
            </h4>
            <div className="space-y-6">
               {[5, 10, 20].map(tier => (
                  <div key={tier} className="flex items-center gap-4 group">
                     <div className="w-24 text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">{tier} Directs:</div>
                     <div className="relative flex-1">
                        <input 
                          type="number"
                          value={settings.before[tier as 5|10|20]}
                          onChange={e => setSettings({
                            ...settings, 
                            before: {...settings.before, [tier]: Number(e.target.value)}
                          })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-bold focus:border-blue-500 outline-none transition-all"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">% Factor</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>

         {/* AFTER BOX */}
         <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/10 shadow-2xl transition-all hover:bg-white/[0.07]">
            <h4 className="text-lg font-black mb-6 text-pink-400 uppercase tracking-widest flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
               After Milestone
            </h4>
            <div className="space-y-6">
               {[5, 10, 20].map(tier => (
                  <div key={tier} className="flex items-center gap-4 group">
                     <div className="w-24 text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-pink-400 transition-colors">{tier} Directs:</div>
                     <div className="relative flex-1">
                        <input 
                          type="number"
                          value={settings.after[tier as 5|10|20]}
                          onChange={e => setSettings({
                            ...settings, 
                            after: {...settings.after, [tier]: Number(e.target.value)}
                          })}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-bold focus:border-pink-500 outline-none transition-all"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">% Factor</div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       </div>

      <div className="pt-4">
        <button 
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-6 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 rounded-2xl font-black text-xl text-black shadow-xl shadow-yellow-900/20 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <span>💾</span> {isPending ? "SENDING TO BLOCKCHAIN..." : "SAVE CAP SETTINGS"}
        </button>
        
        <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-6 bg-black/20 py-4 rounded-2xl border border-white/5 mx-auto max-w-lg">
           ⚠️ These changes directly modify the smart contract ROI logic. 
        </p>
      </div>
    </div>
  );
}

