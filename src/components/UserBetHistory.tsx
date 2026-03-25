import { useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { API_ENDPOINTS } from "../config/backend";
import { useEffect } from "react";
import { TRK_ADDRESSES } from "../config/contractAddresses";
import TRKGameEngineABI from "../abis/TRKGameEngine.json";

export default function UserBetHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [mode, setMode] = useState<"practice" | "cash">("practice");

  const isPractice = mode === "practice";

  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const toBool = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      return v === "1" || v === "true";
    }
    return false;
  };

  const fetchHistory = async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const [historyRes, roundsRes] = await Promise.allSettled([
        fetch(API_ENDPOINTS.GET_HISTORY(address)),
        fetch(API_ENDPOINTS.GET_ROUNDS),
      ]);
      const historyData =
        historyRes.status === "fulfilled"
          ? await historyRes.value.json()
          : null;
      const roundsData =
        roundsRes.status === "fulfilled" ? await roundsRes.value.json() : null;

      if (historyData?.success) {
        const targetIsCash = !isPractice;
        const bets = historyData.bets.filter(
          (b: any) => toBool(b.isCash) === targetIsCash,
        );
        const rounds = roundsData?.success ? roundsData.rounds : [];

        // Build round lookup map
        const roundsByKey = new Map<string, any>();
        for (const r of rounds) {
          roundsByKey.set(`${toBool(r.isCash)}-${Number(r.roundId)}`, r);
        }

        // Fallback: read missing round status from chain
        if (publicClient && bets.length > 0) {
          const missingRoundIds: number[] = Array.from(
            new Set(
              bets
                .map((b: any) => Number(b.roundId))
                .filter(
                  (id: number) => !roundsByKey.has(`${targetIsCash}-${id}`),
                ),
            ),
          );

          if (missingRoundIds.length > 0) {
            const contracts = missingRoundIds.map((id: number) => ({
              address: TRK_ADDRESSES.GAME,
              abi: TRKGameEngineABI.abi,
              functionName: targetIsCash ? "cashRounds" : "practiceRounds",
              args: [BigInt(id)],
            }));

            const onchainRounds = await publicClient.multicall({
              contracts: contracts as any,
              allowFailure: true,
            });

            onchainRounds.forEach((resp: any, idx: number) => {
              if (resp?.status !== "success" || !resp.result) return;
              const result = resp.result as any;
              const roundId = Number(
                result?.roundId ?? result?.[0] ?? missingRoundIds[idx],
              );
              const winningNumber = Number(
                result?.winningNumber ?? result?.[1] ?? 0,
              );
              const isClosed = Boolean(
                result?.isClosed ?? result?.[2] ?? false,
              );
              roundsByKey.set(`${targetIsCash}-${roundId}`, {
                roundId,
                winningNumber,
                isCash: targetIsCash,
                isClosed,
              });
            });
          }
        }

        const list = bets.map((bet: any) => {
          const betIsCash = toBool(bet.isCash);
          const key = `${betIsCash}-${Number(bet.roundId)}`;
          const round = roundsByKey.get(key);
          const isClosed = Boolean(round?.isClosed ?? false);
          const winningNumber = isClosed ? Number(round?.winningNumber) : null;
          const isWin = isClosed && bet.prediction === winningNumber;
          const amountBI = BigInt(bet.amount);

          const creditedPayout = isWin
            ? betIsCash
              ? amountBI * BigInt(2)
              : amountBI * BigInt(8)
            : BigInt(0);

          const totalReturn = isWin ? amountBI * BigInt(8) : BigInt(0);

          return {
            roundId: bet.roundId,
            prediction: bet.prediction,
            winningNumber,
            amount: amountBI,
            creditedPayout,
            totalReturn,
            isWin,
            isClosed,
            isCashGame: betIsCash,
          };
        });
        setHistory(list);
      }
    } catch (e) {
      console.error("Failed to fetch bet history:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [address, mode, publicClient]);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📜 My Bet History</h2>
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl">
          <button
            onClick={() => setMode("cash")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !isPractice
                ? "bg-yellow-500 text-black shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Real Cash
          </button>
          <button
            onClick={() => setMode("practice")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isPractice
                ? "bg-blue-500 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Practice
          </button>
        </div>
      </div>

      <div className="overflow-x-auto mb-6 rounded-xl border border-white/5">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="text-left py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                Round
              </th>
              <th className="text-center py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                My #
              </th>
              <th className="text-center py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                Win #
              </th>
              <th className="text-right py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                Bet
              </th>
              <th className="text-right py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                Real Credit
              </th>
              <th className="text-center py-4 px-4 text-[10px] uppercase tracking-widest text-gray-400">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-gray-500 animate-pulse text-xs uppercase tracking-widest"
                >
                  Loading history...
                </td>
              </tr>
            )}
            {!isLoading && history.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-gray-500 text-xs uppercase tracking-widest"
                >
                  No recent bets found.
                </td>
              </tr>
            )}
            {history.map((bet, idx) => (
              <tr
                key={idx}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4 font-mono text-sm text-gray-300">
                  #{bet.roundId.toString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center font-bold text-white">
                    {bet.prediction.toString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {!bet.isClosed ? (
                    <span className="text-yellow-500 text-xs font-bold animate-pulse">
                      LIVE
                    </span>
                  ) : (
                    <span
                      className={`inline-block w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                        bet.isWin
                          ? "bg-green-500/20 border border-green-500 text-green-500"
                          : "bg-red-500/20 border border-red-500 text-red-500"
                      }`}
                    >
                      {bet.winningNumber?.toString() ?? "?"}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono text-gray-300">
                  {formatUnits(bet.amount, 18)}
                </td>
                <td className="py-3 px-4 text-right font-bold">
                  {bet.isWin ? (
                    <span className="text-green-400">
                      +{formatUnits(bet.creditedPayout, 18)}
                    </span>
                  ) : !bet.isClosed ? (
                    <span className="text-gray-500">-</span>
                  ) : (
                    <span className="text-red-500/50">0</span>
                  )}
                  {bet.isWin && bet.isCashGame && (
                    <span className="block text-[10px] text-yellow-500/80 font-black uppercase tracking-wide mt-1">
                      6X Reinvest: {formatUnits(bet.amount * BigInt(6), 18)}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {!bet.isClosed ? (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      PENDING
                    </span>
                  ) : bet.isWin ? (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      WON
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                      LOST
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-center text-[10px] text-gray-600 uppercase tracking-widest">
        Showing last 50 rounds
      </div>
    </div>
  );
}
