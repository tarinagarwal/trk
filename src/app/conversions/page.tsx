"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { TRK_ADDRESSES } from "../../config/contractAddresses";
import TRKRouterABI from "../../abis/TRKRouter.json";
import { API_ENDPOINTS } from "../../config/backend";
import { motion } from "framer-motion";

export default function ConversionsPage() {
  const { address, isConnected } = useAccount();
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { data: userData } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: "getUserInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 },
  });

  const u = userData as any;
  const fmt = (v: any) => (v ? Number(formatUnits(v, 18)).toFixed(2) : "0.00");

  // Income breakdown from contract
  const directIncome = fmt(u?.directReferralIncome ?? u?.[9]);
  const winnerIncome = fmt(u?.winnerReferralIncome ?? u?.[10]);
  const practiceIncome = fmt(u?.practiceReferralIncome ?? u?.[11]);
  const cashbackIncome = fmt(u?.cashbackIncome ?? u?.[12]);
  const lossRefIncome = fmt(u?.lossReferralIncome ?? u?.[13]);
  const clubIncome = fmt(u?.clubIncome ?? u?.[14]);
  const luckyIncome = fmt(u?.luckyDrawIncome ?? u?.[15]);
  const totalDeposit = fmt(u?.totalDeposit ?? u?.[6]);
  const totalWithdrawn = fmt(u?.totalWithdrawn ?? u?.[7]);
  const totalBets = fmt(u?.totalBets ?? u?.[22]);
  const totalWins = fmt(u?.totalWins ?? u?.[23]);
  const teamVolume = fmt(u?.teamVolume ?? u?.[21]);
  const directReferrals = Number(u?.directReferrals ?? u?.[31] ?? 0);
  const activeDirects = Number(u?.activeDirects ?? u?.[32] ?? 0);

  // Level-by-level breakdown
  const directByLevel = u?.directReferralIncomeByLevel ?? u?.[17] ?? [];
  const winnerByLevel = u?.winnerReferralIncomeByLevel ?? u?.[18] ?? [];
  const practiceByLevel = u?.practiceReferralIncomeByLevel ?? u?.[19] ?? [];

  useEffect(() => {
    if (!address) return;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(API_ENDPOINTS.GET_HISTORY(address));
        const data = await res.json();
        if (data.success) setHistory(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [address]);

  if (!isConnected)
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Connect wallet to view conversions
      </div>
    );

  const totalRealIncome = (
    Number(directIncome) +
    Number(winnerIncome) +
    Number(cashbackIncome) +
    Number(lossRefIncome) +
    Number(clubIncome) +
    Number(luckyIncome)
  ).toFixed(2);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          📊 Conversions & Income Flow
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Complete breakdown of all income sources, referral flows, and
          conversions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Real Income",
            value: `$${totalRealIncome}`,
            color: "text-green-400",
            bg: "bg-green-500/10 border-green-500/20",
          },
          {
            label: "Total Deposited",
            value: `$${totalDeposit}`,
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
          },
          {
            label: "Total Withdrawn",
            value: `$${totalWithdrawn}`,
            color: "text-yellow-400",
            bg: "bg-yellow-500/10 border-yellow-500/20",
          },
          {
            label: "Team Volume",
            value: `$${teamVolume}`,
            color: "text-purple-400",
            bg: "bg-purple-500/10 border-purple-500/20",
          },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-2xl border ${s.bg}`}
          >
            <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">
              {s.label}
            </div>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[8px] text-gray-600">USDT</div>
          </motion.div>
        ))}
      </div>

      {/* Team Stats */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">
          👥 Team Stats
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-black text-primary">
              {directReferrals}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              Direct Referrals
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-green-400">
              {activeDirects}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              Active Directs (≥100 USDT)
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-yellow-400">
              ${totalBets}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              Total Bets
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-blue-400">
              ${totalWins}
            </div>
            <div className="text-[10px] text-gray-500 uppercase">
              Total Wins
            </div>
          </div>
        </div>
      </div>

      {/* Income Sources Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">
          💰 Income Sources
        </h2>
        <div className="space-y-3">
          {[
            {
              label: "Direct Referral Income",
              value: directIncome,
              color: "text-yellow-400",
              desc: "From team deposits",
            },
            {
              label: "Winner Referral Income",
              value: winnerIncome,
              color: "text-green-400",
              desc: "From team game wins",
            },
            {
              label: "Practice Referral Income",
              value: practiceIncome,
              color: "text-blue-400",
              desc: "From team practice wins",
            },
            {
              label: "Daily Cashback",
              value: cashbackIncome,
              color: "text-cyan-400",
              desc: "0.5% of net losses",
            },
            {
              label: "Team Cashback ROI",
              value: lossRefIncome,
              color: "text-purple-400",
              desc: "50% ROI from team cashback",
            },
            {
              label: "Club Pool Share",
              value: clubIncome,
              color: "text-orange-400",
              desc: "Admin distributed",
            },
            {
              label: "Lucky Draw Prize",
              value: luckyIncome,
              color: "text-pink-400",
              desc: "Draw winnings",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="flex justify-between items-center py-2 border-b border-white/5"
            >
              <div>
                <div className="text-sm font-bold text-white">{item.label}</div>
                <div className="text-[10px] text-gray-500">{item.desc}</div>
              </div>
              <div className={`text-lg font-black font-mono ${item.color}`}>
                ${item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Level-by-Level Breakdown */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">
          📊 Level-by-Level Income
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-[10px] uppercase tracking-widest border-b border-white/5">
                <th className="py-3 text-left">Level</th>
                <th className="py-3 text-right">Direct Referral</th>
                <th className="py-3 text-right">Winner Referral</th>
                <th className="py-3 text-right">Practice Referral</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 15 }, (_, i) => {
                const d = directByLevel[i]
                  ? Number(formatUnits(directByLevel[i], 18)).toFixed(2)
                  : "0.00";
                const w = winnerByLevel[i]
                  ? Number(formatUnits(winnerByLevel[i], 18)).toFixed(2)
                  : "0.00";
                const p = practiceByLevel[i]
                  ? Number(formatUnits(practiceByLevel[i], 18)).toFixed(2)
                  : "0.00";
                const hasAny = Number(d) > 0 || Number(w) > 0 || Number(p) > 0;
                return (
                  <tr
                    key={i}
                    className={`border-b border-white/5 ${
                      hasAny ? "" : "opacity-30"
                    }`}
                  >
                    <td className="py-2 font-bold text-gray-400">L{i + 1}</td>
                    <td className="py-2 text-right font-mono text-yellow-400">
                      ${d}
                    </td>
                    <td className="py-2 text-right font-mono text-green-400">
                      ${w}
                    </td>
                    <td className="py-2 text-right font-mono text-blue-400">
                      ${p}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      {history && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-black text-white mb-4 uppercase tracking-tighter">
            📜 Transaction History
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-6">
            <div>
              <div className="text-xl font-black text-blue-400">
                {history.deposits?.length ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">
                Deposits
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-red-400">
                {history.withdrawals?.length ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">
                Withdrawals
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-yellow-400">
                {history.bets?.length ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Bets</div>
            </div>
            <div>
              <div className="text-xl font-black text-green-400">
                {history.winnings?.length ?? 0}
              </div>
              <div className="text-[10px] text-gray-500 uppercase">Wins</div>
            </div>
          </div>

          {/* Recent Income Events */}
          <h3 className="text-sm font-black text-gray-400 uppercase mb-3">
            Recent Income Events
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(history.incomes ?? []).slice(0, 20).map((inc: any, i: number) => (
              <div
                key={i}
                className="flex justify-between items-center text-xs py-1.5 border-b border-white/5"
              >
                <div>
                  <span className="text-white font-bold">{inc.source}</span>
                  <span className="text-gray-600 ml-2 font-mono">
                    {inc.walletType}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-mono font-bold">
                    +${Number(formatUnits(BigInt(inc.amount), 18)).toFixed(2)}
                  </div>
                  <div className="text-gray-600 text-[9px]">
                    {new Date(inc.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            {(history.incomes ?? []).length === 0 && (
              <div className="text-center text-gray-600 py-4 text-xs">
                No income events yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
