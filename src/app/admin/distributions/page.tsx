'use client';

import { useState } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { TRK_GAME_ADDRESS } from '../../../config';
import TRKGameABI from '../../../abis/TRKRouter.json';
import { formatUnits } from 'viem';

export default function AdminDistributions() {
    const { address } = useAccount();
    const [offset, setOffset] = useState(0);
    const limit = 20;

    // Check if user is admin
    const { data: ownerAddress } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'owner',
    });

    const isAdmin = Boolean(
        ownerAddress &&
        address &&
        (ownerAddress as string).toLowerCase() === address.toLowerCase()
    );

    // Get distribution history
    const { data: distributions } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'getDistributionHistory',
        args: [BigInt(offset), BigInt(limit)],
        query: { enabled: isAdmin },
    });

    // Get total count
    const { data: totalCount } = useReadContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi,
        functionName: 'getDistributionHistoryCount',
        query: { enabled: isAdmin },
    });

    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h1>
                    <p className="text-gray-400">Admin access required</p>
                </div>
            </div>
        );
    }

    const distData = distributions as any[] | undefined;
    const total = totalCount as bigint | undefined;
    const totalPages = total ? Math.ceil(Number(total) / limit) : 0;
    const currentPage = Math.floor(offset / limit) + 1;

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    📜 Distribution History
                </h1>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                        <div className="text-sm text-gray-400 mb-1">Total Distributions</div>
                        <div className="text-3xl font-bold text-yellow-500">
                            {total ? total.toString() : '0'}
                        </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                        <div className="text-sm text-gray-400 mb-1">Current Page</div>
                        <div className="text-3xl font-bold text-white">
                            {currentPage} / {totalPages}
                        </div>
                    </div>
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                        <div className="text-sm text-gray-400 mb-1">Showing</div>
                        <div className="text-3xl font-bold text-white">
                            {distData?.length || 0} records
                        </div>
                    </div>
                </div>

                {/* Distribution Table */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 mb-8">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-left py-3 px-4 text-gray-400">Round ID</th>
                                    <th className="text-left py-3 px-4 text-gray-400">Winner</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Payout</th>
                                    <th className="text-center py-3 px-4 text-gray-400">Type</th>
                                    <th className="text-right py-3 px-4 text-gray-400">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {distData && distData.map((dist, idx) => (
                                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                                        <td className="py-3 px-4 font-mono text-sm">
                                            #{dist.roundId?.toString()}
                                        </td>
                                        <td className="py-3 px-4 font-mono text-sm">
                                            {dist.winner?.slice(0, 6)}...{dist.winner?.slice(-4)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-green-500">
                                            ${formatUnits(dist.payout || BigInt(0), 18)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${dist.isCashGame
                                                ? 'bg-yellow-500/20 text-yellow-500'
                                                : 'bg-blue-500/20 text-blue-500'
                                                }`}>
                                                {dist.isCashGame ? 'CASH' : 'PRACTICE'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-sm text-gray-400">
                                            {new Date(Number(dist.timestamp || BigInt(0)) * 1000).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {(!distData || distData.length === 0) && (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-gray-500">
                                            No distribution records found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="flex justify-center gap-4">
                    <button
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        disabled={offset === 0}
                        className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
                    >
                        ← Previous
                    </button>
                    <button
                        onClick={() => setOffset(offset + limit)}
                        disabled={!total || offset + limit >= Number(total)}
                        className="px-6 py-3 bg-gray-800 border border-gray-700 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-all"
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
}
