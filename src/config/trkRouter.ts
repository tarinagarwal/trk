import { type Address } from 'viem';

// 1. IMPORT YOUR ACTUAL ABIS (from Hardhat/Foundry/Remix)
// Assuming you save them in an 'abis' folder
import RegistryABI from '@/abis/TRKUserRegistry.json';
import GameABI from '@/abis/TRKGameEngine.json';
import CashbackABI from '@/abis/TRKCashbackEngine.json';
import TreasuryABI from '@/abis/TRKTreasury.json';
import LuckyDrawABI from '@/abis/TRKLuckyDraw.json';
import ERC20ABI from '@/abis/MockUSDT.json'; // Standard BEP20 ABI

import { TRK_ADDRESSES } from './contractAddresses';

// ==========================================
// 2. MASTER ROUTING DICTIONARY
// ==========================================
export const trkRouter = {
    // ------------------------------------------
    // USDT CONTROLS
    // ------------------------------------------
    usdt: {
        approve: (spender: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.USDT, abi: ERC20ABI.abi, functionName: 'approve', args: [spender, amount]
        }),
        allowance: (owner: Address, spender: Address) => ({
            address: TRK_ADDRESSES.USDT, abi: ERC20ABI.abi, functionName: 'allowance', args: [owner, spender]
        }),
        balanceOf: (account: Address) => ({
            address: TRK_ADDRESSES.USDT, abi: ERC20ABI.abi, functionName: 'balanceOf', args: [account]
        })
    },

    // ------------------------------------------
    // REGISTRY (TRKUserRegistry.sol)
    // ------------------------------------------
    registry: {
        // Writes (User)
        register: (referrer: Address) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'register', args: [referrer]
        }),
        // Writes (Admin/Internal Hooks)
        recordDeposit: (user: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'recordDeposit', args: [user, amount]
        }),
        distributeDirectIncome: (user: Address, pool: bigint) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'distributeDirectIncome', args: [user, pool]
        }),
        distributeWinnerIncome: (user: Address, pool: bigint) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'distributeWinnerIncome', args: [user, pool]
        }),
        addWalletBalance: (user: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'addWalletBalance', args: [user, amount]
        }),
        // Reads
        getUser: (userAddress: Address) => ({
            address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'users', args: [userAddress]
        }),
        getStats: () => [
            { address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'userCounter' },
            { address: TRK_ADDRESSES.REGISTRY, abi: RegistryABI.abi, functionName: 'totalUsers' }
        ]
    },

    // ------------------------------------------
    // GAME ENGINE (TRKGameEngine.sol)
    // ------------------------------------------
    game: {
        // Writes (User)
        betCash: (number: number, amount: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI, functionName: 'betCash', args: [BigInt(number), amount]
        }),
        betPractice: (number: number, amount: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI, functionName: 'betPractice', args: [BigInt(number), amount]
        }),
        claim: (roundId: bigint, isCash: boolean) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI, functionName: 'claim', args: [roundId, isCash]
        }),
        // Writes (Admin)
        closeRound: (winNumber: number, isCash: boolean) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'closeRound', args: [BigInt(winNumber), isCash]
        }),
        // Reads
        getPracticeRoundInfo: (roundId: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'practiceRounds', args: [roundId]
        }),
        getCashRoundInfo: (roundId: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'cashRounds', args: [roundId]
        }),
        getPracticeBet: (user: Address, roundId: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'practiceBets', args: [user, roundId]
        }),
        getCashBet: (user: Address, roundId: bigint) => ({
            address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'cashBets', args: [user, roundId]
        }),
        getCurrentRounds: () => [
            { address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'practiceRound' },
            { address: TRK_ADDRESSES.GAME, abi: GameABI.abi, functionName: 'cashRound' }
        ]
    },

    // ------------------------------------------
    // TREASURY (TRKTreasury.sol)
    // ------------------------------------------
    treasury: {
        // Writes (User)
        deposit: (amount: bigint) => ({
            address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI, functionName: 'deposit', args: [amount]
        }),
        withdraw: (amount: bigint) => ({
            address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI, functionName: 'withdraw', args: [amount]
        }),
        // Writes (Admin)
        rescue: (token: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI, functionName: 'rescue', args: [token, amount]
        }),
        // Reads
        getPool: () => ({
            address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI.abi, functionName: 'gamePool'
        }),
        getWithdrawalStats: (user: Address) => [
            { address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI.abi, functionName: 'lastDay', args: [user] },
            { address: TRK_ADDRESSES.TREASURY, abi: TreasuryABI.abi, functionName: 'withdrawnToday', args: [user] }
        ]
    },

    // ------------------------------------------
    // CASHBACK ENGINE (TRKCashbackEngine.sol)
    // ------------------------------------------
    cashback: {
        // Writes (User)
        claimCashback: (totalUsers: bigint) => ({
            address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI, functionName: 'claimCashback', args: [totalUsers]
        }),
        // Writes (Admin)
        addToProtectionPool: (amount: bigint) => ({
            address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI, functionName: 'addToProtectionPool', args: [amount]
        }),
        addToLuckyPool: (amount: bigint) => ({
            address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI, functionName: 'addToLuckyPool', args: [amount]
        }),
        // Reads
        getPools: () => [
            { address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI.abi, functionName: 'protectionPoolBalance' },
            { address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI.abi, functionName: 'luckyPoolBalance' }
        ],
        getLastClaim: (user: Address) => ({
            address: TRK_ADDRESSES.CASHBACK, abi: CashbackABI.abi, functionName: 'lastClaimDay', args: [user]
        })
    },

    // ------------------------------------------
    // LUCKY DRAW (TRKLuckyDraw.sol)
    // ------------------------------------------
    luckyDraw: {
        // Writes (User)
        buyTicket: (count: number) => ({
            address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI, functionName: 'buyTicket', args: [BigInt(count)]
        }),
        // Writes (Admin/Internal)
        autoEnter: (user: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI, functionName: 'autoEnter', args: [user, amount]
        }),
        rescue: (token: Address, amount: bigint) => ({
            address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI, functionName: 'rescue', args: [token, amount]
        }),
        // Reads
        getDrawStats: () => [
            { address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI.abi, functionName: 'currentDrawId' },
            { address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI.abi, functionName: 'ticketCount' }
        ],
        hasBeenDrawn: (drawId: bigint) => ({
            address: TRK_ADDRESSES.LUCKY_DRAW, abi: LuckyDrawABI.abi, functionName: 'drawn', args: [drawId]
        })
    }
};