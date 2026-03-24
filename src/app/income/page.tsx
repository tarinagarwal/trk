'use client';

import IncomeHistory from '../../components/IncomeHistory';

export default function IncomePage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-6xl">
            <h1 className="text-4xl font-bold mb-8 text-center text-primary">Income Dashboard</h1>

            <div className="mb-8 bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-2xl border border-primary/30">
                <h2 className="text-xl font-bold mb-2 text-white">Your Income Streams</h2>
                <p className="text-gray-300 text-sm">
                    Track all your earnings from winnings and referrals. Currently supporting 3 active income types.
                </p>
            </div>

            <IncomeHistory />
        </div>
    );
}
