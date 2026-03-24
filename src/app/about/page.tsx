'use client';

export default function AboutPage() {
    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center text-primary">About TRK Game</h1>

            <div className="space-y-8">
                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">What is TRK Game?</h2>
                    <p className="text-gray-300 leading-relaxed">
                        TRK Game is a revolutionary blockchain-based gaming platform built on Binance Smart Chain (BSC).
                        We combine the excitement of prediction games with a powerful 15-level referral system,
                        creating opportunities for both entertainment and income generation.
                    </p>
                </section>

                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Our Mission</h2>
                    <p className="text-gray-300 leading-relaxed">
                        To create a transparent, fair, and rewarding gaming ecosystem where players can enjoy
                        skill-based games while building sustainable income through our comprehensive referral network.
                    </p>
                </section>

                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Key Features</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-primary mb-2">🎮 Dual Game Modes</h3>
                            <p className="text-gray-400 text-sm">Practice with $100 bonus or play with real USDT</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-primary mb-2">🔗 TRK Referral Codes</h3>
                            <p className="text-gray-400 text-sm">Easy-to-share codes like TRK12345</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-primary mb-2">💰 15-Level Rewards</h3>
                            <p className="text-gray-400 text-sm">Earn from 15 levels of referrals</p>
                        </div>
                        <div className="bg-black/30 p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-primary mb-2">⚡ Instant Payouts</h3>
                            <p className="text-gray-400 text-sm">2X cashout for winners, automatic distribution</p>
                        </div>
                    </div>
                </section>

                <section className="bg-surface/50 p-6 rounded-2xl border border-gray-800">
                    <h2 className="text-2xl font-bold mb-4 text-white">Why Choose TRK Game?</h2>
                    <ul className="space-y-3 text-gray-300">
                        <li className="flex items-start">
                            <span className="text-primary mr-2">✓</span>
                            <span><strong>Transparent:</strong> All transactions on blockchain, fully verifiable</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">✓</span>
                            <span><strong>Fair:</strong> Smart contract-based, no manipulation possible</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">✓</span>
                            <span><strong>Rewarding:</strong> Multiple income streams from referrals and winnings</span>
                        </li>
                        <li className="flex items-start">
                            <span className="text-primary mr-2">✓</span>
                            <span><strong>Secure:</strong> Non-custodial, you control your funds</span>
                        </li>
                    </ul>
                </section>

                <section className="bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-2xl border border-primary/30">
                    <h2 className="text-2xl font-bold mb-4 text-white text-center">Join TRK Game Today</h2>
                    <p className="text-gray-300 text-center mb-4">
                        Get started with $100 practice bonus and your unique TRK referral code
                    </p>
                    <div className="text-center">
                        <a href="/" className="inline-block bg-primary hover:bg-primary/80 text-black font-bold py-3 px-8 rounded-lg transition-colors">
                            Register Now
                        </a>
                    </div>
                </section>
            </div>
        </div>
    );
}
