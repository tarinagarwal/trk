'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { TRK_GAME_ADDRESS } from '../config';
import TRKGameABI from '../abis/TRKRouter.json';

// --- CONFIGURATION ---
const COMMISSION_RATES = [5, 2, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]; // L1 to L15

// --- RECURSIVE TREE ITEM ---
function ReferralTreeItem({ 
    address, 
    level, 
    onShowDetails 
}: { 
    address: string, 
    level: number, 
    onShowDetails: (addr: string, lvl: number) => void 
}) {
    const publicClient = usePublicClient();
    const [isExpanded, setIsExpanded] = useState(false);
    const [children, setChildren] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [childCount, setChildCount] = useState<number>(0);
    const [hasLoadedCount, setHasLoadedCount] = useState(false);

    // Fetch child count (direct referrals of this user)
    useEffect(() => {
        let isMounted = true;
        async function fetchCount() {
            if (!publicClient || hasLoadedCount) return;
            try {
                const data = await publicClient.readContract({
                    address: TRK_GAME_ADDRESS as `0x${string}`,
                    abi: TRKGameABI.abi,
                    functionName: 'getUserInfo',
                    args: [address as `0x${string}`]
                }) as any[];

                if (isMounted) {
                    const userObj = data as any || {};
                    const count = userObj.directReferrals ? Number(userObj.directReferrals) : (userObj[31] ? Number(userObj[31]) : 0);
                    setChildCount(count);
                    setHasLoadedCount(true);
                }
            } catch (err) {
                console.error("Error fetching count for", address, err);
            }
        }
        fetchCount();
        return () => { isMounted = false; };
    }, [address, publicClient, hasLoadedCount]);

    // Fetch children on expand
    const handleExpand = async () => {
        if (isExpanded) {
            setIsExpanded(false);
            return;
        }

        setIsExpanded(true);
        if (children.length > 0 || childCount === 0) return;

        setLoading(true);
        try {
            const limit = Math.min(childCount, 50);
            const promises = [];
            for (let i = 0; i < limit; i++) {
                promises.push(
                    publicClient!.readContract({
                        address: TRK_GAME_ADDRESS as `0x${string}`,
                        abi: TRKGameABI.abi,
                        functionName: 'directReferralsList',
                        args: [address as `0x${string}`, BigInt(i)]
                    })
                );
            }
            const results = await Promise.all(promises);
            setChildren(results as string[]);
        } catch (err) {
            console.error("Error fetching children for", address, err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-2 relative">
            {/* Connector Line for nested items */}
            {level > 0 && (
                <div className="absolute left-[-24px] top-0 bottom-0 w-px bg-gray-800" />
            )}
            {level > 0 && (
                <div className="absolute left-[-24px] top-6 w-6 h-px bg-gray-800" />
            )}

            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                    p-3 rounded-xl border flex justify-between items-center transition-all group
                    ${level === 0 ? 'bg-black/40 border-gray-700' : 'bg-gray-900/30 border-gray-800'}
                    ${childCount > 0 ? 'cursor-pointer hover:border-gray-600' : ''}
                `}
                onClick={childCount > 0 ? handleExpand : undefined}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`
                        shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border
                        ${level === 0 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}
                    `}>
                        L{level + 1}
                    </div>
                    
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-mono text-gray-200 text-sm truncate">
                                {address.slice(0, 6)}...{address.slice(-4)}
                            </p>
                        </div>
                        {hasLoadedCount && (
                            <p className="text-[10px] text-gray-500">
                                Sponsoring: <span className="text-gray-300 font-bold">{childCount}</span> users
                            </p>
                        )}
                    </div>
                </div>

                {/* --- ACTION BUTTONS --- */}
                <div className="flex items-center gap-2 shrink-0">
                    
                    {/* INFO BUTTON (New) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent Expand
                            onShowDetails(address, level);
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-blue-600 hover:text-white text-gray-400 transition-colors border border-gray-700 hover:border-blue-500 z-20 relative"
                        title="View Transparency Data"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>

                    {/* EXPAND TOGGLE */}
                    {childCount > 0 && (
                        <div className={`w-8 h-8 flex items-center justify-center text-gray-500 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Nested Children */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-8 overflow-hidden"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2 p-4 text-xs text-gray-500">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                                Loading downline...
                            </div>
                        ) : (
                            children.map((childAddr, idx) => (
                                <ReferralTreeItem 
                                    key={idx} 
                                    address={childAddr} 
                                    level={level + 1} 
                                    onShowDetails={onShowDetails} // Pass prop down recursively
                                />
                            ))
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- MAIN REFERRAL PAGE COMPONENT ---
export default function ReferralPage() {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [referralCode, setReferralCode] = useState('');
    const [directReferrals, setDirectReferrals] = useState<string[]>([]);
    const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
    
    // Modal State
    const [selectedUser, setSelectedUser] = useState<{ address: string; level: number } | null>(null);

    // Get user info
    const { data: userData } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'getUserInfo',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address }
    });

    const userObj = (userData as any) || {};
    const isRegistered = userObj.isRegistered ?? userObj[28] ?? false;
    const directReferralCount = userObj.directReferrals ? Number(userObj.directReferrals) : (userObj[31] ? Number(userObj[31]) : 0);
    const cumulativeDeposit = userObj.cumulativeDeposit ?? (userObj[8] ? userObj[8] : BigInt(0));
    const minReferralPayout = BigInt(100 * 10 ** 18);
    const isEligibleForCommissions = cumulativeDeposit >= minReferralPayout;

    // Get Referral Code
    const { data: userRefCode } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'addressToReferralCode',
        args: address ? [address] : undefined,
        query: { enabled: isConnected && !!address && isRegistered }
    });

    useEffect(() => {
        if (userRefCode) setReferralCode(userRefCode as string);
    }, [userRefCode]);

    // Fetch Level 1 referrals
    useEffect(() => {
        async function fetchReferralsByIndex() {
            if (!publicClient || !address || !directReferralCount) {
                setDirectReferrals([]);
                return;
            }

            setIsLoadingReferrals(true);
            try {
                const limit = Math.min(directReferralCount, 50); 
                const promises = [];
                for (let i = 0; i < limit; i++) {
                    promises.push(
                        publicClient.readContract({
                            address: TRK_GAME_ADDRESS as `0x${string}`,
                            abi: TRKGameABI.abi,
                            functionName: 'directReferralsList',
                            args: [address, BigInt(i)]
                        })
                    );
                }
                const results = await Promise.all(promises);
                setDirectReferrals(results as string[]);
            } catch (error) {
                console.error('Error fetching referrals:', error);
            } finally {
                setIsLoadingReferrals(false);
            }
        }
        fetchReferralsByIndex();
    }, [publicClient, address, directReferralCount]);

    const copyToClipboard = () => {
        if (referralCode) {
            navigator.clipboard.writeText(referralCode);
            alert('Referral code copied!');
        }
    };

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?ref=${referralCode}` : '';

    if (!isConnected) return <div className="p-8 text-center text-gray-500">Connect wallet to view referral details.</div>;
    if (!isRegistered) return <div className="p-8 text-center text-gray-500">Register to get your referral code.</div>;

    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-500">
                💰 Referral Program
            </h1>

            {/* Warning */}
            {!isEligibleForCommissions && (
                <div className="bg-blue-500/10 border border-blue-500/50 p-4 rounded-xl mb-8 text-center">
                    <p className="text-blue-400 font-bold mb-2">ℹ️ Practice Earning Mode</p>
                    <p className="text-sm text-gray-300">
                        Deposit 100 USDT to start earning Real USDT Commissions!
                    </p>
                </div>
            )}

            {/* Code Card */}
            <div className="bg-gray-900/50 p-8 rounded-2xl border border-gray-800 mb-8 backdrop-blur-sm">
                <h2 className="text-2xl font-bold mb-4 text-white">Your Referral Code</h2>
                <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
                    <div className="flex-1 w-full bg-black/50 border border-gray-700 rounded-xl p-4">
                        <p className="text-3xl font-mono font-bold text-yellow-400 text-center">
                            {referralCode || 'Loading...'}
                        </p>
                    </div>
                    <button onClick={copyToClipboard} className="w-full md:w-auto px-8 py-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition-all shadow-lg">
                        📋 Copy Code
                    </button>
                </div>
                <p className="text-xs text-gray-500 font-mono break-all bg-black/30 p-2 rounded">{shareUrl}</p>
            </div>

            {/* Referrals Tree View */}
            <div className="bg-gray-900/50 p-6 md:p-8 rounded-2xl border border-gray-800">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Your Team Hierarchy</h2>
                        <p className="text-gray-400 text-sm">Click <span className="inline-block bg-gray-800 p-1 rounded">👁️</span> to view transparency data.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-bold text-white">{Number(directReferralCount)}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold">Direct Referrals</p>
                    </div>
                </div>

                {isLoadingReferrals ? (
                    <div className="text-center py-12">
                        <div className="animate-spin text-4xl mb-2">↻</div>
                        <p className="text-gray-400">Loading referral list...</p>
                    </div>
                ) : directReferrals.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
                        <p className="text-gray-500">No referrals yet. Share your code!</p>
                    </div>
                ) : (
                    <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {directReferrals.map((refAddress, idx) => (
                            <ReferralTreeItem 
                                key={idx} 
                                address={refAddress} 
                                level={0} 
                                onShowDetails={(addr, lvl) => setSelectedUser({ address: addr, level: lvl })}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <UserDetailModal 
                        address={selectedUser.address} 
                        level={selectedUser.level} 
                        onClose={() => setSelectedUser(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// --- USER DETAIL MODAL ---
function UserDetailModal({ address, level, onClose }: { address: string; level: number; onClose: () => void }) {
    const { data: userData, isLoading } = useReadContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: 'getUserInfo',
        args: [address],
    });

    const user = userData ? (userData as any) : null;
    const cumulativeDeposit = user?.cumulativeDeposit ?? (user?.[8] ?? BigInt(0));
    const totalVolume = user ? Number(formatUnits(cumulativeDeposit, 18)) : 0;
    const rate = COMMISSION_RATES[level] || 0;
    const earned = (totalVolume * rate) / 100;

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.9, y: 20 }} 
                className="bg-[#121212] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 border-b border-gray-700 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Partner Transparency</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-6">
                    {isLoading || !user ? (
                        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg border border-gray-800">
                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xl">👤</div>
                                <div>
                                    <p className="text-xs text-gray-500">Wallet Address</p>
                                    <p className="text-sm font-mono text-white break-all">{address}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Total Volume</p>
                                    <p className="text-lg font-bold text-white">{totalVolume.toFixed(2)} USDT</p>
                                </div>
                                <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">User ID</p>
                                    <p className="text-lg font-bold text-white">#{user?.userId?.toString() ?? user?.[0]?.toString()}</p>
                                </div>
                            </div>

                            <div className="bg-blue-900/10 border border-blue-500/30 rounded-xl p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-blue-200">Commission Rate (L{level + 1})</span>
                                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded font-bold">{rate}%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-400">Total Earned</span>
                                    <span className="text-xl font-bold text-green-400">+{earned.toFixed(4)} USDT</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}