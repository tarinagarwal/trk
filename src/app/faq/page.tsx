'use client';

import { useState } from 'react';

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const faqs = [
        {
            q: "What is TRK Game?",
            a: "TRK Game is a blockchain-based prediction game platform on BSC Mainnet with a 15-level referral system. Players can earn through winnings and referral commissions."
        },
        {
            q: "How do I get started?",
            a: "Connect your wallet (MetaMask/Trust Wallet) to BSC Mainnet, register with a TRK referral code, and receive your $100 practice bonus plus your own unique TRK code."
        },
        {
            q: "What is a TRK code?",
            a: "A TRK code is your unique referral identifier (e.g., TRK12345). It's easier to share than a wallet address and tracks your referral network automatically."
        },
        {
            q: "How much does it cost to play?",
            a: "Registration is FREE with $100 practice bonus. To play cash games, deposit minimum $10 USDT. Practice games are always free (24 per day)."
        },
        {
            q: "How do I win?",
            a: "Predict a number (0-9). If it matches the winning number, you win 2X your bet as cashout plus 6X reinvested into your gaming balance."
        },
        {
            q: "What are the income streams?",
            a: "1) Direct winnings (2X bet), 2) Referral income (15 levels), 3) Winner referral income (15% of referrals' wins), 4) Practice balance rewards from referrals."
        },
        {
            q: "How does the referral system work?",
            a: "Share your TRK code. When someone registers with it, they become your Level 1 referral. Their referrals are Level 2, and so on up to 15 levels. You earn commissions from all levels."
        },
        {
            q: "What are the referral percentages?",
            a: "Level 1: 5%, Level 2: 2%, Levels 3-5: 1% each, Levels 6-15: 0.5% each. Total: 15% distributed across your network."
        },
        {
            q: "How do withdrawals work?",
            a: "Minimum: 5 USDT, Maximum: 5000 USDT/day. Withdrawals are instant via smart contract. For referral income, you need 100 USDT cumulative before first withdrawal."
        },
        {
            q: "Is my money safe?",
            a: "Yes! All funds are managed by audited smart contracts on BSC. The platform is non-custodial - you control your wallet and funds at all times."
        },
        {
            q: "What wallets are supported?",
            a: "MetaMask, Trust Wallet, and any WalletConnect-compatible wallet. Make sure you're connected to BSC Mainnet (Chain ID: 56)."
        },
        {
            q: "How many games can I play per day?",
            a: "24 practice games + 24 cash games per day. Practice games use your practice balance, cash games use real USDT."
        },
        {
            q: "What happens if I lose?",
            a: "Lost bets are distributed: 2% Creator, 5% BD wallets, 5% FEW wallet, 15% referral network, 65% game pool for future winners."
        },
        {
            q: "Can I play on mobile?",
            a: "Yes! Use Trust Wallet or MetaMask mobile app. Connect to BSC Mainnet and access the platform through the in-app browser."
        },
        {
            q: "What is the practice account?",
            a: "A risk-free account with $100 bonus to learn the game. Practice winnings go to practice balance. Referral rewards from practice games are real USDT!"
        }
    ];

    return (
        <div className="container mx-auto px-4 py-12 max-w-4xl">
            <h1 className="text-4xl font-bold mb-8 text-center text-primary">Frequently Asked Questions</h1>

            <div className="space-y-4">
                {faqs.map((faq, index) => (
                    <div key={index} className="bg-surface/50 rounded-2xl border border-gray-800 overflow-hidden">
                        <button
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            className="w-full p-6 text-left flex justify-between items-center hover:bg-gray-800/30 transition-colors"
                        >
                            <h3 className="font-bold text-white pr-4">{faq.q}</h3>
                            <span className={`text-primary text-2xl transition-transform ${openIndex === index ? 'rotate-180' : ''}`}>
                                ↓
                            </span>
                        </button>
                        {openIndex === index && (
                            <div className="px-6 pb-6">
                                <p className="text-gray-300 leading-relaxed">{faq.a}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-12 bg-gradient-to-r from-primary/10 to-purple-500/10 p-6 rounded-2xl border border-primary/30 text-center">
                <h2 className="text-xl font-bold mb-2 text-white">Still have questions?</h2>
                <p className="text-gray-400 mb-4">Join our community or contact support</p>
                <a href="/" className="inline-block bg-primary hover:bg-primary/80 text-black font-bold py-2 px-6 rounded-lg transition-colors">
                    Get Started
                </a>
            </div>
        </div>
    );
}
