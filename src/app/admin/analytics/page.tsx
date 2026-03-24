'use client';

import { useState, useEffect, useMemo } from 'react';
import { useReadContract, useReadContracts, useAccount, usePublicClient } from 'wagmi';
import { TRK_GAME_ADDRESS } from '../../../config';
import TRKRouterABI from '../../../abis/TRKRouter.json';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminAnalytics() {
    const { address } = useAccount();
    const publicClient = usePublicClient();
    const [roundId, setRoundId] = useState('1');
    const [isCashGame, setIsCashGame] = useState(true);
    const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

    // Check if user is admin
    const { data: ownerAddress } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKRouterABI.abi,
        functionName: 'owner',
    });

    const isAdmin = Boolean(
        ownerAddress &&
        address &&
        (ownerAddress as string).toLowerCase() === address.toLowerCase()
    );

    // Get current round IDs
    const { data: currentCashRound } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKRouterABI.abi,
        functionName: 'currentCashRoundId',
        query: { enabled: isAdmin, refetchInterval: 10000 },
    });

    const { data: currentPracticeRound } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKRouterABI.abi,
        functionName: 'currentPracticeRoundId',
        query: { enabled: isAdmin, refetchInterval: 10000 },
    });

    // Auto-update roundId when game type changes or current rounds are fetched
    useEffect(() => {
        if (isCashGame && currentCashRound) {
            setRoundId(currentCashRound.toString());
        } else if (!isCashGame && currentPracticeRound) {
            setRoundId(currentPracticeRound.toString());
        }
    }, [isCashGame, currentCashRound, currentPracticeRound]);

    // Batch fetch bet totals for all numbers 0-9
    const { data: betTotalsData, isLoading: isTotalsLoading } = useReadContracts({
        contracts: Array.from({ length: 10 }).map((_, i) => ({
            address: TRK_GAME_ADDRESS as `0x${string}`,
            abi: TRKRouterABI.abi as any,
            functionName: isCashGame ? 'cashBetTotalsByNumber' : 'practiceBetTotalsByNumber',
            args: [BigInt(roundId), BigInt(i)],
        })),
        query: { enabled: isAdmin && !!roundId }
    });

    const betTotals = useMemo(() => {
        return betTotalsData?.map(res => res.status === 'success' ? (res.result as bigint) : BigInt(0)) || Array(10).fill(BigInt(0));
    }, [betTotalsData]);

    const totalVolume = useMemo(() => {
        return betTotals.reduce((a, b) => a + b, BigInt(0));
    }, [betTotals]);

    // Get betters list for selected number
    const { data: bettersList, isLoading: isBettersLoading } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKRouterABI.abi,
        functionName: isCashGame ? 'cashBettersByNumber' : 'practiceBettersByNumber',
        args: [BigInt(roundId), BigInt(selectedNumber ?? 0)],
        query: { enabled: selectedNumber !== null && isAdmin },
    });

    // Get winners for the round
    const { data: winnersList, isLoading: isWinnersLoading } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKRouterABI.abi,
        functionName: isCashGame ? 'cashRoundWinners' : 'practiceRoundWinners',
        args: [BigInt(roundId)],
        query: { enabled: !!roundId && isAdmin },
    });

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center p-12 bg-gray-900/50 rounded-3xl border border-red-500/20 backdrop-blur-xl">
                    <h1 className="text-4xl font-black text-red-500 mb-4 tracking-tighter uppercase">Access Denied</h1>
                    <p className="text-gray-400 font-mono">Permission level: Admin required</p>
                </motion.div>
            </div>
        );
    }

    const betters = bettersList as string[] | undefined;
    const winners = winnersList as string[] | undefined;

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-yellow-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 py-12 md:px-8 space-y-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent italic">
                            ANALYTICS<span className="text-yellow-500 font-normal">.</span>
                        </h1>
                        <p className="text-gray-500 font-mono text-sm tracking-widest uppercase">Real-time Platform Intelligence</p>
                    </div>
                    
                    <div className="flex flex-col md:items-end gap-2">
                         <div className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">Quick Stats</div>
                         <div className="flex gap-4">
                            <StatBox label="Total Vol" value={`$${formatUnits(totalVolume, 18)}`} color="text-green-400" />
                            <StatBox label="Game Type" value={isCashGame ? 'CASH' : 'PRACTICE'} color={isCashGame ? 'text-yellow-400' : 'text-blue-400'} />
                         </div>
                    </div>
                </div>

                {/* Controls - Premium Bar */}
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-wrap items-center gap-6 p-2 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-md">
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl">
                        <button 
                            onClick={() => setIsCashGame(true)}
                            className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all ${isCashGame ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            REAL CASH
                        </button>
                        <button 
                            onClick={() => setIsCashGame(false)}
                            className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all ${!isCashGame ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            PRACTICE
                        </button>
                    </div>

                    <div className="h-8 w-px bg-white/10" />

                    <div className="flex items-center gap-4 flex-1">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Round Index:</span>
                        <div className="relative group flex-1 max-w-[200px]">
                            <input
                                type="number"
                                value={roundId}
                                onChange={(e) => setRoundId(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono focus:border-yellow-500/50 outline-none transition-all"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-gray-600 font-bold">
                                MAX: {isCashGame ? currentCashRound?.toString() : currentPracticeRound?.toString()}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Main Grid: Numbers & Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Numbers Grid */}
                    <div className="lg:col-span-3 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black italic tracking-tight">NUMBER_VOLUME</h2>
                            <div className="text-[10px] font-mono text-gray-600 uppercase animate-pulse">Live Update Active</div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            {betTotals.map((total, index) => {
                                const percentage = totalVolume > BigInt(0) ? Number((total * BigInt(100)) / totalVolume) : 0;
                                return (
                                <motion.button
                                    key={index}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setSelectedNumber(index)}
                                    className={`relative group overflow-hidden p-6 rounded-3xl border transition-all duration-300 ${selectedNumber === index
                                            ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_40px_rgba(234,179,8,0.1)]'
                                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                                        }`}
                                >
                                    <div className={`text-5xl font-black mb-4 transition-colors ${selectedNumber === index ? 'text-yellow-500' : 'text-gray-700 group-hover:text-white'}`}>{index}</div>
                                    <div className="space-y-1 text-left">
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Payout Pool</div>
                                        <div className="text-xl font-mono font-bold">${Number(formatUnits(total, 18)).toFixed(2)}</div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-yellow-500/20 w-full">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${percentage}%` }}
                                            className="h-full bg-yellow-500" 
                                        />
                                    </div>
                                    <div className="absolute top-4 right-4 text-[10px] font-mono text-gray-600">{percentage}%</div>
                                </motion.button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Winners Sidebar */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-black italic tracking-tight">WINNER_LOG</h2>
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 min-h-[400px] backdrop-blur-xl">
                            {isWinnersLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-4">
                                    <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Syncing Winners</span>
                                </div>
                            ) : winners && winners.length > 0 ? (
                                <div className="space-y-3">
                                    {winners.map((winner, idx) => (
                                        <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.05 }} key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 group hover:border-green-500/30 transition-all">
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] font-black text-green-400">#{(idx + 1).toString().padStart(2, '0')}</div>
                                            <div className="font-mono text-[11px] text-gray-400 group-hover:text-white truncate">{winner}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-center">
                                    <span className="text-4xl mb-4 grayscale opacity-20">🏆</span>
                                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No Winners Found</p>
                                    <p className="text-[10px] text-gray-700 mt-2">Check if round is closed</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Detailed Betters for Selected Number */}
                <AnimatePresence mode="wait">
                    {selectedNumber !== null && (
                        <motion.div 
                            key={`betters-${selectedNumber}`}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 20, opacity: 0 }}
                            className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-3xl overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 p-8">
                                <button onClick={() => setSelectedNumber(null)} className="text-gray-500 hover:text-white font-black text-xs uppercase tracking-widest">Close [×</button>
                            </div>

                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                                <div>
                                    <h2 className="text-3xl font-black tracking-tighter italic mb-1 uppercase">BET_DETAILS</h2>
                                    <p className="text-gray-500 text-xs font-bold">Number {selectedNumber} — {betters?.length || 0} Participants Found</p>
                                </div>
                                <div className="px-6 py-2 bg-yellow-500 text-black rounded-full text-xs font-black uppercase tracking-widest">Total: ${Number(formatUnits(betTotals[selectedNumber], 18)).toFixed(2)}</div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10 text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">
                                            <th className="text-left py-4 px-4">Rank</th>
                                            <th className="text-left py-4 px-4">Identity (Public Address)</th>
                                            <th className="text-right py-4 px-4">Share (Est)</th>
                                            <th className="text-right py-4 px-4">Verification</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {isBettersLoading ? (
                                            <tr><td colSpan={4} className="py-20 text-center text-gray-500 font-mono text-xs uppercase animate-pulse">Fetching Transaction Logs...</td></tr>
                                        ) : betters && betters.length > 0 ? (
                                            betters.map((better, idx) => (
                                                <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4 px-4 font-mono text-xs text-gray-500">{(idx + 1).toString().padStart(2, '0')}</td>
                                                    <td className="py-4 px-4 font-mono text-sm text-gray-300 group-hover:text-white transition-colors">
                                                        {better}
                                                    </td>
                                                    <td className="py-4 px-4 text-right font-mono text-xs text-gray-500">
                                                        -
                                                    </td>
                                                    <td className="py-4 px-4 text-right whitespace-nowrap">
                                                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-500/20">On-Chain</span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="py-20 text-center">
                                                    <div className="text-xs font-bold text-gray-600 uppercase tracking-widest">No entries for this target</div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function StatBox({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl px-5 py-3 min-w-[120px]">
            <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-xl font-mono font-bold ${color}`}>{value}</div>
        </div>
    );
}
