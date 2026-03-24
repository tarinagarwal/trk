'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { TRK_ADDRESSES } from '../config/contractAddresses';
import TRKRouterABI from '../abis/TRKRouter.json';
import { formatUnits } from 'viem';
import { API_ENDPOINTS } from '../config/backend';

export default function IncomeHistory() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [loading, setLoading] = useState(true);

    const { data: userData } = useReadContract({
        address: TRK_ADDRESSES.ROUTER,
        abi: TRKRouterABI.abi,
        functionName: 'getUserInfo',
        args: address ? [address] : undefined,
        query: {
            enabled: isConnected && !!address,
        }
    });

    const userObj = userData || {};
    const isRegistered = (userObj as any).isRegistered ?? (userData as any[])?.[27] ?? false;
    const formatBal = (val: any) => val ? Number(formatUnits(val, 18)).toFixed(2) : '0.00';

    const totalDeposit = (userObj as any).totalDeposit ?? (userData as any[])?.[6] ?? BigInt(0);
    const depositAmount = Number(formatUnits(totalDeposit, 18));
    
    const isFirst3Active = depositAmount >= 10;
    const isAllActive = depositAmount >= 100;

    // Parse User Data with Fallbacks (Named Struct vs Tuple Array)
    const dList = userData ? (userData as any) : null;

    const totalWinsBigInt = dList?.totalWins ?? (userData as any[])?.[23] ?? BigInt(0);
    const totalWins2xVal = totalWinsBigInt * BigInt(2) / BigInt(8);
    const totalWins6xVal = totalWinsBigInt * BigInt(6) / BigInt(8);
    
    const totalWins2x = formatBal(totalWins2xVal);
    const totalWins6x = formatBal(totalWins6xVal);

    // 2X Logic for Total Income calculation - SUM of ONLY WITHDRAWABLE amounts
    const withdrawableWins = (totalWinsBigInt ? totalWinsBigInt * BigInt(2) / BigInt(8) : BigInt(0));
    
    // Robust fallbacks for all income fields
    const directInc    = dList?.directReferralIncome ?? (userData as any[])?.[9] ?? BigInt(0);
    const winnerInc    = dList?.winnerReferralIncome ?? (userData as any[])?.[10] ?? BigInt(0);
    const cashbackI    = dList?.cashbackIncome ?? (userData as any[])?.[12] ?? BigInt(0);
    const lossRefI     = dList?.lossReferralIncome ?? (userData as any[])?.[13] ?? BigInt(0);
    const clubI        = dList?.clubIncome ?? (userData as any[])?.[14] ?? BigInt(0);
    
    const totalPracticeBalanceVal = (dList?.practiceBalance ?? BigInt(0));

    const directIncomeVal = dList?.directReferralIncome ?? (userData as any[])?.[9] ?? BigInt(0);
    const winnerIncomeVal = dList?.winnerReferralIncome ?? (userData as any[])?.[10] ?? BigInt(0);
    const practiceRevVal  = dList?.practiceReferralIncome ?? (userData as any[])?.[11] ?? BigInt(0);
    const cashbackIncVal  = dList?.cashbackIncome ?? (userData as any[])?.[12] ?? BigInt(0);
    const lossRefIncVal   = dList?.lossReferralIncome ?? (userData as any[])?.[13] ?? BigInt(0);
    const clubIncVal      = dList?.clubIncome ?? (userData as any[])?.[14] ?? BigInt(0);

    const directIncome = formatBal(directIncomeVal);
    const winnerIncome = formatBal(winnerIncomeVal);
    const practiceRev = formatBal(practiceRevVal);
    const cashbackInc = formatBal(cashbackIncVal);
    const lossRefInc = formatBal(lossRefIncVal);
    const clubInc = formatBal(clubIncVal);

    const StatusBadge = ({ active }: { active: boolean }) => (
        <span className={`ml-3 px-2 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase ${active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
            {active ? '● Active' : '○ Inactive'}
        </span>
    );

    const [incomeLogs, setIncomeLogs] = useState<any[]>([]);
    const [pWinTotal, setPWinTotal] = useState('0.00');
    const [pTeamTotal, setPTeamTotal] = useState('0.00');
    const [pNetworkWinTotal, setPNetworkWinTotal] = useState('0.00');
    const [pConversionTotal, setPConversionTotal] = useState('0.00');
    const [luckyPrizeTotal, setLuckyPrizeTotal] = useState<bigint>(BigInt(0));

    const totalRealIncomeVal = withdrawableWins + directInc + winnerInc + cashbackI + lossRefI + clubI + luckyPrizeTotal;
    const luckyPrizeDisplay = formatBal(luckyPrizeTotal);

    useEffect(() => {
        if (!address || !publicClient) return;
        
        const fetchIncomeLogs = async () => {
            try {
                // Fetch from Backend (Primary Source)
                const res = await fetch(API_ENDPOINTS.GET_HISTORY(address as string));
                const data = await res.json();
                
                let combined: any[] = [];
                let pw = BigInt(0);
                let pt = BigInt(0);
                let pn = BigInt(0);
                let convTotal = BigInt(0);

                if (data.success) {
                    const practiceWinTxHashes = new Set<string>();
                    const practiceWinLogs: any[] = [];

                    // Add signup bonus as first entry if registered
                    if (data.registration) {
                        combined.push({
                            amount: BigInt('100000000000000000000'), // 100 USDT (18 decimals)
                            source: 'Registration Bonus',
                            wallet: 'Practice',
                            timestamp: data.registration.timestamp || 0,
                            txHash: data.registration.hash
                        });
                    }

                    // Practice winner profit should come from GameWon history (isCash = false)
                    for (const w of (data.winnings || [])) {
                        if (!w?.isCash) {
                            const amt = BigInt(w.amount || '0');
                            pw += amt;
                            practiceWinTxHashes.add(String(w.hash || '').toLowerCase());
                            practiceWinLogs.push({
                                amount: amt,
                                source: 'Practice Game Win',
                                wallet: 'Practice',
                                timestamp: Number(w.timestamp) || 0,
                                txHash: w.hash
                            });
                        }
                    }

                    const luckyPrizeOnly = (data.incomes || []).reduce((acc: bigint, it: any) => {
                        const src = String(it?.source || '').toLowerCase();
                        if (src.includes('lucky') && src.includes('prize')) {
                            return acc + BigInt(it.amount || '0');
                        }
                        return acc;
                    }, BigInt(0));
                    setLuckyPrizeTotal(luckyPrizeOnly);

                    // 1. Process Incomes (Real Cash & Practice Game/Ref)
                    combined = [
                        ...practiceWinLogs,
                        ...data.incomes.map((it: any) => {
                            const amt = BigInt(it.amount);
                            const src = it.source;
                            const srcLower = String(src || '').toLowerCase();
                            
                            // Skip "Practice Referral" from IncomeReceived because it's redundant with PracticeRewardReceived
                            if (src === 'Practice Referral') return null;

                            // Practice Game Win is sourced from winnings table to avoid missing/duplicated accounting
                            if (srcLower.includes('practice') && srcLower.includes('win')) {
                                const hashKey = String(it.hash || '').toLowerCase();
                                if (practiceWinTxHashes.has(hashKey)) return null;
                                pw += amt;
                            }

                            if (srcLower.includes('practice') && srcLower.includes('referral')) pn += amt;
                            else if (srcLower.includes('practice') && srcLower.includes('team')) pn += amt;

                            return {
                                amount: amt,
                                source: src,
                                wallet: it.walletType,
                                timestamp: it.timestamp,
                                txHash: it.hash
                            };
                        }).filter(Boolean),
                        // 2. Process Practice Rewards (Registration tiers)
                        ...(data.rewards || []).map((it: any) => {
                            const amt = BigInt(it.amount);
                            pt += amt;
                            return {
                                amount: amt,
                                source: `Practice Reward (L${Number(it.level)})`,
                                wallet: 'Practice',
                                timestamp: it.timestamp,
                                isPractice: true,
                                txHash: it.hash
                            };
                        })
                    ];

                    convTotal = data.conversions?.reduce((acc: bigint, it: any) => acc + BigInt(it.amount), BigInt(0)) || BigInt(0);
                } else {
                    setLuckyPrizeTotal(BigInt(0));
                }

                setIncomeLogs(combined.sort((a, b) => b.timestamp - a.timestamp));
                setPWinTotal(formatBal(pw));
                
                const totalTeamEarningsVal = (pt + pn) > BigInt(0) ? (pt + pn) : practiceRevVal;
                setPTeamTotal(formatBal(totalTeamEarningsVal));
                setPNetworkWinTotal(formatBal(pn));
                setPConversionTotal(formatBal(convTotal));
            } catch (e) {
                console.error("Error fetching income logs:", e);
            } finally {
                setLoading(false);
            }
        };
        
        fetchIncomeLogs();
        const interval = setInterval(fetchIncomeLogs, 10000);
        return () => clearInterval(interval);
    }, [address]);

    if (!isConnected) return <div className="text-center py-8 text-gray-400">Connect wallet to view income history</div>;
    if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-primary italic uppercase tracking-tighter">� Revenue Overview</h2>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">7 Cash Sources + Unlimited Practice Rewards</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Current Deposit</p>
                    <p className="text-xl font-mono font-bold text-white">${depositAmount.toFixed(2)}</p>
                </div>
            </div>

            {/* TOTAL REAL CASH SUMMARY */}
            <div className="bg-gradient-to-r from-green-600/20 to-green-900/20 border border-green-500/30 p-6 rounded-3xl mb-8">
                <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.2em] mb-1">Total Web-Earned Available Balance</p>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                   ${formatBal(totalRealIncomeVal)} <span className="text-sm not-italic opacity-50 font-bold">USDT</span>
                </h2>
                <p className="text-[9px] text-gray-500 font-bold mt-2 uppercase">Includes 2X Game Wins + All Cash Referral & Pool Bonuses</p>
            </div>

            <div className="space-y-6">
                <h3 className="text-lg font-black text-yellow-500 flex items-center gap-2 italic uppercase tracking-tighter">
                    <span className="bg-yellow-500/10 px-2 py-1 rounded-lg">💰</span> Real Cash Income Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. Cash Game Winner */}
                    <div className={`p-5 rounded-3xl border transition-all ${isFirst3Active ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">1. Cash Game Winner</span>
                            <StatusBadge active={isFirst3Active} />
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-4xl font-black text-green-400 tracking-tighter">
                                        {totalWins2x}
                                    </p>
                                    <span className="bg-green-500/10 text-green-400 text-[10px] font-black px-2 py-0.5 rounded uppercase border border-green-500/20">
                                        2X Wallet
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Added to Total Balance</p>
                            </div>

                            <div className="pt-3 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white/40">{totalWins6x}</span>
                                    <span className="text-[9px] text-white/20 font-black uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                                        6X Re-Invested
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Direct Referral */}
                    <div className={`p-5 rounded-3xl border transition-all ${isFirst3Active ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">2. Direct Referral</span>
                            <StatusBadge active={isFirst3Active} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-yellow-400">{directIncome}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-3 italic tracking-tight">Earn when direct team deposits</p>
                    </div>

                    {/* 3. Team Win Bonus */}
                    <div className={`p-5 rounded-3xl border transition-all ${isFirst3Active ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">3. Team Win Bonus</span>
                            <StatusBadge active={isFirst3Active} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-green-400">{winnerIncome}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-3 italic tracking-tight">From your network's winnings</p>
                    </div>

                    {/* 4. Daily Cashback */}
                    <div className={`p-5 rounded-3xl border transition-all ${isAllActive ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">4. Daily Cashback</span>
                            <StatusBadge active={isAllActive} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-blue-400">{cashbackInc}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                    </div>

                    {/* 5. Team Cashback ROI */}
                    <div className={`p-5 rounded-3xl border transition-all ${isAllActive ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">5. Team Cashback ROI</span>
                            <StatusBadge active={isAllActive} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-purple-400">{lossRefInc}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                    </div>

                    {/* 6. Club Pool Share */}
                    <div className={`p-5 rounded-3xl border transition-all ${isAllActive ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">6. Club Pool Share</span>
                            <StatusBadge active={isAllActive} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-orange-400">{clubInc}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                    </div>

                    {/* 7. Lucky Draw Prize */}
                    <div className={`p-5 rounded-3xl border transition-all ${isAllActive ? 'bg-surface border-gray-800' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">7. Lucky Draw Prize</span>
                            <StatusBadge active={isAllActive} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-pink-500">{luckyPrizeDisplay}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* TOTAL PRACTICE SUMMARY */}
            <div className="bg-gradient-to-r from-blue-600/20 to-blue-900/20 border border-blue-500/30 p-6 rounded-3xl mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="text-6xl">🎮</span>
                </div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Total Practice Portfolio</p>
                <div className="flex items-baseline gap-3">
                    <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">
                       ${formatBal(totalPracticeBalanceVal)} 
                    </h2>
                    <span className="text-sm not-italic opacity-50 font-bold text-blue-300">USDT</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-[9px] text-gray-400 font-bold uppercase tracking-tight">
                    <div className="bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                        Initial Bonus: $100.00
                    </div>
                    <div className="bg-green-500/10 px-2 py-1 rounded border border-green-500/20 text-green-400">
                        Total Earnings (Wins + Team): ${formatBal(BigInt(Math.floor(Number(pWinTotal.replace(/,/g, '')) * 1e18)) + BigInt(Math.floor(Number(pTeamTotal.replace(/,/g, '')) * 1e18)))}
                    </div>
                </div>
                <p className="text-[8px] text-gray-500 font-bold mt-4 uppercase tracking-tighter opacity-60">Demo balance for education and referral tier activation</p>
            </div>

            <div className="space-y-6 pt-4">
                <h3 className="text-lg font-black text-blue-400 flex items-center gap-2 italic uppercase tracking-tighter">
                    <span className="bg-blue-500/10 px-2 py-1 rounded-lg">🎮</span> Practice Income Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. Practice Game Winner */}
                    <div className="p-5 rounded-3xl border bg-blue-500/5 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">1. Practice Game Winner</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                ● Always Active
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-blue-400">{pWinTotal}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex flex-col">
                                <span className="text-[8px] text-gray-500 font-black uppercase tracking-tighter">8X Total Pay</span>
                                <span className="text-xs font-bold text-white">${pWinTotal}</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Practice Team Reward */}
                    <div className="p-5 rounded-3xl border bg-blue-500/5 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">2. Practice Team Reward</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                ● Always Active
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-blue-400">{pTeamTotal}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-3 italic tracking-tight">Earned from direct team registrations</p>
                    </div>

                    {/* 3. Conversion to Cash */}
                    <div className="p-5 rounded-3xl border bg-orange-500/5 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">3. Total Conversion to Cash</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-tighter uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                History
                            </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-black text-orange-400">-{pConversionTotal}</p>
                            <span className="text-[10px] text-gray-500 font-bold uppercase">USDT</span>
                        </div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase mt-3 italic tracking-tight">Practice converted to real balance after deposit</p>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="mt-12 bg-[#0A0A0A] rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="p-8 border-b border-white/5">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">📜 Detailed Income History</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Full breakdown of all earnings and rewards.</p>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02] text-gray-600 text-[10px] uppercase tracking-widest font-black italic">
                            <tr>
                                <th className="px-8 py-4">Date</th>
                                <th className="px-8 py-4">Source</th>
                                <th className="px-8 py-4">Wallet</th>
                                <th className="text-right px-8 py-4">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {incomeLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center text-gray-600 italic">
                                        No income records found yet. Keep playing to earn!
                                    </td>
                                </tr>
                            ) : (
                                incomeLogs.map((log, i) => {
                                    const isCashWin = log.source === 'Cash Game Win';
                                    const amount = Number(formatUnits(log.amount, 18));
                                    
                                    return (
                                        <tr key={i} className="hover:bg-white/[0.01] transition-colors group">
                                            <td className="px-8 py-6 text-sm">
                                                <span className="text-white font-mono">{log.timestamp > 0 ? new Date(log.timestamp * 1000).toLocaleDateString() : 'Recent'}</span>
                                                <span className="block text-[10px] text-gray-600 mt-1 font-bold">
                                                    {log.timestamp > 0 ? new Date(log.timestamp * 1000).toLocaleTimeString() : 'Blockchain Event'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                                    log.source === 'Registration Bonus' ? 'bg-purple-500/10 text-purple-400' :
                                                    log.source.includes('Winner') ? 'bg-green-500/10 text-green-400' :
                                                    log.source.includes('Direct') ? 'bg-yellow-500/10 text-yellow-400' :
                                                    (log.source.includes('Practice') || log.source.includes('Demo')) ? 'bg-blue-500/10 text-blue-400' :
                                                    log.source.includes('Cashback') ? 'bg-blue-500/10 text-blue-400' :
                                                    log.source.includes('Lucky') ? 'bg-pink-500/10 text-pink-400' :
                                                    'bg-white/10 text-white'
                                                }`}>
                                                    {log.source === 'Registration Bonus' ? '🎁 Registration Bonus' :
                                                    log.source === 'Cash Game Win' ? '🎰 Cash Game Win' :
                                                    log.source === 'Winner Referral' ? '🤝 Team Win Bonus' :
                                                    log.source === 'Direct Referral' ? '👥 Direct Deposit ROI' :
                                                    log.source === 'Practice Game Referral' ? '🎮 Demo Team Bonus' :
                                                    log.source === 'Loss Referral' ? '🛡️ Team Cashback ROI' :
                                                    log.source.includes('Daily') || log.source === 'Daily Cashback' ? '📅 Daily Cashback' :
                                                    log.source === 'Club Income' ? '🏢 Club Pool Share' :
                                                    log.source.includes('Lucky') ? '🎟️ Lucky Draw Prize' :
                                                    log.source}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{log.wallet}</div>
                                                {isCashWin && (
                                                    <div className="flex gap-2 text-[9px] font-black uppercase mt-1.5 opacity-60">
                                                        <span className="text-green-500/80">Wallet 2X</span>
                                                        <span className="text-blue-500/80">6X Reinvest</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <span className="text-lg font-black text-green-400">
                                                    +{amount.toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-gray-600 ml-1 font-bold uppercase">USDT</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
