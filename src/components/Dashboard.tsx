import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { formatUnits, parseUnits, parseAbiItem, decodeEventLog } from "viem";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { TRK_ADDRESSES } from "../config/contractAddresses";
import TRKRouterABI from "../abis/TRKRouter.json";
import TRKRegistryABI from "../abis/TRKUserRegistry.json";
import TRKTreasuryABI from "../abis/TRKTreasury.json";
import USDTABI from "../abis/USDT.json";
import { API_ENDPOINTS } from "../config/backend";
import { useEcosystemConfig } from "./EcosystemConfig";

// Sub-components
import RegistrationPanel from "./RegistrationPanel";
import UserBetHistory from "./UserBetHistory";
import LuckyDrawSection from "./LuckyDrawSection";

// --- UTILS & VARIANTS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const containerVar: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVar: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 70, damping: 15 },
  },
};

function WinnerBalancesCard({ digitBalances }: { digitBalances: bigint[] }) {
  const hasBalance = digitBalances.some((bal) => bal > BigInt(0));

  if (!hasBalance) return null;

  return (
    <motion.div
      variants={itemVar}
      className="col-span-1 md:col-span-2 lg:col-span-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl">🏆</span>
        <div>
          <h3 className="text-yellow-400 font-black uppercase text-sm tracking-tighter">
            Winner Digit Balances (6X Re-investment)
          </h3>
          <p className="text-[10px] text-gray-400 italic">
            Winnings can only be re-invested on the digit they were won on.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
        {digitBalances.map((bal, idx) => (
          <div
            key={idx}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
              bal > BigInt(0)
                ? "bg-yellow-500/20 border-yellow-500/50"
                : "bg-black/20 border-white/5 opacity-40",
            )}
          >
            <span className="text-xs font-black text-white mb-1">{idx}</span>
            <span className="text-[10px] font-mono font-bold text-yellow-400">
              {Number(formatUnits(bal, 18)).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ...

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { writeContract: writeCashback, isPending: isCashbackPending } =
    useWriteContract();
  const [liveActiveDirects, setLiveActiveDirects] = useState<number | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWrongNetwork =
    isConnected && chain?.id !== 56 && chain?.id !== 97 && chain?.id !== 31337;

  // --- DATA FETCHING ---
  // Use Router for getUserInfo
  const { data: userData, isLoading: isUserLoading } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getUserInfo",
    args: [address],
    query: {
      enabled: isConnected && !!address && !isWrongNetwork,
      refetchInterval: 30000,
    },
  });

  const { data: referralCode } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "addressToReferralCode",
    args: [address],
    query: { enabled: isConnected && !!address && !isWrongNetwork },
  });

  const { data: usdtBalance } = useReadContract({
    address: TRK_ADDRESSES.USDT,
    abi: USDTABI.abi,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: isConnected && !!address, refetchInterval: 30000 },
  });

  const { data: platformStats } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getPlatformStats",
    query: { refetchInterval: 60000 },
  });

  const { data: systemSettings } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getSystemSettings",
  });

  const { data: allSettings } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getAllSettings",
  });

  const directReferralsFromUserData = useMemo(() => {
    const u = userData as any;
    return u?.directReferrals ?? (Array.isArray(u) ? u[31] : BigInt(0));
  }, [userData]);

  const directReferralCount = useMemo(() => {
    try {
      return Number(directReferralsFromUserData ?? BigInt(0));
    } catch {
      return 0;
    }
  }, [directReferralsFromUserData]);

  useEffect(() => {
    if (!isConnected || !address || !publicClient || isWrongNetwork) {
      setLiveActiveDirects(null);
      return;
    }

    if (!directReferralCount) {
      setLiveActiveDirects(0);
      return;
    }

    let cancelled = false;

    const toBigIntSafe = (val: any) => {
      try {
        if (typeof val === "bigint") return val;
        if (typeof val === "number") return BigInt(Math.trunc(val));
        return BigInt(val ?? 0);
      } catch {
        return BigInt(0);
      }
    };

    // Active direct should align with account activation threshold.
    const minActivationFromSettings = (() => {
      const s = allSettings as any;
      if (Array.isArray(s)) return s[0] ?? parseUnits("10", 18);
      if (s && typeof s === "object")
        return s.minActivation ?? parseUnits("10", 18);
      return parseUnits("10", 18);
    })();
    const MIN_ACTIVE_DEPOSIT = toBigIntSafe(minActivationFromSettings);

    (async () => {
      try {
        const directContracts = Array.from(
          { length: directReferralCount },
          (_, i) => ({
            address: TRK_ADDRESSES.ROUTER,
            abi: TRKRouterABI.abi,
            functionName: "directReferralsList",
            args: [address, BigInt(i)],
          }),
        );

        const directResults = await publicClient.multicall({
          contracts: directContracts as any,
          allowFailure: true,
        });

        const directAddresses = directResults
          .filter(
            (r: any) => r?.status === "success" && typeof r.result === "string",
          )
          .map((r: any) => r.result as `0x${string}`);

        if (directAddresses.length === 0) {
          if (!cancelled) setLiveActiveDirects(0);
          return;
        }

        const infoContracts = directAddresses.map((refAddr) => ({
          address: TRK_ADDRESSES.ROUTER,
          abi: TRKRouterABI.abi,
          functionName: "getUserInfo",
          args: [refAddr],
        }));

        const infoResults = await publicClient.multicall({
          contracts: infoContracts as any,
          allowFailure: true,
        });

        let active = 0;
        for (const r of infoResults as any[]) {
          if (r?.status !== "success" || !r.result) continue;
          const info = r.result as any;
          const isCashPlayer = Boolean(
            info?.isCashPlayer ?? info?.[30] ?? false,
          );
          const cumulative = info?.cumulativeDeposit ?? info?.[8] ?? BigInt(0);
          const total = info?.totalDeposit ?? info?.[6] ?? BigInt(0);
          const cumulativeBI = toBigIntSafe(cumulative);
          const totalBI = toBigIntSafe(total);
          if (
            isCashPlayer ||
            cumulativeBI >= MIN_ACTIVE_DEPOSIT ||
            totalBI >= MIN_ACTIVE_DEPOSIT
          )
            active += 1;
        }

        if (!cancelled) setLiveActiveDirects(active);
      } catch {
        if (!cancelled) setLiveActiveDirects(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isConnected,
    address,
    publicClient,
    isWrongNetwork,
    directReferralCount,
    allSettings,
  ]);

  // --- LOADING / ERROR STATES ---
  if (!mounted) return <LoadingScreen />;
  if (!isConnected)
    return (
      <EmptyState
        icon="🔌"
        title="Wallet Disconnected"
        desc="Please connect your wallet to access the dashboard."
      />
    );
  if (isWrongNetwork)
    return <NetworkErrorState chainName={chain?.name} chainId={chain?.id} />;

  // Skeleton while loading profile
  if (isUserLoading && !userData) return <DashboardSkeleton />;

  // --- DATA PARSING ---
  const dataList = userData ? (userData as any) : null;
  const pStats = platformStats ? (platformStats as any) : null;
  const totalUsers = pStats?.users ?? pStats?.[0] ?? BigInt(0);

  // Handle Struct Object (Viem) vs Tuple Array (Ethers/Old Wagmi)
  const userId = dataList?.userId ?? dataList?.[0];
  const isActuallyRegistered =
    dataList?.isRegistered ?? dataList?.[28] ?? false;

  if (!isActuallyRegistered || !userId || BigInt(userId) === BigInt(0)) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="container mx-auto px-4 py-12 flex justify-center"
      >
        <RegistrationPanel />
      </motion.div>
    );
  }

  // Parse User Data with Fallbacks
  const id = userId;
  const referrer = dataList?.referrer ?? dataList?.[1];
  const registrationTime = dataList?.registrationTime ?? dataList?.[2];

  const isPractice = dataList?.isPracticePlayer ?? dataList?.[29] ?? false;
  const isCash = dataList?.isCashPlayer ?? dataList?.[30] ?? false;

  const walletBalance = dataList?.walletBalance ?? dataList?.[3];
  const directReferralIncome =
    dataList?.directReferralIncome ?? dataList?.[9] ?? BigInt(0);
  const practiceBalance =
    dataList?.practiceBalance ?? dataList?.[4] ?? BigInt(0);

  const cashGameBalance = dataList?.cashGameBalance ?? dataList?.[5];
  const totalDeposit = dataList?.totalDeposit ?? dataList?.[6];
  const cumulativeDeposit = dataList?.cumulativeDeposit ?? dataList?.[8];

  const luckyDrawWallet =
    dataList?.luckyDrawWallet ?? dataList?.[16] ?? BigInt(0);
  const digitBalances =
    dataList?.digitBalances ?? dataList?.[20] ?? Array(10).fill(BigInt(0));
  const directReferrals =
    dataList?.directReferrals ?? dataList?.[31] ?? BigInt(0);
  const activeDirects = dataList?.activeDirects ?? dataList?.[32] ?? BigInt(0);
  const totalReferralsDisplay = Number(directReferrals ?? BigInt(0));
  const activeDirectsDisplay = Math.max(
    Number(activeDirects ?? BigInt(0)),
    liveActiveDirects ?? 0,
  );

  // Literal Gross Income (All sources)
  const totalEarningsGross =
    (dataList?.directReferralIncome ??
      (Array.isArray(dataList) ? dataList[9] : BigInt(0))) +
    (dataList?.winnerReferralIncome ??
      (Array.isArray(dataList) ? dataList[10] : BigInt(0))) +
    (dataList?.cashbackIncome ??
      (Array.isArray(dataList) ? dataList[12] : BigInt(0))) +
    (dataList?.lossReferralIncome ??
      (Array.isArray(dataList) ? dataList[13] : BigInt(0))) +
    (dataList?.clubIncome ??
      (Array.isArray(dataList) ? dataList[14] : BigInt(0))) +
    (dataList?.luckyDrawIncome ??
      (Array.isArray(dataList) ? dataList[15] : BigInt(0))) +
    (dataList?.totalWins ??
      (Array.isArray(dataList) ? dataList[23] : BigInt(0)));

  const totalEarned = formatUnits(totalEarningsGross, 18);
  const totalSpent = dataList?.totalBets ?? dataList?.[22] ?? BigInt(0);
  const totalWins = dataList?.totalWins ?? dataList?.[23] ?? BigInt(0);

  // Cashback qualification is strictly Total Bets vs Total Wins
  const isNetProfit = totalWins >= totalSpent;

  // Helper for formatting
  const formatBal = (val: any) =>
    val
      ? Number(formatUnits(val, 18)).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";

  const displayUsdtBalance = usdtBalance
    ? formatUnits(usdtBalance as bigint, 18)
    : "0";
  const hasLowUsdt = parseFloat(displayUsdtBalance) < 1;

  // Calculate Cap Logic with Configurable Thresholds
  const activeRefCount = activeDirectsDisplay;

  // Use Live Settings from Contract
  let capsBefore: any[] = [];
  let capsAfter: any[] = [];
  let threshold = 10000;

  if (systemSettings && Array.isArray(systemSettings)) {
    capsBefore = systemSettings[7] as any[];
    capsAfter = systemSettings[8] as any[];
    threshold = Number(systemSettings[9] || 10000);
  } else if (systemSettings && typeof systemSettings === "object") {
    // Handle object if returned as named keys
    const s = systemSettings as any;
    capsBefore = s.capsBefore || [];
    capsAfter = s.capsAfter || [];
    threshold = Number(s.phaseThreshold || 10000);
  }

  const isPostThreshold = Number(totalUsers) >= threshold;
  const activeCaps = isPostThreshold ? capsAfter : capsBefore;

  let capMult = 1;
  if (activeCaps && activeCaps.length > 0) {
    for (const cap of activeCaps) {
      if (activeRefCount >= Number(cap.directs)) {
        capMult = Number(cap.multiplier);
        break;
      }
    }
  }

  return (
    <motion.div
      variants={containerVar}
      initial="hidden"
      animate="show"
      className="w-full max-w-7xl mx-auto mt-4 md:mt-8 px-4 pb-20 space-y-8"
    >
      {/* --- ALERTS SECTION --- */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {hasLowUsdt && (
            <AlertBanner
              key="low-bal"
              type="error"
              title="Low USDT Balance"
              desc={`Wallet: ${Number(displayUsdtBalance).toFixed(
                2,
              )} USDT. You need USDT to play.`}
              action={{
                label: "Get USDT",
                url: "https://pancakeswap.finance/swap?outputCurrency=0x55d398326f99059fF775485246999027B3197955",
              }}
            />
          )}
          {isPractice && !isCash && (
            <motion.div key="practice-mode" variants={itemVar}>
              <CountdownTimer registrationTime={registrationTime} />
              <PracticeModeBanner balance={formatBal(practiceBalance)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* HERO: Referral Code Top Access */}
        <motion.div variants={itemVar} className="w-full">
          <ReferralCodeCard code={referralCode as string} isHero />
        </motion.div>
      </div>

      {/* --- DASHBOARD HUB --- */}
      <div className="space-y-12">
        {/* SECTION 1: PRACTICE HUB */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-blue-400 flex items-center gap-3 italic uppercase tracking-tighter">
            <span className="bg-blue-500/20 p-2 rounded-xl not-italic">🎮</span>
            Practice Hub
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {practiceBalance === BigInt(0) && !isCash && isPractice ? (
              <motion.div
                variants={itemVar}
                className="relative overflow-hidden p-6 rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur-md"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                    Practice Balance
                  </h3>
                  <span className="text-xl opacity-50">🔒</span>
                </div>
                <div className="text-2xl md:text-3xl font-bold font-mono tracking-tight text-red-400">
                  LOCKED
                </div>
                <p className="text-xs text-red-400/70 mt-1">
                  Deposit ≥ 10 USDT to reactivate
                </p>
              </motion.div>
            ) : (
              <StatCard
                title="Practice Balance"
                value={`$${formatBal(practiceBalance)}`}
                sub={isCash ? "Active (Cash Player)" : "Account Always Active"}
                icon="🎯"
                highlight
              />
            )}
            <PracticeVerificationCard />
          </div>
        </section>

        {/* SECTION 2: REAL CASH ARENA */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-yellow-500 flex items-center gap-3 italic uppercase tracking-tighter">
            <span className="bg-yellow-500/20 p-2 rounded-xl not-italic">
              💰
            </span>
            Real Cash Arena
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Cash Game Balance"
              value={`$${formatBal(cashGameBalance)}`}
              sub="Available to Play"
              icon="🔥"
              color="text-yellow-400"
              highlight
            />
            <StatCard
              title="Wallet Balance"
              value={`$${formatBal(walletBalance)}`}
              sub="Withdrawable"
              icon="💼"
            />
            <StatCard
              title="Total Deposit"
              value={`$${formatBal(totalDeposit)}`}
              icon="📥"
            />
            <StatCard
              title="Lucky Reward Wallet"
              value={`$${formatBal(luckyDrawWallet)}`}
              sub="For Auto-Tickets"
              icon="🎟️"
              color="text-pink-400"
            />
            <CashVerificationCard
              isCash={isCash}
              deposit={totalDeposit}
              regTime={dataList?.[2]}
            />
            <StatCard
              title="Total Referrals"
              value={totalReferralsDisplay.toString()}
              sub={`${activeDirectsDisplay} Active`}
              icon="👥"
            />
            <BoosterStatusCard
              cashbackEarned={dataList?.cashbackIncome ?? BigInt(0)}
              totalDeposit={dataList?.totalDeposit ?? BigInt(0)}
              activeDirects={activeDirectsDisplay}
              totalUsers={totalUsers}
              systemSettings={systemSettings}
            />
            <CashbackStatusCard
              isNetProfit={isNetProfit}
              totalBets={totalSpent}
              totalWins={totalWins}
              cashbackIncome={dataList?.cashbackIncome ?? BigInt(0)}
              totalDeposit={totalDeposit}
              activeDirects={activeDirectsDisplay}
              totalUsers={totalUsers}
              systemSettings={systemSettings}
              writeContract={writeCashback}
              isPending={isCashbackPending}
            />
            <WinnerBalancesCard digitBalances={digitBalances} />
          </div>

          {!isCash && (
            <div className="space-y-4">
              <motion.div
                variants={itemVar}
                className="w-full flex flex-col items-center justify-center py-4 bg-yellow-500/5 border border-dashed border-yellow-500/30 rounded-2xl p-6"
              >
                <div className="text-center mb-4">
                  <h4 className="text-yellow-500 font-black uppercase text-sm italic tracking-tighter">
                    Bridge to Cash (Conversion Model)
                  </h4>
                  <p className="text-[10px] text-gray-500 max-w-md mt-1 italic">
                    To convert Practice rewards into real-value assets: Direct
                    Referral Income ≥{" "}
                    {allSettings
                      ? formatUnits(
                          (allSettings as any)[8] || parseUnits("100", 18),
                          18,
                        )
                      : "100"}{" "}
                    USDT & Deposit ≥{" "}
                    {allSettings
                      ? formatUnits(
                          (allSettings as any)[8] || parseUnits("100", 18),
                          18,
                        )
                      : "100"}{" "}
                    USDT requirement applies.
                  </p>
                </div>
                <ActivateRealCashButton />
              </motion.div>
            </div>
          )}
        </section>
      </div>

      {/* --- DEPOSIT & WITHDRAW (Moved Up) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DepositSection />
        <WithdrawSection />
      </div>

      {/* --- SECTIONS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
        {/* Left Column: Game & Lucky Draw */}
        <motion.div variants={itemVar} className="lg:col-span-2 space-y-8">
          {/* Lucky Draw Banner */}
          <div className="relative group overflow-hidden rounded-3xl shadow-xl shadow-purple-900/20">
            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 animate-pulse-slow"></div>
            <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
              <LuckyDrawSection />
            </div>
          </div>

          {/* Betting History */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
              <span className="text-blue-500">📊</span> Recent Activity
            </h2>
            <UserBetHistory />
          </div>
        </motion.div>

        {/* Right Column: Transactions & Info */}
        <motion.div variants={itemVar} className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            {/* Transaction History */}
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
              <h4 className="text-gray-400 font-bold text-sm uppercase mb-2">
                My Transactions
              </h4>
              <TransactionHistory registrationTime={registrationTime} />
            </div>

            {/* Info Box */}
            <div className="bg-blue-900/10 border border-blue-500/20 p-6 rounded-3xl backdrop-blur-md">
              <h4 className="text-blue-400 font-bold text-sm uppercase mb-2">
                Need Help?
              </h4>
              <p className="text-xs text-blue-200/70 leading-relaxed">
                If you have issues with deposits or withdrawals, please contact
                support or check the community guides.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// --- REFACTORED SUB-COMPONENTS FOR ANIMATION ---

function StatCard({
  title,
  value,
  sub,
  icon,
  color = "text-white",
  highlight,
}: any) {
  return (
    <motion.div
      variants={itemVar}
      whileHover={{ y: -5, boxShadow: "0px 10px 30px -10px rgba(0,0,0,0.5)" }}
      className={cn(
        "relative overflow-hidden p-6 rounded-2xl border backdrop-blur-md transition-colors",
        highlight
          ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          : "bg-white/5 border-white/10 hover:bg-white/10",
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
          {title}
        </h3>
        <span className="text-xl opacity-50 grayscale">{icon}</span>
      </div>
      <div
        className={cn(
          "text-2xl md:text-3xl font-bold font-mono tracking-tight break-all",
          color,
        )}
      >
        {value}
      </div>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </motion.div>
  );
}

function PracticeVerificationCard() {
  return (
    <motion.div
      variants={itemVar}
      className="p-6 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex flex-col justify-center items-center text-center backdrop-blur-md"
    >
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400/60 mb-1">
        Practice Account
      </span>
      <span className="text-xl font-black text-blue-400 italic tracking-tighter uppercase">
        Verified
      </span>
      <div className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-blue-500/20 rounded-full border border-blue-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
        <span className="text-[8px] font-black text-blue-300 uppercase">
          Live Practice ID
        </span>
      </div>
    </motion.div>
  );
}

function CashVerificationCard({
  isCash,
  deposit,
  regTime,
}: {
  isCash: boolean;
  deposit?: bigint;
  regTime?: bigint;
}) {
  const depAmt = deposit ? Number(formatUnits(deposit, 18)) : 0;
  const isBasic = depAmt >= 10;
  const isPro = depAmt >= 100;

  const status = isPro
    ? "PRO ACTIVATED"
    : isBasic
    ? "BASIC ACTIVATED"
    : isCash
    ? "LOW BALANCE"
    : "UNVERIFIED";
  const color = isPro
    ? "border-yellow-500/50 bg-yellow-500/20 shadow-yellow-500/10"
    : isBasic
    ? "border-blue-500/30 bg-blue-500/10"
    : "border-red-500/20 bg-red-500/5";
  const textColor = isPro
    ? "text-yellow-400 font-black"
    : isBasic
    ? "text-blue-400"
    : "text-red-400";

  const regTimestamp = regTime ? Number(regTime) : 0;
  const daysSinceReg =
    regTimestamp > 0
      ? (Math.floor(Date.now() / 1000) - regTimestamp) / 86400
      : 0;
  const needsAction = !isBasic && daysSinceReg > 20; // 20 days warn

  return (
    <motion.div
      variants={itemVar}
      className={cn(
        "p-6 rounded-2xl border flex flex-col justify-center items-center text-center backdrop-blur-md relative overflow-hidden",
        color,
      )}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">
        Ecosystem Status
      </span>
      <span
        className={cn(
          "text-xl font-black italic tracking-tighter uppercase",
          textColor,
        )}
      >
        {status}
      </span>

      <div className="flex flex-col gap-1 mt-2">
        <span
          className={cn(
            "text-[8px] font-black uppercase",
            isBasic ? "text-green-400" : "text-gray-500",
          )}
        >
          • L1-L3 Income {isBasic ? "✅" : "🔒"}
        </span>
        <span
          className={cn(
            "text-[8px] font-black uppercase",
            isPro ? "text-green-400" : "text-gray-500",
          )}
        >
          • L4-L15 Income {isPro ? "✅" : "🔒"}
        </span>
      </div>

      {needsAction && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[7px] font-black px-2 py-0.5 rounded-bl-lg uppercase animate-pulse">
          {30 - Math.floor(daysSinceReg)} Days Left
        </div>
      )}
    </motion.div>
  );
}

function BoosterStatusCard({
  cashbackEarned,
  totalDeposit,
  activeDirects,
  totalUsers,
}: any) {
  const config = useEcosystemConfig();

  // Use dynamic config if available, otherwise fall back to safe defaults
  const capsBefore = config?.caps.before || [];
  const capsAfter = config?.caps.after || [];
  const threshold = config?.caps.phaseThreshold || 10000;

  const isPostThreshold = Number(totalUsers) >= threshold;
  const activeCaps = isPostThreshold ? capsAfter : capsBefore;

  let multiplier = 1;
  let currentTierDirects = 0;
  let nextTier = null;

  // Sort caps by directs descending to find the highest match
  const filteredCaps = (activeCaps || []).filter((c: any) => c != null);
  const sortedCaps = [...filteredCaps].sort(
    (a, b) => Number(b.directs) - Number(a.directs),
  );

  for (let i = 0; i < sortedCaps.length; i++) {
    const c = sortedCaps[i] as any;
    const d = Number(c.directs ?? c[0] ?? 0);
    const m = Number(c.multiplier ?? c[1] ?? 1);

    if (activeDirects >= d) {
      multiplier = m;
      currentTierDirects = d;
      if (i > 0) nextTier = sortedCaps[i - 1];
      break;
    }
  }

  const currentEarned = Number(formatUnits(cashbackEarned, 18));
  const depAmt = Number(formatUnits(totalDeposit, 18));
  const maxCap = depAmt * multiplier;
  const progress =
    maxCap > 0 ? Math.min((currentEarned / maxCap) * 100, 100) : 0;

  return (
    <motion.div
      variants={itemVar}
      className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 backdrop-blur-md col-span-1 md:col-span-2 shadow-lg overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <span className="text-6xl">🚀</span>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 opacity-80">
            Income Booster Status
          </span>
          <div className="flex items-center gap-2 mt-1">
            <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">
              {multiplier}X LIMIT
            </h3>
            <span className="bg-purple-600 text-[8px] font-black px-2 py-0.5 rounded text-white">
              {multiplier * 100}% ROI CAP
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-gray-500 uppercase block leading-none">
            Phase
          </span>
          <span className="text-xs font-black text-purple-400">
            {isPostThreshold ? "Global Beta 10K+" : "Seed Launch Area"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-purple-600 to-pink-500"
          />
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest block">
              Earned vs Cap
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-white">
                ${currentEarned.toFixed(2)}
              </span>
              <span className="text-[10px] text-gray-600 font-bold uppercase">
                / ${maxCap.toFixed(2)} USDT
              </span>
            </div>
          </div>

          {nextTier ? (
            <div className="text-right bg-black/40 px-3 py-2 rounded-xl border border-white/5">
              <span className="text-[8px] font-black text-purple-400/60 uppercase block mb-0.5">
                Next Boost at {nextTier.directs} Directs
              </span>
              <span className="text-xs font-black text-white italic tracking-tighter">
                Increase to {Number(nextTier.multiplier)}X Limit
              </span>
            </div>
          ) : (
            <div className="text-right">
              <span className="text-[10px] font-black text-gray-500 uppercase">
                Maximum Boost Achieved
              </span>
            </div>
          )}
        </div>

        <p className="text-[8px] text-gray-500 italic opacity-60">
          *Income Cap depends on your active directs (Deposit ≥ 100 USDT).
          Current multiplier: {multiplier}X.
        </p>
      </div>
    </motion.div>
  );
}

function CashbackStatusCard({
  isNetProfit,
  totalBets,
  totalWins,
  cashbackIncome,
  totalDeposit,
  activeDirects,
  totalUsers,
  systemSettings,
  writeContract,
  isPending,
}: {
  isNetProfit: boolean;
  totalBets?: bigint;
  totalWins?: bigint;
  cashbackIncome?: bigint;
  totalDeposit?: bigint;
  activeDirects?: number;
  totalUsers?: bigint;
  systemSettings?: any;
  writeContract?: any;
  isPending?: boolean;
}) {
  const config = useEcosystemConfig();

  // Get cashback settings from systemSettings
  let lossThreshold = BigInt(100) * BigInt(10 ** 18);
  let maxDailyCashback = BigInt(10) * BigInt(10 ** 18);
  let cashbackRateBps = 50; // 0.5% default

  if (systemSettings && Array.isArray(systemSettings)) {
    const cashbackParams = systemSettings[2] as any[];
    if (cashbackParams?.[2]) lossThreshold = BigInt(cashbackParams[2]);
    if (cashbackParams?.[5]) maxDailyCashback = BigInt(cashbackParams[5]);
  }

  // Get booster multiplier from caps
  const capsBefore = config?.caps.before || [];
  const capsAfter = config?.caps.after || [];
  const threshold = config?.caps.phaseThreshold || 10000;
  const isPostThreshold = Number(totalUsers ?? 0) >= threshold;
  const activeCaps = isPostThreshold ? capsAfter : capsBefore;
  let multiplier = 1;
  const sortedCaps = [...(activeCaps || [])]
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        Number(b.directs ?? b[0] ?? 0) - Number(a.directs ?? a[0] ?? 0),
    );
  for (const c of sortedCaps as any[]) {
    const d = Number(c.directs ?? c[0] ?? 0);
    const m = Number(c.multiplier ?? c[1] ?? 1);
    if ((activeDirects ?? 0) >= d) {
      multiplier = m;
      break;
    }
  }

  const bets = totalBets ?? BigInt(0);
  const wins = totalWins ?? BigInt(0);
  const netLoss = bets > wins ? bets - wins : BigInt(0);
  const cashback = cashbackIncome ?? BigInt(0);
  const deposit = totalDeposit ?? BigInt(0);

  const lossUSDT = Number(formatUnits(netLoss, 18));
  const thresholdUSDT = Number(formatUnits(lossThreshold, 18));
  const cashbackUSDT = Number(formatUnits(cashback, 18));
  const depositUSDT = Number(formatUnits(deposit, 18));
  const maxCapUSDT = depositUSDT * multiplier;
  const maxDailyUSDT = Number(formatUnits(maxDailyCashback, 18));

  // Daily estimate: deposit * 0.5% capped at maxDaily
  const dailyEstimate = Math.min(depositUSDT * 0.005, maxDailyUSDT);

  const progress = Math.min((lossUSDT / thresholdUSDT) * 100, 100);
  const isEligible = netLoss >= lossThreshold;
  const capReached = cashbackUSDT >= maxCapUSDT && maxCapUSDT > 0;

  const handleClaim = () => {
    if (!writeContract) return;
    writeContract({
      address: TRK_GAME_ADDRESS as `0x${string}`,
      abi: TRKRouterABI.abi,
      functionName: "claimDailyCashback",
    });
  };

  return (
    <motion.div
      variants={itemVar}
      className="p-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-md col-span-1 md:col-span-2"
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Daily Cashback Meter
        </span>
        <span
          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
            capReached
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : isEligible
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
          }`}
        >
          {capReached
            ? "⛔ Cap Reached"
            : isEligible
            ? "● Eligible"
            : "○ Not Yet"}
        </span>
      </div>

      {/* Loss Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-mono">
          <span>Net Loss: ${lossUSDT.toFixed(2)}</span>
          <span>Threshold: ${thresholdUSDT.toFixed(0)}</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full ${
              isEligible ? "bg-green-500" : "bg-blue-500"
            }`}
          />
        </div>
        <div className="text-[9px] text-gray-600 mt-1 font-mono">
          {progress.toFixed(1)}% of threshold reached
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-black/30 rounded-xl p-3 text-center">
          <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">
            Daily Estimate
          </div>
          <div className="text-sm font-black text-blue-400">
            ${dailyEstimate.toFixed(2)}
          </div>
          <div className="text-[7px] text-gray-600">USDT/day</div>
        </div>
        <div className="bg-black/30 rounded-xl p-3 text-center">
          <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">
            Booster
          </div>
          <div className="text-sm font-black text-purple-400">
            {multiplier}X
          </div>
          <div className="text-[7px] text-gray-600">
            {multiplier * 100}% cap
          </div>
        </div>
        <div className="bg-black/30 rounded-xl p-3 text-center">
          <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">
            Total Received
          </div>
          <div className="text-sm font-black text-green-400">
            ${cashbackUSDT.toFixed(2)}
          </div>
          <div className="text-[7px] text-gray-600">
            / ${maxCapUSDT.toFixed(0)} cap
          </div>
        </div>
      </div>

      {/* Claim Button */}
      {isEligible && !capReached && writeContract && (
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="w-full py-3 rounded-xl font-black text-sm uppercase tracking-widest bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/30"
        >
          {isPending ? "CLAIMING..." : "💰 CLAIM DAILY CASHBACK"}
        </button>
      )}
      {!isEligible && (
        <div className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
          Lose ${(thresholdUSDT - lossUSDT).toFixed(2)} more to unlock cashback
        </div>
      )}
    </motion.div>
  );
}

function ReferralCodeCard({
  code,
  isHero,
}: {
  code: string;
  isHero?: boolean;
}) {
  const copyToClipboard = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    alert("Referral code copied to clipboard!");
  };

  return (
    <motion.div
      variants={itemVar}
      className={cn(
        "relative rounded-2xl bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 flex flex-col justify-center items-center text-center group cursor-pointer overflow-hidden transition-all",
        isHero
          ? "p-4 py-6 md:py-8 border-dashed shadow-2xl shadow-purple-500/10"
          : "p-6",
      )}
      onClick={copyToClipboard}
    >
      <div className="absolute inset-0 bg-purple-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
      <div className="relative z-10 flex flex-col items-center">
        <h3 className="text-purple-300 text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">
          {isHero ? "⚡ Your Network Gateway" : "Your Referral Code"}
        </h3>
        <div
          className={cn(
            "font-mono font-black text-white transition-all tracking-tighter",
            isHero ? "text-4xl md:text-5xl lg:text-6xl" : "text-2xl",
          )}
        >
          {code || "..."}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest group-hover:text-purple-400 transition-colors">
            Click to Copy
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></div>
        </div>
      </div>
    </motion.div>
  );
}

function AlertBanner({ type, title, desc, action }: any) {
  const colors =
    type === "error"
      ? "bg-red-500/10 border-red-500/50 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
      : "bg-blue-500/10 border-blue-500/50 text-blue-200";

  return (
    <motion.div
      initial={{ height: 0, opacity: 0, scale: 0.95 }}
      animate={{ height: "auto", opacity: 1, scale: 1 }}
      exit={{ height: 0, opacity: 0, scale: 0.95 }}
      className={cn(
        "border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md",
        colors,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl animate-bounce">
          {type === "error" ? "⚠️" : "ℹ️"}
        </span>
        <div>
          <h4
            className={cn(
              "font-bold text-sm",
              type === "error" ? "text-red-400" : "text-blue-400",
            )}
          >
            {title}
          </h4>
          <p className="text-xs opacity-80">{desc}</p>
        </div>
      </div>
      {action && (
        <a
          href={action.url}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap hover:scale-105 active:scale-95 shadow-lg",
            type === "error"
              ? "bg-red-600 hover:bg-red-500 text-white shadow-red-500/20"
              : "bg-blue-600 hover:bg-blue-500 text-white",
          )}
        >
          {action.label}
        </a>
      )}
    </motion.div>
  );
}

function PracticeModeBanner({ balance }: { balance: string }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mt-4 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/50 rounded-xl p-4 flex items-center justify-between relative overflow-hidden backdrop-blur-md"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
      <div className="flex items-center gap-4 relative z-10">
        <div className="p-2 bg-blue-500/20 rounded-lg">🎮</div>
        <div>
          <h4 className="text-blue-400 font-bold text-sm">
            Practice Mode Active
          </h4>
          <p className="text-xs text-blue-200/80">
            Balance:{" "}
            <span className="font-mono text-white">{balance} USDT</span>
          </p>
        </div>
      </div>
      <div className="px-3 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-lg shadow-blue-500/20">
        Demo
      </div>
    </motion.div>
  );
}

function CountdownTimer({ registrationTime }: { registrationTime: bigint }) {
  const [timeLeft, setTimeLeft] = useState<{
    d: number;
    h: number;
    m: number;
    s: number;
  } | null>(null);

  useEffect(() => {
    if (!registrationTime) return;
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const end = Number(registrationTime) + 30 * 24 * 60 * 60;
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        clearInterval(interval);
      } else {
        setTimeLeft({
          d: Math.floor(diff / (24 * 60 * 60)),
          h: Math.floor((diff % (24 * 60 * 60)) / 3600),
          m: Math.floor((diff % 3600) / 60),
          s: diff % 60,
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [registrationTime]);

  if (!timeLeft) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-r from-red-900/60 to-black/60 border-2 border-red-500/50 rounded-2xl p-6 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <p className="text-red-400 text-xs font-black uppercase mb-1 tracking-[0.2em] animate-pulse">
            ⚠️ CRITICAL: 30-Day Activation Rule
          </p>
          <p className="text-[10px] text-gray-400 max-w-xs">
            Upgrade to Real Cash within 30 days or your{" "}
            <span className="text-white font-bold">
              ID and Practice Balance will be permanently deleted
            </span>{" "}
            from the blockchain.
          </p>
        </div>
        <div className="flex justify-center gap-2 md:gap-4 font-mono text-white">
          <TimeBox val={timeLeft.d} label="D" />
          <span className="text-red-500 mt-1">:</span>
          <TimeBox val={timeLeft.h} label="H" />
          <span className="text-red-500 mt-1">:</span>
          <TimeBox val={timeLeft.m} label="M" />
          <span className="text-red-500 mt-1">:</span>
          <TimeBox val={timeLeft.s} label="S" />
        </div>
      </div>
    </motion.div>
  );
}

const TimeBox = ({ val, label }: { val: number; label: string }) => (
  <div className="flex flex-col items-center">
    <span className="text-xl md:text-2xl font-bold bg-black/40 rounded-lg px-3 py-2 min-w-[45px] text-center border border-white/5">
      {val.toString().padStart(2, "0")}
    </span>
    <span className="text-[10px] text-orange-500/70 mt-1 font-bold">
      {label}
    </span>
  </div>
);

// --- RESTORED LOGIC COMPONENTS (Optimized for UI) ---

function ActivateRealCashButton() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [step, setStep] = useState<"check" | "approve" | "activate">("check");

  const { data: usdtBalance } = useReadContract({
    address: TRK_ADDRESSES.USDT,
    abi: USDTABI.abi,
    functionName: "balanceOf",
    args: [address],
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TRK_ADDRESSES.USDT,
    abi: USDTABI.abi,
    functionName: "allowance",
    args: [address, TRK_ADDRESSES.TREASURY],
  });

  const { data: systemSettings } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getSystemSettings",
  });

  const minActivationRaw = systemSettings
    ? (systemSettings as any)[0]?.[0]
    : null;
  const requiredUsdt = minActivationRaw
    ? BigInt(minActivationRaw)
    : parseUnits("10", 18);
  const displayUsdtAmount = Number(formatUnits(requiredUsdt, 18)).toString();

  const userUsdtBalance = usdtBalance
    ? BigInt(usdtBalance as bigint)
    : BigInt(0);
  const currentAllowance = allowance ? BigInt(allowance as bigint) : BigInt(0);
  const hasEnoughUsdt = userUsdtBalance >= requiredUsdt;
  const needsApproval = currentAllowance < requiredUsdt;

  // Approve
  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApproveSigning,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({
      hash: approveHash,
    });

  // Activate
  const {
    writeContract: writeActivate,
    data: activateHash,
    isPending: isActivateSigning,
    error: activateError,
  } = useWriteContract();

  const { isLoading: isActivateConfirming, isSuccess: isActivateConfirmed } =
    useWaitForTransactionReceipt({
      hash: activateHash,
    });

  useEffect(() => {
    if (isApproveConfirmed) {
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (!isActivateConfirmed || !activateHash || !address) return;

    const syncActivationDeposit = async () => {
      const now = Math.floor(Date.now() / 1000);
      try {
        // 1. Sync the deposit itself
        await fetch(API_ENDPOINTS.SYNC_DEPOSIT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address,
            hash: activateHash,
            amount: requiredUsdt.toString(),
            creditedToCash: requiredUsdt.toString(),
            timestamp: now,
          }),
        });

        // 2. Parse IncomeReceived events from receipt → sync distributions
        if (publicClient) {
          const receipt = await publicClient.getTransactionReceipt({
            hash: activateHash,
          });
          const incomeEvent = parseAbiItem(
            "event IncomeReceived(address indexed user, uint256 amount, string source, string walletType, uint256 timestamp)",
          );
          receipt.logs.forEach((log: any) => {
            try {
              const decoded = decodeEventLog({
                abi: [incomeEvent],
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "IncomeReceived") {
                fetch(API_ENDPOINTS.SYNC_INCOME, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    address: (decoded.args as any).user,
                    hash: activateHash,
                    amount: (decoded.args as any).amount.toString(),
                    source: (decoded.args as any).source,
                    walletType: (decoded.args as any).walletType,
                    timestamp: Number((decoded.args as any).timestamp) || now,
                  }),
                });
              }
            } catch (e) {
              /* skip non-matching logs */
            }
          });
        }
      } catch (err) {
        console.error("Failed to sync activation deposit:", err);
      } finally {
        alert("Real Cash Game Activated!");
        window.location.reload();
      }
    };

    syncActivationDeposit();
  }, [isActivateConfirmed, activateHash, address, requiredUsdt, publicClient]);

  const handleApprove = () => {
    writeApprove({
      address: TRK_ADDRESSES.USDT,
      abi: USDTABI.abi,
      functionName: "approve",
      args: [TRK_ADDRESSES.TREASURY, requiredUsdt],
    });
  };

  const handleActivate = () => {
    writeActivate({
      address: TRK_ADDRESSES.ROUTER,
      abi: TRKRouterABI.abi,
      functionName: "depositCashGame",
      args: [requiredUsdt],
    });
  };

  const isProcessing =
    isApproveSigning ||
    isApproveConfirming ||
    isActivateSigning ||
    isActivateConfirming;

  return (
    <div className="w-full bg-yellow-500/5 border border-yellow-500/20 p-6 rounded-2xl space-y-4 backdrop-blur-sm">
      {!hasEnoughUsdt && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-center font-mono">
          <p className="text-red-400 font-bold text-xs">
            ⚠️ Need {displayUsdtAmount} USDT to Activate
          </p>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-yellow-400 font-bold text-sm uppercase">
            Upgrade Account
          </h4>
          <p className="text-xs text-gray-400">
            Upgrade to Real Cash ({displayUsdtAmount} USDT)
          </p>
        </div>

        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!hasEnoughUsdt || isProcessing}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl disabled:opacity-50 transition-all text-sm"
          >
            {isApproveSigning
              ? "⏳ Signing..."
              : isApproveConfirming
              ? "⏳ Approving..."
              : "1. Approve USDT"}
          </button>
        ) : (
          <button
            onClick={handleActivate}
            disabled={!hasEnoughUsdt || isProcessing}
            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl disabled:opacity-50 transition-all text-sm"
          >
            {isActivateSigning
              ? "⏳ Signing..."
              : isActivateConfirming
              ? "⏳ Activating..."
              : "2. Activate Now"}
          </button>
        )}
      </div>

      {activateError && (
        <p className="text-[10px] text-red-500 font-mono italic mt-2">
          Error: {activateError.message.slice(0, 100)}
        </p>
      )}
    </div>
  );
}

function DepositSection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [step, setStep] = useState<"check" | "approve" | "deposit">("check");
  const [error, setError] = useState("");

  const { data: usdtBalance } = useReadContract({
    address: TRK_ADDRESSES.USDT,
    abi: USDTABI.abi,
    functionName: "balanceOf",
    args: [address],
    query: { refetchInterval: 30000 },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TRK_ADDRESSES.USDT,
    abi: USDTABI.abi,
    functionName: "allowance",
    args: [address, TRK_ADDRESSES.TREASURY],
    query: { refetchInterval: 30000 },
  });

  // FIXED: Use getUserInfo via Router instead of calling 'users' on it
  const { data: userData } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getUserInfo",
    args: [address],
    query: { refetchInterval: 30000 },
  });

  // Helper to parse the Struct correctly
  const dataList = userData ? (userData as any) : null;
  const isRegistered =
    dataList?.isRegistered ?? ((dataList as any[])?.[28] || false);
  const isCashPlayer =
    dataList?.isCashPlayer ?? ((dataList as any[])?.[30] || false);

  // isActive usually means isCashPlayer (Updated terminology)
  const isActive = isCashPlayer;
  const canDeposit = isRegistered;

  const { data: systemSettings } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getSystemSettings",
  });

  const {
    writeContract: writeApprove,
    data: approveHash,
    isPending: isApproveSigning,
  } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });
  const {
    writeContract: writeDeposit,
    data: depositHash,
    isPending: isDepositSigning,
  } = useWriteContract();
  const { isLoading: isDepositConfirming, isSuccess: isDepositConfirmed } =
    useWaitForTransactionReceipt({ hash: depositHash });

  useEffect(() => {
    if (isApproveConfirmed) {
      setStep("deposit");
      refetchAllowance();
    }
  }, [isApproveConfirmed, refetchAllowance]);
  useEffect(() => {
    if (isDepositConfirmed && depositHash && address) {
      // Sync to backend
      const syncDeposit = async () => {
        try {
          // Sync Deposit
          await fetch(API_ENDPOINTS.SYNC_DEPOSIT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              hash: depositHash,
              amount: parseUnits(depositAmount, 18).toString(),
              creditedToCash: parseUnits(depositAmount, 18).toString(),
              timestamp: Math.floor(Date.now() / 1000),
            }),
          });

          // Parse all events from receipt
          if (!publicClient) return;
          const receipt = await publicClient.getTransactionReceipt({
            hash: depositHash,
          });
          const now = Math.floor(Date.now() / 1000);
          const conversionEvent = parseAbiItem(
            "event PracticeConverted(address indexed user, uint256 amount, uint256 timestamp)",
          );
          const incomeEvent = parseAbiItem(
            "event IncomeReceived(address indexed user, uint256 amount, string source, string walletType, uint256 timestamp)",
          );

          receipt.logs.forEach((log: any) => {
            try {
              const decoded = decodeEventLog({
                abi: [conversionEvent],
                data: log.data,
                topics: log.topics,
              });
              if (
                decoded.eventName === "PracticeConverted" &&
                (decoded.args as any).user.toLowerCase() ===
                  address.toLowerCase()
              ) {
                fetch(API_ENDPOINTS.SYNC_CONVERT, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    address,
                    hash: depositHash,
                    amount: (decoded.args as any).amount.toString(),
                    timestamp: Number((decoded.args as any).timestamp),
                  }),
                });
              }
            } catch (e) {
              /* skip */
            }

            try {
              const decoded = decodeEventLog({
                abi: [incomeEvent],
                data: log.data,
                topics: log.topics,
              });
              if (decoded.eventName === "IncomeReceived") {
                fetch(API_ENDPOINTS.SYNC_INCOME, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    address: (decoded.args as any).user,
                    hash: depositHash,
                    amount: (decoded.args as any).amount.toString(),
                    source: (decoded.args as any).source,
                    walletType: (decoded.args as any).walletType,
                    timestamp: Number((decoded.args as any).timestamp) || now,
                  }),
                });
              }
            } catch (e) {
              /* skip */
            }
          });

          alert("Deposit Successful!");
          setDepositAmount("");
          setStep("check");
          window.location.reload();
        } catch (err) {
          console.error("Failed to sync deposit:", err);
        }
      };
      syncDeposit();
    }
  }, [isDepositConfirmed, depositHash, address, depositAmount]);

  const handleDeposit = () => {
    setError("");
    if (!isRegistered) return setError("🚫 Register first!");
    // If already active, they can still deposit more. If not active, this deposit activates them.

    const amount = parseFloat(depositAmount);

    const minDepValue = systemSettings ? (systemSettings as any)[0]?.[0] : null;
    const minLimit = minDepValue ? Number(formatUnits(minDepValue, 18)) : 10;

    if (!amount || amount < minLimit)
      return setError(`❌ Min ${minLimit} USDT`);

    const amountWei = parseUnits(depositAmount, 18);
    const userBal = usdtBalance ? BigInt(usdtBalance as bigint) : BigInt(0);

    if (userBal < amountWei) return setError("❌ Insufficient USDT");

    const currentAllow = allowance ? BigInt(allowance as bigint) : BigInt(0);
    // Approve Spender: TREASURY
    const spender = TRK_ADDRESSES.TREASURY;

    if (currentAllow < amountWei) {
      setStep("approve");
      writeApprove({
        address: TRK_ADDRESSES.USDT,
        abi: USDTABI.abi,
        functionName: "approve",
        args: [spender, amountWei],
      });
    } else {
      setStep("deposit");
      writeDeposit({
        address: TRK_ADDRESSES.ROUTER,
        abi: TRKRouterABI.abi,
        functionName: "depositCashGame",
        args: [amountWei],
      });
    }
  };

  const userBalanceFormatted = usdtBalance
    ? formatUnits(usdtBalance as bigint, 18)
    : "0";

  return (
    <div className="bg-gradient-to-b from-blue-900/20 to-purple-900/20 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="bg-blue-500/20 p-2 rounded-lg">💰</span>
        Deposit USDT
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Amount</span>
          <span>Bal: {Number(userBalanceFormatted).toFixed(2)} USDT</span>
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="1"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
            disabled={!canDeposit}
          />
          <span className="absolute right-4 top-3 text-sm text-gray-500 font-bold">
            USDT
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="p-2 bg-blue-500/5 border border-blue-500/20 rounded-lg text-center">
            <p className="text-[9px] font-black text-blue-400 uppercase">
              Basic (10$)
            </p>
            <p className="text-[7px] text-gray-500 uppercase mt-0.5">
              Unlock 3 Levels
            </p>
          </div>
          <div className="p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-center">
            <p className="text-[9px] font-black text-yellow-500 uppercase">
              Pro (100$)
            </p>
            <p className="text-[7px] text-gray-500 uppercase mt-0.5">
              Unlock All 15
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={handleDeposit}
        disabled={
          !depositAmount ||
          !canDeposit ||
          isApproveSigning ||
          isApproveConfirming ||
          isDepositSigning ||
          isDepositConfirming
        }
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30 active:scale-95"
      >
        {!isRegistered
          ? "Register First"
          : !isActive
          ? "Activate Account"
          : isApproveSigning
          ? "Approving..."
          : isApproveConfirming
          ? "Confirming..."
          : isDepositSigning
          ? "Depositing..."
          : isDepositConfirming
          ? "Confirming..."
          : "Deposit Now"}
      </button>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">
          Secured by BSC Smart Contract
        </p>
      </div>
    </div>
  );
}

function WithdrawSection() {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");

  // Fetch registered user info to check wallet balance
  const { data: userData } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getUserInfo",
    args: [address],
    query: { refetchInterval: 30000 }, // Refresh every 30s
  });

  const dataList = userData ? (userData as any) : null;
  const walletBalance = dataList?.walletBalance ?? dataList?.[3];

  const formattedBalance = walletBalance ? formatUnits(walletBalance, 18) : "0";

  const {
    data: withdrawHash,
    writeContract: writeWithdraw,
    isPending: isWithdrawPending,
  } = useWriteContract();
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawConfirmed } =
    useWaitForTransactionReceipt({ hash: withdrawHash });

  useEffect(() => {
    if (isWithdrawConfirmed && withdrawHash && address) {
      const syncWithdraw = async () => {
        try {
          await fetch(API_ENDPOINTS.SYNC_WITHDRAW, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              hash: withdrawHash,
              totalRequested: parseUnits(amount, 18).toString(),
              fee: (parseUnits(amount, 18) / BigInt(10)).toString(), // 10% fee
              amountSent: (
                (parseUnits(amount, 18) * BigInt(9)) /
                BigInt(10)
              ).toString(),
              timestamp: Math.floor(Date.now() / 1000),
            }),
          });
          alert("Withdrawal Successful!");
          setAmount("");
          window.location.reload();
        } catch (err) {
          console.error("Failed to sync withdrawal:", err);
        }
      };
      syncWithdraw();
    }
  }, [isWithdrawConfirmed, withdrawHash, address, amount]);

  const handleWithdraw = () => {
    setError("");
    const val = parseFloat(amount);
    if (!val || val < 5) return setError("Min Withdrawal: 5 USDT");
    if (val > parseFloat(formattedBalance))
      return setError("Insufficient Wallet Balance");

    writeWithdraw({
      address: TRK_ADDRESSES.ROUTER,
      abi: TRKRouterABI.abi,
      functionName: "withdraw",
      args: [parseUnits(amount, 18)],
    });
  };

  return (
    <div className="bg-gradient-to-b from-gray-900/40 to-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl mt-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="bg-gray-700/50 p-2 rounded-lg">💸</span>
        Withdraw
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs font-bold">
          {error}
        </div>
      )}

      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Amount (Fee: 10%)</span>
          <span
            className="cursor-pointer hover:text-white"
            onClick={() => setAmount(formattedBalance)}
          >
            Max: {Number(formattedBalance).toFixed(2)}
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="5.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-mono"
          />
          <span className="absolute right-4 top-3 text-sm text-gray-500 font-bold">
            USDT
          </span>
        </div>
        {amount && !error && (
          <p className="text-[10px] text-green-400 font-bold mt-1">
            You will receive ≈ {(parseFloat(amount) * 0.9).toFixed(2)} USDT
          </p>
        )}
      </div>

      <button
        onClick={handleWithdraw}
        disabled={!amount || isWithdrawPending || isWithdrawConfirming}
        className="w-full py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl disabled:opacity-50 transition-all shadow-lg active:scale-95"
      >
        {isWithdrawPending
          ? "Signing..."
          : isWithdrawConfirming
          ? "Processing..."
          : "Withdraw"}
      </button>
    </div>
  );
}

function TransactionHistory({
  registrationTime,
}: {
  registrationTime?: bigint;
}) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPractice, setShowPractice] = useState(false);

  useEffect(() => {
    if (!address || !publicClient) return;

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(API_ENDPOINTS.GET_HISTORY(address));
        const data = await res.json();

        if (data.success) {
          const allCashLogs = [
            ...data.deposits.map((l: any) => ({
              ...l,
              type: "Deposit",
              amount: BigInt(l.amount),
              credited: BigInt(l.creditedToCash),
            })),
            ...data.withdrawals.map((l: any) => ({
              ...l,
              type: "Withdraw",
              amount: BigInt(l.totalRequested),
              fee: BigInt(l.fee),
              sent: BigInt(l.amountSent),
            })),
            ...(data.conversions || []).map((l: any) => ({
              ...l,
              type: "Conversion",
              amount: BigInt(l.amount),
            })),
            ...(data.incomes || [])
              .filter((l: any) => l.walletType === "Cash")
              .map((l: any) => ({
                ...l,
                type: "Income: " + l.source,
                amount: BigInt(l.amount),
              })),
          ].sort((a, b) => b.timestamp - a.timestamp);

          const allPracticeLogs = [
            ...data.luckyTickets.map((l: any) => ({
              ...l,
              type: "Lucky Ticket",
              amount: BigInt(l.count),
              draw: l.drawType === 1 ? "Golden" : "Silver",
            })),
            ...(data.rewards || []).map((l: any) => ({
              ...l,
              type: "Practice Reward",
              amount: BigInt(l.amount),
            })),
            ...(data.incomes || [])
              .filter((l: any) => l.walletType === "Practice")
              .map((l: any) => ({
                ...l,
                type: "Practice: " + l.source,
                amount: BigInt(l.amount),
              })),
          ];

          // Fallback: show signup bonus in practice history even if backend watcher missed registration sync.
          const regTs = Number(registrationTime ?? BigInt(0));
          const hasSignupLog = allPracticeLogs.some((l: any) =>
            String(l.type || "")
              .toLowerCase()
              .includes("signup"),
          );
          if (regTs > 0 && !hasSignupLog) {
            allPracticeLogs.push({
              hash: null,
              type: "Signup Bonus",
              amount: parseUnits("100", 18),
              timestamp: regTs,
            });
          }

          allPracticeLogs.sort((a, b) => b.timestamp - a.timestamp);

          setLogs(allCashLogs);
          setPracticeLogs(allPracticeLogs);
        }
      } catch (e) {
        console.error("Error fetching history from backend:", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [address, publicClient, registrationTime]);

  const activeLogs = showPractice ? practiceLogs : logs;

  if (isLoading)
    return (
      <div className="text-center text-gray-500 text-xs py-4">
        Loading history...
      </div>
    );

  return (
    <div className="mt-4">
      <div className="flex bg-black/40 p-1 rounded-xl mb-4 border border-white/5">
        <button
          onClick={() => setShowPractice(false)}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
            !showPractice
              ? "bg-white/10 text-white"
              : "text-gray-500 hover:text-gray-300",
          )}
        >
          CASH
        </button>
        <button
          onClick={() => setShowPractice(true)}
          className={cn(
            "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
            showPractice
              ? "bg-blue-500/20 text-blue-400"
              : "text-gray-500 hover:text-gray-300",
          )}
        >
          PRACTICE
        </button>
      </div>

      {activeLogs.length === 0 ? (
        <div className="text-center text-gray-500 text-xs py-8 bg-white/5 rounded-2xl border border-dashed border-white/10">
          No history for this balance
        </div>
      ) : (
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
          {activeLogs.map((log: any, i) => (
            <div
              key={(log.hash || "tx") + i}
              className="group flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5 text-xs hover:bg-white/[0.08] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-xl text-lg",
                    log.type === "Deposit"
                      ? "bg-green-500/10 text-green-400"
                      : log.type === "Withdraw"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-blue-500/10 text-blue-400",
                  )}
                >
                  {log.type === "Deposit"
                    ? "📥"
                    : log.type === "Withdraw"
                    ? "📤"
                    : "🎁"}
                </span>
                <div>
                  <p className="font-black text-white uppercase tracking-tight flex items-center gap-2">
                    {log.type}
                    {log.hash && (
                      <a
                        href={`https://bscscan.com/tx/${log.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[8px] text-gray-500 hover:text-blue-400 font-mono lower"
                      >
                        ({log.hash.slice(0, 6)}...)
                      </a>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {log.timestamp
                      ? new Date(
                          Number(log.timestamp) * 1000,
                        ).toLocaleDateString()
                      : "Recent"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono font-black text-white">
                  {formatUnits(log.amount || BigInt(0), 18)}
                </p>
                {log.type === "Withdraw" && (
                  <p className="text-[8px] text-red-500 font-bold">
                    Net: {formatUnits(log.sent || BigInt(0), 18)} (Fee:{" "}
                    {formatUnits(log.fee || BigInt(0), 18)})
                  </p>
                )}
                {log.type === "Deposit" && (
                  <p className="text-[8px] text-green-500 font-bold">
                    To Game: {formatUnits(log.credited || BigInt(0), 18)}
                  </p>
                )}
                <p className="text-[9px] text-gray-600 font-bold uppercase">
                  {log.type === "Lucky Ticket" ? "Tickets" : "USDT"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- STATE COMPONENTS ---

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-yellow-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-500 text-xs font-mono uppercase tracking-[0.2em] animate-pulse">
        Initializing Ecosystem...
      </p>
    </div>
  );
}

function EmptyState({ icon, title, desc }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8"
    >
      <div className="text-7xl mb-6 grayscale opacity-30">{icon}</div>
      <h2 className="text-3xl font-bold text-white mb-3">{title}</h2>
      <p className="text-gray-400 max-w-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function NetworkErrorState({ chainName, chainId }: any) {
  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[60vh] p-4"
    >
      <div className="bg-red-900/20 border border-red-500/50 rounded-3xl p-10 max-w-md text-center backdrop-blur-xl shadow-2xl shadow-red-900/20">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-3xl font-bold text-red-500 mb-2">Wrong Network</h2>
        <p className="text-gray-300 mb-8 leading-relaxed">
          Connected to{" "}
          <span className="font-bold text-white">
            {chainName} ({chainId})
          </span>
          .
          <br />
          Please switch to{" "}
          <span className="font-bold text-yellow-400">BSC Mainnet (56)</span>.
        </p>
        <div className="bg-black/40 p-4 rounded-xl text-left text-xs font-mono text-gray-400 space-y-2 border border-white/5">
          <p>Network: BNB Smart Chain</p>
          <p>Chain ID: 56</p>
          <p>RPC: bsc-dataseed.binance.org</p>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto mt-8 px-4 space-y-8 animate-pulse">
      <div className="h-32 bg-gray-800/30 rounded-2xl w-full border border-gray-800"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-40 bg-gray-800/30 rounded-2xl border border-gray-800"
          ></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 bg-gray-800/30 rounded-2xl border border-gray-800"></div>
        <div className="lg:col-span-1 h-96 bg-gray-800/30 rounded-2xl border border-gray-800"></div>
      </div>
    </div>
  );
}
