import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
    argentWallet,
    trustWallet,
    ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
    bsc,
    bscTestnet,
} from 'wagmi/chains';
import { http, fallback } from 'wagmi';

export const config = getDefaultConfig({
    appName: 'TRK Eco',
    projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || 'b39f3c8086af314bb6613ef6b4ad7857',
    wallets: [
        {
            groupName: 'Recommended',
            wallets: [argentWallet, trustWallet, ledgerWallet],
        },
    ],
    chains: [bsc, bscTestnet],
    transports: {
        [bsc.id]: fallback([
            ...(process.env.NEXT_PUBLIC_RPC_URL ? [http(process.env.NEXT_PUBLIC_RPC_URL)] : []),
            http('https://bsc-dataseed.bnbchain.org'),
            http('https://rpc.ankr.com/bsc'),
            http('https://binance.llamarpc.com'),
            http('https://bsc.meowrpc.com'),
        ], {
            rank: { interval: 60_000 },
        }),
        [bscTestnet.id]: http('https://data-seed-prebsc-1-s1.binance.org:8545'),
    },
    ssr: true,
});