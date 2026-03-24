'use client';

export default function HowItWorksPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center text-primary">How It Works</h1>

            <div className="space-y-8">
                {/* Getting Started */}
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-6 text-white">Getting Started</h2>
                    <div className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-primary text-black rounded-full flex items-center justify-center font-bold">1</div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Connect Wallet</h3>
                                <p className="text-gray-400 text-sm">Connect MetaMask or Trust Wallet to BSC Mainnet</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-primary text-black rounded-full flex items-center justify-center font-bold">2</div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Register with TRK Code</h3>
                                <p className="text-gray-400 text-sm">Enter a referral code (e.g., TRK12345) or leave empty if you're admin</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-primary text-black rounded-full flex items-center justify-center font-bold">3</div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Get Your TRK Code</h3>
                                <p className="text-gray-400 text-sm">Receive your unique TRK code and $100 practice bonus</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-10 h-10 bg-primary text-black rounded-full flex items-center justify-center font-bold">4</div>
                            <div>
                                <h3 className="font-bold text-white mb-1">Start Playing</h3>
                                <p className="text-gray-400 text-sm">Play practice games or deposit $10+ for real cash games</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Game Mechanics */}
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Game Mechanics</h2>
                    <div className="space-y-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="font-bold text-primary mb-2">🎯 Prediction Game</h3>
                            <p className="text-gray-300 text-sm mb-2">Predict a number between 0-9. If you match the winning number, you win!</p>
                            <ul className="text-gray-400 text-sm space-y-1 ml-4">
                                <li>• Bet amount: Minimum 1 USDT</li>
                                <li>• Win multiplier: 2X cashout + 6X reinvest</li>
                                <li>• Daily limit: 24 practice + 24 cash games</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Income Streams */}
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Income Opportunities</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="font-bold text-primary mb-2">1. Direct Winnings</h3>
                            <p className="text-gray-400 text-sm">Win 2X your bet amount instantly</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="font-bold text-primary mb-2">2. Referral Income</h3>
                            <p className="text-gray-400 text-sm">Earn from 15 levels of referrals</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="font-bold text-primary mb-2">3. Winner Referrals</h3>
                            <p className="text-gray-400 text-sm">15% of your referrals' winnings</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="font-bold text-primary mb-2">4. Practice Rewards</h3>
                            <p className="text-gray-400 text-sm">Earn from referrals' practice games</p>
                        </div>
                    </div>
                </section>

                {/* Referral System */}
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">15-Level Referral System</h2>
                    <div className="bg-black/30 p-4 rounded-lg">
                        <p className="text-gray-300 mb-3">Earn commissions from 15 levels deep:</p>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="text-gray-400">Level 1: <span className="text-primary font-bold">5%</span></div>
                            <div className="text-gray-400">Level 2: <span className="text-primary font-bold">2%</span></div>
                            <div className="text-gray-400">Level 3-5: <span className="text-primary font-bold">1%</span></div>
                            <div className="text-gray-400">Level 6-15: <span className="text-primary font-bold">0.5%</span></div>
                        </div>
                        <p className="text-gray-500 text-xs mt-3">Total: 15% distributed across your network</p>
                    </div>
                </section>

                {/* Withdrawal */}
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Withdrawals</h2>
                    <ul className="space-y-2 text-gray-300">
                        <li className="flex items-start">
                            <span className="text-primary mr-2">•</span>
                            <span>Minimum withdrawal: 5 USDT</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">•</span>
                            <span>Maximum per day: 5000 USDT</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">•</span>
                            <span>Instant processing via smart contract</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">•</span>
                            <span>Referral minimum: 100 USDT cumulative</span>
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
