'use client';

import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import GameInterface from '../../components/GameInterface';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function GamePage() {
    const { isConnected } = useAccount();
    const router = useRouter();

    useEffect(() => {
        if (!isConnected) {
            const timer = setTimeout(() => router.push('/'), 100);
            return () => clearTimeout(timer);
        }
    }, [isConnected, router]);

    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-6">
                <div className="text-6xl mb-4">🎲</div>
                <h2 className="text-3xl font-bold">Wallet Connection Required</h2>
                <p className="text-gray-400 max-w-md">Connect your wallet to start playing and win up to 8X rewards!</p>
                <ConnectButton />
                <p className="text-sm text-gray-500">Redirecting to home page...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-center text-primary">TRK Game</h1>
            <GameInterface />
        </div>
    );
}
