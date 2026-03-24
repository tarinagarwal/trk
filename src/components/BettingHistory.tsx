'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { TRK_GAME_ADDRESS } from '../config';
import TRKGameABI from '../abis/TRKRouter.json';
import { formatUnits } from 'viem';

interface BetHistoryProps {
    isPractice?: boolean;
    maxItems?: number;
}

export default function BettingHistory({ isPractice = true, maxItems = 20 }: BetHistoryProps) {
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const [bets, setBets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadBets() {
            if (!publicClient || !address || !isConnected) {
                setLoading(false); 
                return;
            }

            try {
                const betEvent = (TRKGameABI.abi as any[]).find(
                    (e) => e.type === 'event' && e.name === 'BetPlaced'
                );

                if (!betEvent) {
                    setLoading(false);
                    return;
                }

                // Get current block
                const currentBlock = await publicClient.getBlockNumber();
                const fromBlock = currentBlock > BigInt(9900) ? currentBlock - BigInt(9900) : BigInt(0);

                const logs = await publicClient.getLogs({
                    address: TRK_GAME_ADDRESS as `0x${string}`,
                    event: betEvent as any,
                    args: { player: address },
                    fromBlock: fromBlock,
                    toBlock: 'latest'
                });

                // Filter by practice/cash and get latest
                const filtered = logs
                    .filter((log: any) => {
                        const args = log.args as any;
                        return args && args.isCash === !isPractice;
                    })
                    .slice(-maxItems)
                    .reverse();

                setBets(filtered);
            } catch (err) {
                console.error('Failed to load bet history:', err);
            } finally {
                setLoading(false);
            }
        }

        loadBets();
    }, [publicClient, address, isConnected, isPractice, maxItems]);

    if (!isConnected) {
        return (
            <div className="text-center text-gray-500 py-4">
                Connect wallet to view betting history
            </div>
        );
    }

    if (loading) {
        return (
            <div className="text-center text-gray-400 py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                Loading bet history...
            </div>
        );
    }

    if (bets.length === 0) {
        return (
            <div className="text-center text-gray-500 py-4">
                No {isPractice ? 'practice' : 'cash'} bets placed yet
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase border-b border-gray-800">
                    <tr>
                        <th className="p-3 text-left">Round ID</th>
                        <th className="p-3 text-left">Amount</th>
                        <th className="p-3 text-left">Prediction</th>
                        <th className="p-3 text-left">Type</th>
                    </tr>
                </thead>
                <tbody>
                    {bets.map((log, idx) => {
                        const args = log.args as any;
                        if (!args) return null;

                        return (
                            <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                                <td className="p-3 text-gray-300 font-mono">
                                    #{args.roundId?.toString() || 'N/A'}
                                </td>
                                <td className="p-3 text-green-400 font-mono font-bold">
                                    {formatUnits(args.amount || BigInt(0), 18)} USDT
                                </td>
                                <td className="p-3 text-primary font-bold text-lg">
                                    {args.prediction?.toString() || '-'}
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${args.isCash
                                            ? 'bg-yellow-500/20 text-yellow-400'
                                            : 'bg-blue-500/20 text-blue-400'
                                        }`}>
                                        {args.isCash ? 'CASH' : 'PRACTICE'}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="mt-4 text-center text-xs text-gray-500">
                Showing last {bets.length} {isPractice ? 'practice' : 'cash'} bets
            </div>
        </div>
    );
}
