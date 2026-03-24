'use client';

import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { TRK_GAME_ADDRESS, TRK_ADDRESSES } from '../../config'; 
import TRKGameABI from '../../abis/TRKRouter.json';
import { useState, useEffect, memo, useMemo } from 'react';
import { formatUnits, parseAbiItem } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { API_ENDPOINTS } from '../../config/backend';

// --- CONFIG ---
const COMMISSION_RATES = [5, 2, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

// --- RECURSIVE TREE ITEM (Memoized for performance) ---
const ReferralTreeItem = memo(({ 
    address, 
    level, 
    onShowDetails 
}: { 
    address: string, 
    level: number, 
    onShowDetails: (addr: string, lvl: number) => void 
}) => {
    const publicClient = usePublicClient();
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [childCount, setChildCount] = useState<number>(0);
    const [hasLoadedCount, setHasLoadedCount] = useState(false);

    useEffect(() => {
        let mounted = true;
        async function fetchInfo() {
            if (hasLoadedCount) return;
            try {
                const res = await fetch(API_ENDPOINTS.GET_TEAM_STATS(address));
                const data = await res.json();
                if (mounted && data.success) {
                    setChildCount(data.direct?.length || 0);
                    setHasLoadedCount(true);
                }
            } catch (err) {
                console.error("Error fetching child info", err);
            }
        }
        fetchInfo();
        return () => { mounted = false; };
    }, [address, hasLoadedCount]);

    const handleExpand = async () => {
        if (isExpanded) {
            setIsExpanded(false);
            return;
        }
        setIsExpanded(true);
        if (children.length > 0 || childCount === 0) return;

        setLoading(true);
        try {
            const res = await fetch(API_ENDPOINTS.GET_TEAM_STATS(address));
            const data = await res.json();
            if (data.success) {
                setChildren(data.direct || []);
            }
        } catch (err) {
            console.error("Error fetching children", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-2 relative">
            <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-xl border flex justify-between items-center transition-all group
                    ${level === 0 ? 'bg-black/40 border-gray-700' : 
                      level === 1 ? 'bg-black/20 border-gray-800 ml-4' : 
                      'bg-transparent border-gray-900 ml-8'}
                    ${childCount > 0 ? 'cursor-pointer hover:border-primary/30' : ''}`}
                onClick={childCount > 0 ? handleExpand : undefined}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border
                        ${level === 0 ? 'bg-primary/20 text-primary border-primary/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        L{level + 1}
                    </div>
                    <div className="min-w-0">
                        <p className="font-mono text-gray-200 text-sm truncate">{address}</p>
                        {hasLoadedCount && (
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                Sponsoring: <span className="text-white font-bold">{childCount}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onShowDetails(address, level + 1); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>
                    {childCount > 0 && (
                        <div className={`w-6 text-center text-primary font-bold transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            {isExpanded ? '−' : '+'}
                        </div>
                    )}
                </div>
            </motion.div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-4 overflow-hidden border-l border-dashed border-gray-800"
                    >
                        {loading ? (
                            <p className="text-xs text-gray-500 p-4 animate-pulse">Scanning blockchain...</p>
                        ) : (
                            <div className="pt-2">
                                {children.map((childAddr, idx) => (
                                    <ReferralTreeItem key={idx} address={childAddr} level={level + 1} onShowDetails={onShowDetails} />
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

// --- USER DETAIL MODAL ---
function UserDetailModal({ address, level, onClose }: { address: string; level: number; onClose: () => void }) {
    const { data: userData, isLoading } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'getUserInfo',
        args: [address as `0x${string}`],
    });

    const user = userData ? (userData as any) : null;
    const totalDeposit = user?.cumulativeDeposit ? Number(formatUnits(user.cumulativeDeposit, 18)) : 0;
    const rate = COMMISSION_RATES[level - 1] || 0;

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
                className="bg-[#121212] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Partner Detail</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                    {isLoading || !user ? (
                        <div className="py-12 text-center animate-pulse text-primary">Loading Data...</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                <p className="text-xs text-gray-500 mb-1">WALLET ADDRESS</p>
                                <p className="font-mono text-sm break-all text-blue-400">{address}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                    <p className="text-xs text-gray-500 mb-1">TOTAL DEPOSIT</p>
                                    <p className="text-xl font-bold">{totalDeposit.toFixed(2)} USDT</p>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                    <p className="text-xs text-gray-500 mb-1">YOUR RATE (L{level})</p>
                                    <p className="text-xl font-bold text-primary">{rate}%</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

// --- MAIN PAGE ---
export default function ReferralPage() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [referralCode, setReferralCode] = useState('');
    const [directReferrals, setDirectReferrals] = useState<string[]>([]);
    const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ address: string; level: number } | null>(null);
    const [networkStats, setNetworkStats] = useState<{[lvl: number]: { count: number, bonus: bigint }}>({});
    const [teamCount, setTeamCount] = useState(0);
    const [isSyncingStats, setIsSyncingStats] = useState(false);
    const [conversionHistory, setConversionHistory] = useState<{amount: bigint, timestamp: number}[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [teamTotalCash, setTeamTotalCash] = useState<bigint>(BigInt(0));
    const [teamTotalPractice, setTeamTotalPractice] = useState<bigint>(BigInt(0));

    // Contract Reads — getUserInfo returns a named struct from wagmi, access by field name NOT by index
    const { data: userData } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'getUserInfo',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address }
    });

    const { data: userRefCode } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'addressToReferralCode',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address }
    });

    // wagmi decodes Solidity structs as named JS objects — use field names, with tuple fallbacks
    const user = userData as any;
    const isRegistered: boolean      = user?.isRegistered       ?? (userData as any[])?.[28] ?? false;
    const directReferralCount: number = user?.directReferrals    ? Number(user.directReferrals) : (userData as any[])?.[31] ? Number((userData as any[])?.[31]) : 0;
    const cumulativeDeposit: bigint   = user?.cumulativeDeposit  ?? (userData as any[])?.[8] ?? BigInt(0);
    const minReferralPayout: bigint   = BigInt(100) * BigInt(10 ** 18); // 100 USDT
    const isEligible: boolean         = cumulativeDeposit >= minReferralPayout;
    
    const dIncomeVal = user?.directReferralIncome ?? (userData as any[])?.[9] ?? BigInt(0);
    const wIncomeVal = user?.winnerReferralIncome ?? (userData as any[])?.[10] ?? BigInt(0);
    const pIncomeVal = user?.practiceReferralIncome ?? (userData as any[])?.[11] ?? BigInt(0);
    const totalDepositVal: bigint = user?.totalDeposit ?? (userData as any[])?.[6] ?? BigInt(0);

    // Total cash income = direct + winner referral (all sources from team)
    const totalCashIncomeVal: bigint = dIncomeVal + wIncomeVal;
    const totalTeamIncomeVal: string   = formatUnits(totalCashIncomeVal, 18);
    const totalWinnerIncomeVal: string = formatUnits(wIncomeVal, 18);
    const totalPracticeIncomeVal: string = formatUnits(pIncomeVal, 18);

    const totalTeamCount = directReferralCount;
    const isBasicActivated = totalDepositVal >= (BigInt(10) * BigInt(10 ** 18));
    const isProActivated = cumulativeDeposit >= (BigInt(100) * BigInt(10 ** 18));

    useEffect(() => { if (userRefCode) setReferralCode(userRefCode as string); }, [userRefCode]);

    // Fetched via GET_TEAM_STATS instead of recursive contract reads

    // Fetch Level 1 referrals from contract (prevents old backend team cache from affecting testing)
    useEffect(() => {
        if (!address || !publicClient || directReferralCount <= 0) {
            setDirectReferrals([]);
            setTeamCount(0);
            return;
        }

        const client = publicClient;

        let cancelled = false;
        async function fetchDirectReferrals() {
            setIsSyncingStats(true);
            try {
                const calls = Array.from({ length: directReferralCount }, (_, i) =>
                    client.readContract({
                        address: TRK_GAME_ADDRESS as `0x${string}`,
                        abi: TRKGameABI.abi,
                        functionName: 'directReferralsList',
                        args: [address as `0x${string}`, BigInt(i)]
                    })
                );

                const refs = await Promise.all(calls);
                if (!cancelled) {
                    setDirectReferrals(refs as string[]);
                    setTeamCount((refs as string[]).length);
                }
            } catch (err) {
                console.error("Failed to fetch direct referrals:", err);
                if (!cancelled) {
                    setDirectReferrals([]);
                    setTeamCount(0);
                }
            } finally {
                if (!cancelled) setIsSyncingStats(false);
            }
        }

        fetchDirectReferrals();
        return () => { cancelled = true; };
    }, [address, publicClient, directReferralCount]);

    // Fetch team members' cash + practice balances from contract
    useEffect(() => {
        if (!address || !publicClient) return;
        let cancelled = false;
        async function fetchTeamBalances() {
            try {
                const res = await fetch(API_ENDPOINTS.GET_TEAM_STATS(address as string));
                const data = await res.json();
                if (!data.success || !data.allMembers || data.allMembers.length === 0) return;

                const calls = data.allMembers.map((member: string) =>
                    publicClient!.readContract({
                        address: TRK_GAME_ADDRESS as `0x${string}`,
                        abi: TRKGameABI.abi,
                        functionName: 'getUserInfo',
                        args: [member as `0x${string}`]
                    })
                );
                const results = await Promise.all(calls);
                let cashSum = BigInt(0);
                let practiceSum = BigInt(0);
                for (const r of results) {
                    const u = r as any;
                    cashSum += u?.cashGameBalance ?? (r as any[])?.[5] ?? BigInt(0);
                    practiceSum += u?.practiceBalance ?? (r as any[])?.[4] ?? BigInt(0);
                }
                if (!cancelled) {
                    setTeamTotalCash(cashSum);
                    setTeamTotalPractice(practiceSum);
                }
            } catch (err) {
                console.error("Failed to fetch team balances:", err);
            }
        }
        fetchTeamBalances();
        return () => { cancelled = true; };
    }, [address, publicClient]);

    // Fetch History from Backend
    useEffect(() => {
        if (!address) return;

        async function fetchHistory() {
            setIsLoadingHistory(true);
            try {
                const res = await fetch(API_ENDPOINTS.GET_HISTORY(address as string));
                const data = await res.json();
                if (data.success && data.conversions) {
                    setConversionHistory(data.conversions.map((it: any) => ({
                        amount: BigInt(it.amount),
                        timestamp: Number(it.timestamp)
                    })));
                }
            } catch (err) {
                console.error("Failed to fetch conversion history:", err);
            } finally {
                setIsLoadingHistory(false);
            }
        }
        fetchHistory();
    }, [address]);

    if (!isConnected) return <div className="py-20 text-center text-gray-500">Connect wallet to continue.</div>;

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <motion.h1 
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-500"
            >
                💰 Referral Program
            </motion.h1>

            {!isEligible && (
                <div className="bg-blue-500/10 border border-blue-500/50 p-4 rounded-xl mb-8 text-center text-sm">
                    <p className="text-blue-400 font-bold">ℹ️ Practice Earning Mode</p>
                    <p className="text-gray-400">Deposit {formatUnits(minReferralPayout, 18)} USDT to unlock real commissions.</p>
                </div>
            )}

            {/* Code Card */}
            <div className="bg-surface/50 p-8 rounded-2xl border border-gray-800 mb-8 backdrop-blur-md">
                <h2 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Your Invitation Link</h2>
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="w-full bg-black/50 border border-gray-700 rounded-xl p-4 font-mono text-2xl text-center text-primary">
                        {referralCode || 'GENERATING...'}
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-4 text-center italic">Share this code with your network to earn from 15 levels of depth.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
                {[
                    { label: 'Total Team', val: totalTeamCount, color: 'text-primary' },
                    { label: 'Total Team Cash Balance', val: `${Number(formatUnits(teamTotalCash, 18)).toFixed(2)} USDT`, color: 'text-green-400' },
                    { label: 'Total Team Practice Balance', val: `${Number(formatUnits(teamTotalPractice, 18)).toFixed(2)} USDT`, color: 'text-yellow-500' }
                ].map((stat, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                        className="bg-surface/50 p-6 rounded-2xl border border-gray-800 shadow-xl"
                    >
                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">{stat.label}</p>
                        <p className={`text-3xl font-bold ${stat.color}`}>{stat.val}</p>
                    </motion.div>
                ))}
            </div>

            {/* Consolidated View Section */}
            <div className="bg-gray-900/40 p-6 md:p-8 rounded-3xl border border-gray-800 backdrop-blur-xl mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                            <span className="text-3xl">📊</span> Level Breakdown
                        </h2>
                        <p className="text-gray-400 text-sm">Consolidated view of your network capacity and earnings.</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-full">
                        <span className="text-primary font-bold text-sm">15 Active Levels</span>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-y-2">
                        <thead>
                            <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black italic">
                                <th className="px-4 py-2">Tier</th>
                                <th className="px-4 py-2">Total Team</th>
                                <th className="px-4 py-2">Practice Bonus</th>
                                <th className="px-4 py-2">Cash Income</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 15 }).map((_, i) => {
                                // Fallback to index-based access if named properties are missing (Wagmi/Ethers tuple format)
                                const directArray = user?.directReferralIncomeByLevel || (userData as any[])?.[17];
                                const winnerArray = user?.winnerReferralIncomeByLevel || (userData as any[])?.[18];
                                const practiceArrayFromContract = user?.practiceReferralIncomeByLevel || (userData as any[])?.[19];
                                
                                const d = (directArray && Array.isArray(directArray)) ? (directArray[i] ?? BigInt(0)) : BigInt(0);
                                const w = (winnerArray && Array.isArray(winnerArray)) ? (winnerArray[i] ?? BigInt(0)) : BigInt(0);
                                const pFromContract = (practiceArrayFromContract && Array.isArray(practiceArrayFromContract)) ? (practiceArrayFromContract[i] ?? BigInt(0)) : BigInt(0);
                                
                                // For testing clarity, use live contract-backed Level 1 count and keep deeper counts neutral.
                                const stats = i === 0
                                    ? { count: directReferrals.length, bonus: BigInt(0) }
                                    : { count: 0, bonus: BigInt(0) };
                                
                                // registration rewards (from synced events). 
                                // Priority: Use backend synced data (covers 100 levels) or fallback to contract (covers 15)
                                const pTotal = stats.bonus > BigInt(0) ? stats.bonus : pFromContract; 
                                const cash = d + w;
                                const isBasicLevel = i < 3;
                                const isLevelActivated = isBasicLevel ? isBasicActivated : isProActivated;

                                const isL1 = i === 0;

                                const rowBorder = isLevelActivated ? 'border-l-2 border-l-green-500/60' : 'border-l-2 border-l-red-500/60';
                                const activationLabel = isBasicLevel
                                    ? (isBasicActivated ? '✅ BASIC ACTIVE' : '🔴 BASIC LOCKED — Deposit 10 USDT')
                                    : (isProActivated   ? '✅ PRO ACTIVE'   : '🔴 PRO LOCKED — Deposit 100 USDT cumulative');

                                return (
                                    <motion.tr
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className={`transition-all group rounded-xl ${rowBorder} ${
                                            isLevelActivated
                                                ? 'bg-green-500/5 hover:bg-green-500/10'
                                                : 'bg-red-500/5 hover:bg-red-500/10'
                                        }`}
                                    >
                                        <td className="px-4 py-4 rounded-l-xl">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border ${
                                                    isLevelActivated
                                                        ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                                        : 'bg-red-500/20 text-red-400 border-red-500/40'
                                                }`}>
                                                    L{i + 1}
                                                </div>
                                                <div>
                                                    <span className={`font-mono text-[10px] uppercase font-bold tracking-tighter ${isLevelActivated ? 'text-green-400' : 'text-red-400'}`}>
                                                        Level {i + 1}
                                                    </span>
                                                    <p className={`text-[9px] font-black uppercase tracking-wider ${isLevelActivated ? 'text-green-500/80' : 'text-red-500/70'}`}>
                                                        {activationLabel}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-bold text-white">
                                            <span className="flex items-center gap-2">
                                                {stats.count} <small className="text-[10px] text-gray-500 font-normal">users</small>
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className={`text-sm font-mono italic ${pTotal > 0 ? 'text-yellow-500' : 'text-gray-500'}`}>
                                               {formatUnits(pTotal, 18)} <span className="text-[10px] text-gray-500 not-italic uppercase">USDT</span>
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 rounded-r-xl">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                                                isLevelActivated
                                                    ? 'bg-green-500/15 border-green-500/40 text-green-400'
                                                    : 'bg-red-500/15 border-red-500/40 text-red-400'
                                            }`}>
                                                <span className="text-sm font-bold font-mono">
                                                    +{formatUnits(cash, 18)}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-normal">USDT</span>
                                            </div>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-800/50 flex flex-col gap-3 text-xs">
                    <div className="flex items-center gap-3">
                        <span className="shrink-0 bg-green-500/15 border border-green-500/40 text-green-400 px-2 py-0.5 rounded font-black tracking-tighter uppercase">✅ Green</span>
                        <span className="text-gray-400">Level is <strong className="text-green-400">ACTIVE</strong> — you are earning cash income from this level.</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="shrink-0 bg-red-500/15 border border-red-500/40 text-red-400 px-2 py-0.5 rounded font-black tracking-tighter uppercase">🔴 Red</span>
                        <span className="text-gray-400">Level is <strong className="text-red-400">LOCKED</strong> — deposit more USDT to unlock. Basic (L1–L3): 10 USDT · Pro (L4–L15): 100 USDT cumulative.</span>
                    </div>
                </div>
            </div>

            {/* Conversion History Section */}
            <div className="bg-gray-900/40 p-6 md:p-8 rounded-3xl border border-gray-800 backdrop-blur-xl mb-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="text-3xl">🔄</span> Conversion History
                </h2>
                
                {isLoadingHistory ? (
                    <div className="py-10 text-center animate-pulse text-gray-500 italic text-sm">Loading conversion records...</div>
                ) : conversionHistory.length === 0 ? (
                    <div className="py-10 text-center text-gray-500 italic text-sm">No conversion history found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead>
                                <tr className="text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black italic">
                                    <th className="px-4 py-2">Date</th>
                                    <th className="px-4 py-2 text-right">Amount Converted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversionHistory.map((item, i) => (
                                    <tr key={i} className="bg-black/20 hover:bg-white/5 transition-all group rounded-xl">
                                        <td className="px-4 py-4 rounded-l-xl text-xs text-gray-400">
                                            {new Date(item.timestamp * 1000).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 rounded-r-xl text-right text-green-400 font-mono font-bold">
                                            +{formatUnits(item.amount, 18)} <span className="text-[10px] text-gray-500 font-normal">USDT</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tree Section */}
            <div className="bg-surface/50 p-8 rounded-2xl border border-gray-800 min-h-[400px]">
                <h2 className="text-2xl font-bold mb-6">Network Tree</h2>
                {isLoadingReferrals ? (
                    <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : directReferrals.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 italic">No partners found. Start inviting!</div>
                ) : (
                    <div className="space-y-1">
                        {directReferrals.map((ref, idx) => (
                            <ReferralTreeItem key={idx} address={ref} level={0} onShowDetails={(addr, lvl) => setSelectedUser({ address: addr, level: lvl })} />
                        ))}
                    </div>
                )}
            </div>

            {/* Multi-Level Info */}
            <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-gray-900/30 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold text-primary mb-4">Commission Structure</h3>
                    <div className="grid grid-cols-2 text-sm gap-2">
                        <p className="text-gray-500">Level 1</p><p className="text-right text-white font-bold">5%</p>
                        <p className="text-gray-500">Level 2</p><p className="text-right text-white font-bold">2%</p>
                        <p className="text-gray-500">Level 3-5</p><p className="text-right text-white font-bold">1%</p>
                        <p className="text-gray-500">Level 6-15</p><p className="text-right text-white font-bold">0.5%</p>
                    </div>
                </div>
                <div className="bg-gray-900/30 border border-gray-800 p-6 rounded-2xl flex flex-col justify-center">
                    <p className="text-sm text-gray-400 leading-relaxed italic">
                        * Commissions are calculated based on partner deposits. Income is instantly credited to your available balance once eligibility criteria are met.
                    </p>
                </div>
            </div>

            <AnimatePresence>
                {selectedUser && (
                    <UserDetailModal address={selectedUser.address} level={selectedUser.level} onClose={() => setSelectedUser(null)} />
                )}
            </AnimatePresence>
        </div>
    );
}