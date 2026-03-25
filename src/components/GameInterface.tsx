"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { TRK_GAME_ADDRESS, TRK_ADDRESSES } from "../config";
import TRKRouterABI from "@/abis/TRKRouter.json";
import TRKGameEngineABI from "@/abis/TRKGameEngine.json";
import { API_ENDPOINTS } from "../config/backend";
import { useEcosystemConfig } from "./EcosystemConfig";

const LUCKY_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const PRESETS = ["1", "5", "10", "50"];

export default function GameInterface() {
  const { address, isConnected, chain } = useAccount();
  const config = useEcosystemConfig();
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("1");
  const [timeLeft, setTimeLeft] = useState("00:00");
  const [showSuccess, setShowSuccess] = useState(false);

  const isWrongNetwork =
    isConnected && chain?.id !== 56 && chain?.id !== 97 && chain?.id !== 31337;

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diff = nextHour.getTime() - now.getTime();
      const m = Math.floor(diff / 60000)
        .toString()
        .padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000)
        .toString()
        .padStart(2, "0");
      setTimeLeft(`${m}:${s}`);
    };
    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, []);

  // User Info comes from Router (which proxies Registry)
  const {
    data: userData,
    refetch: refetchUser,
    isLoading: isUserLoading,
  } = useReadContract({
    address: TRK_GAME_ADDRESS as `0x${string}`,
    abi: TRKRouterABI.abi,
    functionName: "getUserInfo",
    args: [address],
    query: { enabled: !!address && !isWrongNetwork, refetchInterval: 5000 },
  });

  const userDataArray = userData ? (userData as any) : null;

  // Handle both Array (Tuple) and Object (Struct) return formats from Viem
  const isRegistered =
    userDataArray?.isRegistered ?? userDataArray?.[28] ?? false;
  const isCashPlayer =
    userDataArray?.isCashPlayer ?? userDataArray?.[30] ?? false;

  const [selectedGameType, setSelectedGameType] = useState<"CASH" | "PRACTICE">(
    "PRACTICE",
  );

  useEffect(() => {
    if (isCashPlayer) {
      setSelectedGameType("CASH");
    } else {
      setSelectedGameType("PRACTICE");
    }
  }, [isCashPlayer]);

  const isPracticeMode = selectedGameType === "PRACTICE";

  const { data: currentRoundIdForSync } = useReadContract({
    address: TRK_ADDRESSES.GAME as `0x${string}`,
    abi: TRKGameEngineABI.abi,
    functionName: isPracticeMode
      ? "currentPracticeRoundId"
      : "currentCashRoundId",
    query: { enabled: !!address && !isWrongNetwork },
  });

  const practiceBal =
    userDataArray?.practiceBalance ?? userDataArray?.[4] ?? BigInt(0);
  const cashBal =
    userDataArray?.cashGameBalance ?? userDataArray?.[5] ?? BigInt(0);
  const digitBalances =
    userDataArray?.digitBalances ??
    userDataArray?.[20] ??
    Array(10).fill(BigInt(0));

  const availableBalance = isPracticeMode
    ? practiceBal
    : selectedNumber !== null
    ? cashBal + digitBalances[selectedNumber]
    : cashBal;

  // Net Profit Calculation: Total Wins vs Total Bets (per contract qualification)
  const totalSpent =
    userDataArray?.totalBets ??
    (Array.isArray(userDataArray) ? userDataArray[22] : BigInt(0));
  const totalWins =
    userDataArray?.totalWins ??
    (Array.isArray(userDataArray) ? userDataArray[23] : BigInt(0));
  const isNetProfit = BigInt(totalWins || 0) >= BigInt(totalSpent || 0);

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (isSuccess && hash && address) {
      setShowSuccess(true);

      const syncBet = async () => {
        try {
          await fetch(API_ENDPOINTS.SYNC_BET, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              hash,
              amount: parseUnits(betAmount, 18).toString(),
              prediction: selectedNumber,
              isCash: !isPracticeMode,
              roundId: Number(currentRoundIdForSync || 0),
              timestamp: Math.floor(Date.now() / 1000),
            }),
          });
        } catch (err) {
          console.error("Failed to sync bet:", err);
        }
      };
      syncBet();

      refetchUser();
      setTimeout(() => setShowSuccess(false), 4000);
    }
  }, [
    isSuccess,
    hash,
    address,
    betAmount,
    selectedNumber,
    isPracticeMode,
    currentRoundIdForSync,
    refetchUser,
  ]);

  if (!isConnected)
    return (
      <div className="p-20 text-center text-gray-500 font-bold">
        Please connect your wallet.
      </div>
    );
  if (isWrongNetwork)
    return (
      <div className="p-20 text-center text-red-500 font-bold">
        Wrong Network. Switch to BSC Mainnet.
      </div>
    );

  if (isUserLoading && !userData) {
    return (
      <div className="flex justify-center items-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
        <span className="ml-4 text-yellow-500 font-bold">
          Loading Profile...
        </span>
      </div>
    );
  }

  if (!isRegistered)
    return (
      <div className="p-20 text-center text-yellow-500 font-bold">
        Please register first.
      </div>
    );

  const handlePlaceBet = () => {
    if (selectedNumber === null) return alert("Select a number!");
    const amountWei = parseUnits(betAmount, 18);
    if (availableBalance < amountWei) return alert("Insufficient balance!");

    writeContract({
      address: TRK_GAME_ADDRESS as `0x${string}`,
      abi: TRKRouterABI.abi,
      functionName: isPracticeMode ? "placeBetPractice" : "placeBetCash",
      args: [BigInt(selectedNumber), amountWei],
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-8 text-white min-h-screen pb-20">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-6 left-0 right-0 z-50 flex justify-center"
          >
            <div className="bg-green-600 px-8 py-3 rounded-2xl shadow-2xl border-2 border-green-400 font-bold">
              ✅ Bet Placed Successfully!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Tabs */}
      <div className="flex justify-center">
        <div className="bg-white/5 p-1 rounded-2xl border border-white/10 flex gap-2 w-full max-w-sm">
          <button
            onClick={() => setSelectedGameType("PRACTICE")}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              selectedGameType === "PRACTICE"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "text-gray-500 hover:text-white"
            }`}
          >
            <span>🎮</span> PRACTICE
          </button>
          {isCashPlayer ? (
            <button
              onClick={() => setSelectedGameType("CASH")}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                selectedGameType === "CASH"
                  ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              <span>💰</span> REAL CASH
            </button>
          ) : (
            <div className="flex-1 py-3 px-4 rounded-xl text-[10px] font-black text-gray-600 border border-white/5 flex items-center justify-center text-center leading-tight">
              ACTIVATE CASH
              <br />
              IN DASHBOARD
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-center gap-4">
        <motion.div
          key="practice-bal"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`flex-1 bg-black/40 backdrop-blur-xl border-2 px-6 py-4 rounded-3xl text-center border-blue-500/30`}
        >
          <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Practice Balance
          </div>
          <div className={`text-2xl md:text-3xl font-black text-blue-400`}>
            {Number(formatUnits(practiceBal, 18)).toFixed(2)}{" "}
            <span className="text-xs font-normal opacity-50">USDT</span>
          </div>
          <div className="mt-2 text-[8px] font-black text-blue-500/60 uppercase tracking-widest border border-blue-500/20 py-1 rounded-lg">
            PRACTICE VERIFIED
          </div>
        </motion.div>

        {isCashPlayer && (
          <motion.div
            key="cash-bal"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`flex-1 bg-black/40 backdrop-blur-xl border-2 px-6 py-4 rounded-3xl text-center border-yellow-500/30`}
          >
            <div className="text-[10px] uppercase tracking-widest opacity-40 mb-1 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
              {selectedNumber !== null &&
              !isPracticeMode &&
              digitBalances[selectedNumber] > 0
                ? `Winner Balance (${selectedNumber})`
                : "Real Cash Wallet"}
            </div>
            <div className={`text-2xl md:text-3xl font-black text-yellow-400`}>
              {selectedNumber !== null &&
              !isPracticeMode &&
              digitBalances[selectedNumber] > 0
                ? Number(
                    formatUnits(digitBalances[selectedNumber], 18),
                  ).toFixed(2)
                : Number(formatUnits(cashBal, 18)).toFixed(2)}{" "}
              <span className="text-xs font-normal opacity-50">USDT</span>
            </div>
            <div className="mt-2 text-[8px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20 py-1 rounded-lg">
              {selectedNumber !== null &&
              !isPracticeMode &&
              digitBalances[selectedNumber] > 0
                ? "USING WINNER BALANCE"
                : "REAL CASH VERIFIED"}
            </div>
          </motion.div>
        )}
      </div>

      {/* --- FIXED CIRCLE SECTION --- */}
      <div className="flex justify-center items-center py-6 md:py-10">
        <div className="relative w-48 h-48 md:w-64 md:h-64 flex items-center justify-center transition-all duration-500">
          {/* Rotating Lined Circle (Outer) */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-[6px] border-dashed border-purple-600/40 rounded-full"
          />

          {/* Inner Solid Circle */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-[90%] h-[90%] rounded-full bg-gradient-to-br from-purple-950/60 to-blue-950/60 border-4 border-purple-600 flex flex-col items-center justify-center shadow-[inset_0_0_30px_rgba(168,85,247,0.4)] z-10"
          >
            <motion.span
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="text-5xl md:text-7xl drop-shadow-2xl"
            >
              🎲
            </motion.span>
            <span className="text-[8px] md:text-[10px] font-black text-purple-300 tracking-[0.3em] uppercase mt-2">
              Next Draw
            </span>
            <span className="text-3xl md:text-5xl font-mono font-black text-yellow-400 tracking-tighter">
              {timeLeft}
            </span>
          </motion.div>

          {/* Glow behind everything */}
          <div className="absolute inset-4 bg-purple-600/20 blur-[60px] rounded-full -z-10" />
        </div>
      </div>

      <div className="space-y-6 bg-white/5 p-6 md:p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-sm shadow-xl">
        <h3 className="text-center font-black uppercase tracking-widest text-xs opacity-50">
          Select Winning Number
        </h3>
        <div className="grid grid-cols-5 gap-4 md:gap-5">
          {LUCKY_NUMBERS.map((num) => (
            <motion.button
              key={num}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedNumber(num)}
              className={`aspect-square text-2xl font-black rounded-2xl transition-all border-2 flex items-center justify-center shadow-lg ${
                selectedNumber === num
                  ? "bg-white border-white text-black shadow-[0_0_25px_rgba(255,255,255,0.4)] scale-110 z-10"
                  : "bg-gray-900 border-white/5 hover:border-white/20 text-white"
              }`}
            >
              {num}
            </motion.button>
          ))}
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="w-full bg-black/60 border-2 border-white/10 rounded-2xl px-6 py-4 text-2xl font-black focus:border-purple-500 outline-none transition-all placeholder-gray-600"
                placeholder="Amount"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                USDT
              </span>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={p}
                  onClick={() => setBetAmount(p)}
                  className={`px-4 py-3 md:py-2 border rounded-xl text-xs font-black transition-all ${
                    betAmount === p
                      ? "bg-purple-600 border-purple-400 text-white"
                      : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {p}
                </motion.button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePlaceBet}
            disabled={selectedNumber === null || isPending || isConfirming}
            className="w-full py-5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-2xl font-black text-xl text-black shadow-xl shadow-yellow-900/20 disabled:opacity-40"
          >
            {isPending || isConfirming
              ? "SENDING TO CHAIN..."
              : `🎲 PLACE BET (${selectedNumber ?? "?"})`}
          </motion.button>
        </div>
      </div>

      <DailyResults isPractice={isPracticeMode} />
      <BetHistory
        userAddr={address}
        isPractice={isPracticeMode}
        isNetProfit={isNetProfit}
      />
    </div>
  );
}

function DailyResults({ isPractice }: { isPractice: boolean }) {
  // Round ID comes from Game Engine
  const { data: currentRoundId } = useReadContract({
    address: TRK_ADDRESSES.GAME as `0x${string}`,
    abi: TRKGameEngineABI.abi,
    functionName: isPractice ? "currentPracticeRoundId" : "currentCashRoundId",
  });

  const roundIds = useMemo(() => {
    const id = currentRoundId ? Number(currentRoundId) : 0;
    return Array.from({ length: 15 }, (_, i) => id - i - 1).filter(
      (i) => i >= 1,
    );
  }, [currentRoundId]);

  // Rounds data comes from Game Engine
  const { data: results } = useReadContracts({
    contracts: roundIds.map(
      (id) =>
        ({
          address: TRK_ADDRESSES.GAME as `0x${string}`,
          abi: TRKGameEngineABI.abi,
          functionName: isPractice ? "practiceRounds" : "cashRounds",
          args: [BigInt(id)],
        } as any),
    ),
  });

  return (
    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 px-2">
        Recent Results
      </h3>
      <div className="flex flex-wrap gap-2 justify-start">
        {results?.map((res: unknown, i) => {
          // Check if request succeeded AND round is closed (index 2 is isClosed)
          const typedRes = res as {
            result?: [bigint, bigint, boolean];
            status: string;
          };
          if (!typedRes.result || typedRes.status !== "success") return null;
          const [, winNum, isClosed] = typedRes.result;
          return (
            isClosed && (
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                key={i}
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border-2 ${
                  Number(winNum) % 2 === 0
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                    : "bg-pink-500/10 border-pink-500/40 text-pink-400"
                }`}
              >
                {winNum.toString()}
              </motion.div>
            )
          );
        })}
      </div>
    </div>
  );
}

function BetHistory({
  userAddr,
  isPractice,
  isNetProfit,
}: {
  userAddr: `0x${string}` | undefined;
  isPractice: boolean;
  isNetProfit: boolean;
}) {
  // Round ID comes from Game Engine
  const { data: currentRoundId } = useReadContract({
    address: TRK_ADDRESSES.GAME as `0x${string}`,
    abi: TRKGameEngineABI.abi,
    functionName: isPractice ? "currentPracticeRoundId" : "currentCashRoundId",
    query: { refetchInterval: 5000 },
  });

  const lookback = useMemo(() => {
    const id = currentRoundId ? Number(currentRoundId) : 0;
    return Array.from({ length: 20 }, (_, i) => BigInt(id - i)).filter(
      (i) => i >= BigInt(1),
    );
  }, [currentRoundId]);

  // Batch Fetch Bets
  const { data: betsData } = useReadContracts({
    contracts: lookback.map((id) => ({
      address: TRK_ADDRESSES.GAME as `0x${string}`,
      abi: TRKGameEngineABI.abi,
      functionName: "getUserRoundBets",
      args: [userAddr, id, !isPractice],
    })) as any,
    query: { refetchInterval: 5000 },
  });

  // Batch Fetch Round Info
  const { data: roundsData } = useReadContracts({
    contracts: lookback.map((id) => ({
      address: TRK_ADDRESSES.GAME as `0x${string}`,
      abi: TRKGameEngineABI.abi,
      functionName: isPractice ? "practiceRounds" : "cashRounds",
      args: [id],
    })) as any,
    query: { refetchInterval: 5000 },
  });

  // Process data
  const historyItems = useMemo(() => {
    if (!betsData || !roundsData) return [];

    return lookback
      .map((id, index) => {
        const betRes = betsData[index] as {
          status: string;
          result?: [bigint[], boolean[], boolean[]];
        };
        const roundRes = roundsData[index] as {
          status: string;
          result?: [bigint, bigint, boolean];
        };

        if (
          betRes?.status !== "success" ||
          roundRes?.status !== "success" ||
          !betRes.result ||
          !roundRes.result
        )
          return null;

        const [amounts, claimed] = betRes.result;
        const [, winNum, isClosed] = roundRes.result;

        // Filter out empty bets
        const totalBetAmount = amounts.reduce((a, b) => a + b, BigInt(0));
        if (totalBetAmount === BigInt(0)) return null;

        return {
          roundId: id,
          amounts,
          claimed,
          winningNumber: Number(winNum),
          isClosed,
          totalBetAmount,
        };
      })
      .filter(Boolean);
  }, [betsData, roundsData, lookback]);

  if (!historyItems.length) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 px-4">
        Your Recent Activity
      </h3>
      <div className="space-y-3">
        {historyItems.map((item: any) => (
          <HistoryItem
            key={item.roundId.toString()}
            data={item}
            isPractice={isPractice}
            isNetProfit={isNetProfit}
          />
        ))}
      </div>
    </div>
  );
}
function HistoryItem({
  data,
  isPractice,
  isNetProfit,
}: {
  data: {
    roundId: bigint;
    amounts: bigint[];
    claimed: boolean[];
    winningNumber: number;
    isClosed: boolean;
    totalBetAmount: bigint;
  };
  isPractice: boolean;
  isNetProfit: boolean;
}) {
  const { address } = useAccount();
  const config = useEcosystemConfig();
  const { roundId, amounts, claimed, winningNumber, isClosed, totalBetAmount } =
    data;
  const wonAmount = amounts[winningNumber];
  const isWin = isClosed && wonAmount > BigInt(0);
  const isClaimed = isWin
    ? Boolean(claimed[winningNumber])
    : claimed.some((c: boolean) => c);

  const {
    writeContract: writeClaim,
    data: claimHash,
    isPending,
  } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  useEffect(() => {
    if (isClaimSuccess && claimHash && address) {
      const syncClaim = async () => {
        try {
          await fetch(API_ENDPOINTS.SYNC_WIN, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address,
              hash: claimHash,
              amount: isWin
                ? wonAmount.toString()
                : (totalBetAmount / BigInt(2)).toString(), // Assuming 50% cashback or actual win
              isCash: !isPractice,
              roundId: Number(roundId),
              timestamp: Math.floor(Date.now() / 1000),
            }),
          });
        } catch (err) {
          console.error("Failed to sync win/claim:", err);
        }
      };
      syncClaim();
    }
  }, [
    isClaimSuccess,
    claimHash,
    address,
    isWin,
    wonAmount,
    totalBetAmount,
    isPractice,
    roundId,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-xl"
    >
      <div className="flex items-center gap-5">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
            isWin
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {isClosed ? winningNumber : "?"}
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">
            Round #{roundId.toString()}
          </p>
          <p className="text-lg font-black tracking-tight">
            {formatUnits(totalBetAmount, 18)}{" "}
            <span className="text-xs font-normal opacity-50">USDT</span>
          </p>
          <div className="flex gap-1 mt-1 flex-wrap max-w-[150px]">
            {amounts.map(
              (amt: bigint, idx: number) =>
                amt > BigInt(0) && (
                  <span
                    key={idx}
                    className={`text-[10px] px-1.5 rounded ${
                      idx === winningNumber && isClosed
                        ? "bg-green-500/20 text-green-400 font-bold"
                        : "bg-white/10 text-gray-400"
                    }`}
                  >
                    {idx}
                  </span>
                ),
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end">
        {!isClosed ? (
          <div className="px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-[10px] font-black text-yellow-500 uppercase animate-pulse tracking-widest">
            Live
          </div>
        ) : isClaimed ? (
          <div className="text-right">
            <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
              {isWin ? "Paid Out" : "Cashback"}
            </div>
            {isWin && (
              <div className="flex flex-col text-[8px] text-gray-500 font-bold uppercase mt-1">
                <span>
                  {Number(config?.game.winCashoutMult ?? 2)}X:{" "}
                  {formatUnits(
                    wonAmount * (config?.game.winCashoutMult ?? BigInt(2)),
                    18,
                  )}{" "}
                  (Wallet)
                </span>
                <span>
                  {Number(config?.game.winReinvestMult ?? 6)}X:{" "}
                  {formatUnits(
                    wonAmount * (config?.game.winReinvestMult ?? BigInt(6)),
                    18,
                  )}{" "}
                  (Reinvest)
                </span>
              </div>
            )}
          </div>
        ) : isPractice ? (
          <div
            className={`text-[10px] font-black uppercase tracking-widest italic ${
              isWin ? "text-green-500/60" : "text-red-500/60"
            }`}
          >
            {isWin ? "Win" : "Loss"}
          </div>
        ) : !isWin && isNetProfit ? (
          <div className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest italic">
            No Cashback (Profit)
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() =>
              writeClaim({
                address: TRK_GAME_ADDRESS as `0x${string}`,
                abi: TRKRouterABI.abi,
                functionName: isWin ? "claimWinnings" : "claimImmediateLoss",
                args: [roundId, !isPractice],
              })
            }
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isWin
                ? "bg-green-600 text-white shadow-lg shadow-green-500/20"
                : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            }`}
          >
            {isPending
              ? "..."
              : isWin
              ? `CLAIM ${Number(config?.game.winMultiplier ?? 8)}X WIN`
              : "CLAIM CASHBACK"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
