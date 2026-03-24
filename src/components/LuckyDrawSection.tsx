'use client';

import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { TRK_GAME_ADDRESS, TRK_ADDRESSES } from '../config';
import TRKGameABI from '../abis/TRKRouter.json';
import USDTABI from '../abis/USDT.json';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { parseAbiItem } from 'viem';
import { usePublicClient } from 'wagmi';
import { API_ENDPOINTS } from '../config/backend';
import { useEcosystemConfig } from './EcosystemConfig';

export default function LuckyDrawSection() {
    const config = useEcosystemConfig();
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [selectedDraw, setSelectedDraw] = useState<0 | 1 | null>(null); // DEFAULT: None
    const { data: userDataRouter } = useReadContract({
        address: TRK_ADDRESSES.ROUTER,
        abi: TRKGameABI.abi, 
        functionName: 'getUserInfo',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const luckyWallet = userDataRouter ? (userDataRouter as any).luckyDrawWallet ?? (userDataRouter as any[])?.[16] : BigInt(0);
    
    // Fetch Current IDs for status display
    const { data: drawStats } = useReadContract({
        address: TRK_ADDRESSES.ROUTER,
        abi: TRKGameABI.abi,
        functionName: 'getLuckyDrawStats',
        args: [1], // Golden
    });
    const { data: silverStats } = useReadContract({
        address: TRK_ADDRESSES.ROUTER,
        abi: TRKGameABI.abi,
        functionName: 'getLuckyDrawStats',
        args: [0], // Silver
    });

    const drawStatsObj = drawStats as any;
    const silverStatsObj = silverStats as any;

    const goldenId = drawStats ? Number(drawStatsObj?.drawId ?? drawStatsObj?.[0] ?? 0) : 0;
    const silverId = silverStats ? Number(silverStatsObj?.drawId ?? silverStatsObj?.[0] ?? 0) : 0;
    const goldenTicketsCurrent = drawStats ? Number(drawStatsObj?.ticketsSold ?? drawStatsObj?.[1] ?? 0) : 0;
    const silverTicketsCurrent = silverStats ? Number(silverStatsObj?.ticketsSold ?? silverStatsObj?.[1] ?? 0) : 0;

    const [ticketCount, setTicketCount] = useState('1');
    const [ticketLogs, setTicketLogs] = useState<any[]>([]);
    const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
    const [backendStats, setBackendStats] = useState({ totalTicketsSilver: 0, totalTicketsGolden: 0, silverPool: '0', goldenPool: '0' });
    const { writeContract, isPending: isTxPending, data: txHash, error: txError } = useWriteContract();

    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash: txHash,
    });

    const isProcessing = isTxPending || isConfirming;

    const fetchLogs = useCallback(async () => {
        if (!address) return;
        try {
            const res = await fetch(API_ENDPOINTS.GET_HISTORY(address));
            const data = await res.json();
            if (data.success) {
                setPurchaseHistory(data.luckyTickets.map((t: any) => ({
                    count: t.count,
                    drawId: t.drawId,
                    type: t.drawType === 1 ? 'GOLDEN' : 'SILVER',
                    block: 'Synced', // Backend stored
                    hash: t.hash,
                    timestamp: t.timestamp
                })));
            }

            // Also fetch global stats
            const statsRes = await fetch(API_ENDPOINTS.GET_LUCKY_STATS);
            const statsData = await statsRes.json();
            if (statsData.success) {
                // Also fetch distributions from backend for pools
                const distRes = await fetch(API_ENDPOINTS.GET_ADMIN_DISTRIBUTIONS);
                const distData = await distRes.json();
                
                setBackendStats({
                    ...statsData.stats,
                    goldenPool: distData.success ? distData.pools[2] : '0',
                    silverPool: distData.success ? distData.pools[3] : '0'
                });
            }
        } catch (e) {
            console.error("Backend fetch error:", e);
        }
    }, [address]);

    // Fetch Logs initially
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Pool data comes from Router/Contract
    const { data: pools } = useReadContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: 'getPools',
        query: { refetchInterval: 10000 }
    });

    const { data: userData, refetch: refetchUser } = useReadContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: 'getUserInfo',
        args: [address],
        query: { enabled: !!address }
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: TRK_ADDRESSES.USDT,
        abi: USDTABI.abi,
        functionName: 'allowance',
        args: [address, TRK_ADDRESSES.LUCKY_DRAW],
        query: { enabled: !!address }
    });

    const { data: usdtBalance, refetch: refetchUsdtBalance } = useReadContract({
        address: TRK_ADDRESSES.USDT,
        abi: USDTABI.abi,
        functionName: 'balanceOf',
        args: [address],
        query: { enabled: !!address }
    });

    const goldenWei = BigInt(backendStats.goldenPool || '0');
    const silverWei = BigInt(backendStats.silverPool || '0');

    const goldenUSDT = Number(formatUnits(goldenWei, 18));
    const silverUSDT = Number(formatUnits(silverWei, 18));

    const { userGoldenTicketsCurrent, userSilverTicketsCurrent } = useMemo(() => {
        const counts = purchaseHistory.reduce((acc, h) => {
            if (h.type === 'GOLDEN' && h.drawId === goldenId) acc.golden += Number(h.count || 0);
            if (h.type === 'SILVER' && h.drawId === silverId) acc.silver += Number(h.count || 0);
            return acc;
        }, { golden: 0, silver: 0 });

        return { userGoldenTicketsCurrent: counts.golden, userSilverTicketsCurrent: counts.silver };
    }, [purchaseHistory, goldenId, silverId]);

    const currentPref = (userData as any)?.preferredLuckyDraw ?? 0;

    const maxTickets = config?.lucky.maxTickets ? Number(config.lucky.maxTickets) : 10000;
    const goldenPrice = config?.lucky.goldenPrice ? Number(formatUnits(config.lucky.goldenPrice, 18)) : 10;
    const silverPrice = config?.lucky.silverPrice ? Number(formatUnits(config.lucky.silverPrice, 18)) : 1;

    const pricePerTicket = selectedDraw === 1 ? goldenPrice : silverPrice; // 1 is GOLDEN
    const totalCostWei = parseUnits((Number(ticketCount) * pricePerTicket).toString(), 18);
    const hasAllowance = (allowance as bigint || BigInt(0)) >= totalCostWei;
    const hasBalance = (usdtBalance as bigint || BigInt(0)) >= totalCostWei;
    
    // Debug logs
    useEffect(() => {
        if (selectedDraw !== null) {
            console.log("Draw Selection Info:", {
                selectedDraw,
                ticketCount,
                totalCostWei: totalCostWei.toString(),
                allowance: allowance?.toString(),
                balance: usdtBalance?.toString(),
                hasAllowance,
                hasBalance
            });
        }
    }, [selectedDraw, ticketCount, totalCostWei, allowance, usdtBalance, hasAllowance, hasBalance]);

    const [pendingTxType, setPendingTxType] = useState<'NONE' | 'APPROVE' | 'BUY'>('NONE');

    const handleBuy = async () => {
        if (selectedDraw === null || !hasBalance) return;
        
        if (!hasAllowance) {
            setPendingTxType('APPROVE');
            writeContract({
                address: TRK_ADDRESSES.USDT,
                abi: USDTABI.abi,
                functionName: 'approve',
                args: [TRK_ADDRESSES.LUCKY_DRAW, totalCostWei]
            });
            return;
        }

        setPendingTxType('BUY');
        writeContract({
            address: TRK_GAME_ADDRESS,
            abi: TRKGameABI.abi,
            functionName: 'buyLuckyTickets',
            args: [BigInt(ticketCount), selectedDraw]
        });
    };

    useEffect(() => {
        if (isSuccess && txHash && address) {
            if (pendingTxType === 'APPROVE') {
                refetchAllowance();
                setPendingTxType('NONE');
            } else if (pendingTxType === 'BUY') {
                // Sync to backend
                const syncToBackend = async () => {
                    try {
                        await fetch(API_ENDPOINTS.SYNC_LUCKY_BUY, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                address,
                                hash: txHash,
                                count: ticketCount,
                                drawId: selectedDraw === 1 ? goldenId : silverId,
                                drawType: selectedDraw,
                                timestamp: Math.floor(Date.now() / 1000)
                            })
                        });
                        
                        refetchAllowance();
                        refetchUsdtBalance();
                        refetchUser();
                        fetchLogs();
                        setPendingTxType('NONE');
                        setSelectedDraw(null); // Close modal on success
                    } catch (err) {
                        console.error("Failed to sync lucky buy:", err);
                    }
                };
                syncToBackend();
            }
        }
    }, [isSuccess, txHash, address, ticketCount, selectedDraw, goldenId, silverId, refetchAllowance, refetchUsdtBalance, refetchUser, fetchLogs, pendingTxType]);

    const handleSetPreference = (type: number) => {
        writeContract({
            address: TRK_GAME_ADDRESS,
            abi: TRKGameABI.abi,
            functionName: 'setLuckyDrawPreference',
            args: [type]
        });
    };

    return (
        <div className="space-y-6">
            {/* Auto-buy Preference Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 border border-white/10 rounded-3xl p-6 mb-2">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Auto-buy Preference</h3>
                    <p className="text-gray-500 text-xs">Your cashback & referral ROI automatically fuels your chosen draw.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex bg-black/40 border border-white/5 p-1.5 rounded-2xl w-full sm:w-auto">
                        <button 
                            onClick={() => handleSetPreference(1)}
                            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${currentPref === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            GOLDEN (${goldenPrice})
                        </button>
                        <button 
                            onClick={() => handleSetPreference(0)}
                            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${currentPref === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:text-white'}`}
                        >
                            SILVER (${silverPrice})
                        </button>
                    </div>

                    <div className="bg-black/40 border border-white/5 px-6 py-2.5 rounded-2xl flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                        <div className="flex flex-col">
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest leading-none mb-0.5">Lucky Reward Wallet</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-sm font-black text-pink-500">{Number(formatUnits(luckyWallet, 18)).toFixed(2)}</span>
                                <span className="text-[8px] font-bold text-gray-700 uppercase">USDT</span>
                            </div>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse shrink-0"></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Golden Lucky Draw */}
                <DrawCard 
                    title="Golden Lucky Draw"
                    poolAmount={goldenUSDT}
                    entryFee={goldenPrice.toString()}
                    ticketsSold={drawStats ? goldenTicketsCurrent : backendStats.totalTicketsGolden}
                    userTickets={userGoldenTicketsCurrent}
                    maxTickets={config?.lucky.maxTickets ? Number(config.lucky.maxTickets) : 10000}
                    gradient="from-yellow-900/40 to-orange-900/40"
                    accentColor="yellow-500"
                    prizeLimit={(maxTickets * goldenPrice * 0.7).toLocaleString()}
                    jackpot={(maxTickets * goldenPrice * 0.1).toLocaleString()}
                    onBuy={() => isConnected && setSelectedDraw(1)} // 1 = Golden
                />

                {/* Silver Lucky Draw */}
                <DrawCard 
                    title="Silver Lucky Draw"
                    poolAmount={silverUSDT}
                    entryFee={silverPrice.toString()}
                    ticketsSold={silverStats ? silverTicketsCurrent : backendStats.totalTicketsSilver}
                    userTickets={userSilverTicketsCurrent}
                    maxTickets={config?.lucky.maxTickets ? Number(config.lucky.maxTickets) : 10000}
                    gradient="from-blue-900/40 to-gray-900/40"
                    accentColor="blue-400"
                    prizeLimit={(maxTickets * silverPrice * 0.7).toLocaleString()}
                    jackpot={(maxTickets * silverPrice * 0.1).toLocaleString()}
                    onBuy={() => isConnected && setSelectedDraw(0)} // 0 = Silver
                />
            </div>

            {/* Purchase Modal */}
            <AnimatePresence>
                {selectedDraw !== null && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDraw(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative w-full max-w-sm bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl"
                        >
                            <h3 className="text-2xl font-black mb-1">Buy Lucky Tickets</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                {selectedDraw === 1 ? "🥇 Golden Tier" : "🥈 Silver Tier"} • ${selectedDraw === 1 ? goldenPrice : silverPrice} per ticket
                            </p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Quantity</label>
                                    <input 
                                        type="number"
                                        min="1"
                                        value={ticketCount}
                                        onChange={(e) => setTicketCount(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-xl font-mono text-center outline-none focus:border-yellow-500 transition-all"
                                    />
                                </div>

                                <div className="flex justify-between items-center py-2">
                                    <span className="text-gray-400">Total Price:</span>
                                    <span className="text-xl font-black text-white">
                                        ${(Number(ticketCount) * (selectedDraw === 1 ? goldenPrice : silverPrice)).toLocaleString()} USDT
                                    </span>
                                </div>

                                <button 
                                    onClick={handleBuy}
                                    disabled={isProcessing || !ticketCount || Number(ticketCount) < 1 || !hasBalance}
                                    className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 ${selectedDraw === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'} disabled:opacity-50`}
                                >
                                    {isProcessing ? "PROCESSING..." : 
                                     !hasBalance ? "INSUFFICIENT BALANCE" :
                                     !hasAllowance ? "APPROVE USDT" : "CONFIRM PURCHASE"}
                                </button>
                                
                                {txError && (
                                    <div className="text-red-500 text-[10px] text-center font-bold mt-2 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                        Error: {txError.message.includes("User rejected") ? "Transaction Rejected" : txError.message.slice(0, 50) + "..."}
                                    </div>
                                )}
                                
                                <button 
                                    onClick={() => setSelectedDraw(null)}
                                    className="w-full py-2 text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Explanatory Note */}
            <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-3xl mt-8">
                <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                    <span>ℹ️</span> Where does the balance go?
                </h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                    When you buy a ticket, the USDT is immediately transferred to the <span className="text-white font-bold">Treasury</span>. 
                    From there, it is split between the <span className="text-white">Prize Pool</span>, the <span className="text-white">Protection Pool</span>, and <span className="text-white">Ecosystem Rewards</span> (Creator, BD, Ops) as per the smart contract distribution logic.
                </p>
            </div>

            {/* Draw Results Table */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mt-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>🏆</span> Recent Draw Results
                </h3>
                <DrawResultsTable address={address} publicClient={publicClient} />
            </div>

            {/* Purchase History Table */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mt-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>📜</span> My Ticket History
                </h3>
                {purchaseHistory.length === 0 ? (
                    <div className="text-center py-10 text-gray-600 italic">No tickets purchased yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-gray-500 uppercase tracking-widest text-[10px] font-black italic border-b border-white/5">
                                    <th className="px-4 py-3">Draw Type</th>
                                    <th className="px-4 py-3">Draw ID</th>
                                    <th className="px-4 py-3">Tickets bought</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Block</th>
                                </tr>
                            </thead>
                            <tbody>
                                {purchaseHistory.map((h, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${h.type === 'GOLDEN' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {h.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-mono font-bold">#{h.drawId}</p>
                                            <a 
                                                href={`https://bscscan.com/tx/${h.hash}`} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="text-[8px] text-gray-600 hover:text-blue-500 font-mono transition-colors"
                                            >
                                                {h.hash?.slice(0, 8)}...{h.hash?.slice(-6)}
                                            </a>
                                        </td>
                                        <td className="px-4 py-4 font-bold">{h.count} 🎫</td>
                                        <td className="px-4 py-4">
                                            {((h.type === 'GOLDEN' && h.drawId < goldenId) || (h.type === 'SILVER' && h.drawId < silverId)) ? (
                                                <span className="text-[10px] font-black uppercase tracking-tighter text-green-500 bg-green-500/10 px-2 py-0.5 rounded">
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-tighter opacity-60 text-yellow-500">
                                                    In Progress
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-gray-500 font-mono">{h.block}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}


function DrawResultsTable({ address }: { address: any, publicClient: any }) {
    const [draws, setDraws] = useState<any[]>([]);

    useEffect(() => {
        const fetchDraws = async () => {
             try {
                const res = await fetch(API_ENDPOINTS.GET_DRAWS);
                const data = await res.json();
                if (data.success) {
                    setDraws(data.draws.map((d: any) => ({
                        drawId: d.drawId,
                        type: d.drawType === 1 ? 'GOLDEN' : 'SILVER',
                        jackpotWinner: d.jackpotWinner,
                        block: d.block
                    })));
                }
             } catch (e) {
                console.error("Draw fetch error:", e);
             }
        };
        fetchDraws();
    }, []);

    if (draws.length === 0) return <div className="text-center py-6 text-gray-600 italic text-sm">Waiting for first draw...</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="text-gray-500 uppercase tracking-widest text-[10px] font-black italic border-b border-white/5">
                        <th className="px-4 py-3">Draw</th>
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Jackpot Winner</th>
                        <th className="px-4 py-3 text-right">Block</th>
                    </tr>
                </thead>
                <tbody>
                    {draws.map((d, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-4 leading-none">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${d.type === 'GOLDEN' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {d.type}
                                </span>
                            </td>
                            <td className="px-4 py-4 font-mono font-bold">#{d.drawId}</td>
                            <td className="px-4 py-4">
                                <span className={`text-[10px] font-mono ${d.jackpotWinner === address ? 'text-green-400 font-bold underline' : 'text-gray-400'}`}>
                                    {d.jackpotWinner === address ? "YOU WON! 🏆" : `${d.jackpotWinner.slice(0,6)}...${d.jackpotWinner.slice(-4)}`}
                                </span>
                            </td>
                            <td className="px-4 py-4 text-right text-gray-600 font-mono text-[10px]">{d.block}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DrawCard({ title, poolAmount, entryFee, ticketsSold, userTickets = 0, maxTickets, gradient, accentColor, prizeLimit, jackpot, onBuy }: any) {
    const isGolden = title.includes("Golden");
    const maxT = Number(maxTickets) || 10000;
    const soldT = Number(ticketsSold) || 0;
    const progress = (soldT / maxT) * 100;
    
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className={`relative overflow-hidden bg-gradient-to-br ${gradient} border ${isGolden ? 'border-yellow-500/30' : 'border-blue-500/30'} rounded-3xl p-6 shadow-2xl group transition-all`}
        >
            <div className={`absolute top-0 right-0 w-32 h-32 ${isGolden ? 'bg-yellow-500/10' : 'bg-blue-500/10'} rounded-full blur-[60px] -z-10 group-hover:scale-150 transition-transform duration-500`}></div>
            
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>{isGolden ? "🥇" : "🥈"}</span> 
                        {title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] ${isGolden ? 'bg-yellow-500 text-black' : 'bg-blue-500 text-white'} px-2 py-0.5 rounded-full uppercase font-black tracking-wider`}>
                            {entryFee} USDT ENTRY
                        </span>
                        <span className="text-gray-500 text-[10px] font-bold">{maxT.toLocaleString()} TICKETS</span>
                    </div>
                </div>
                <div className="text-right whitespace-nowrap">
                    <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">POOL: ${prizeLimit}</span>
                </div>
            </div>

            <div className="mb-6">
                <p className={`text-[10px] ${isGolden ? 'text-yellow-500' : 'text-blue-400'} uppercase tracking-widest font-black mb-1 opacity-80`}>Current Jackpot</p>
                <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-black text-white tracking-tight leading-none">
                        ${poolAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-sm text-gray-500 font-bold">USDT</span>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Live Sales Progress</span>
                    <span className={`text-[10px] font-black ${isGolden ? 'text-yellow-500' : 'text-blue-400'}`}>{soldT.toLocaleString()} / {maxT.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center mb-2 text-[9px] uppercase tracking-widest">
                    <span className="text-gray-600">Your Tickets (Current Draw)</span>
                    <span className={isGolden ? 'text-yellow-500/80 font-black' : 'text-blue-400/80 font-black'}>{Number(userTickets).toLocaleString()}</span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full ${isGolden ? 'bg-yellow-500' : 'bg-blue-500'}`}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Top Prize</p>
                    <p className="text-white font-bold text-base">${jackpot}</p>
                </div>
                <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                    <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Win Chance</p>
                    <p className="text-white font-bold text-base">1 in {maxT.toLocaleString()}</p>
                </div>
            </div>

            <button 
                onClick={onBuy}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${isGolden ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/10' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/10'}`}
            >
                Buy Tickets
            </button>
            <p className="text-center text-[9px] text-gray-600 mt-3 font-medium italic">*Draws automatically at {maxT.toLocaleString()} tickets*</p>
        </motion.div>
    );
}