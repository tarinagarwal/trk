'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { TRK_ADDRESSES } from '../config/contractAddresses';
import TRKRouterABI from '../abis/TRKRouter.json';

export interface EcosystemConfig {
  treasury: {
    minActivation: bigint;
    minWithdrawal: bigint;
    maxDailyWithdrawal: bigint;
    withdrawFee: bigint;
    refP: bigint;
    clubP: bigint;
    luckyP: bigint;
    protectP: bigint;
  };
  cashback: {
    lossCashbackBps: bigint;
    lossReferralBps: bigint;
    dailyLossThreshold: bigint;
    luckySharePercent: bigint;
    roiPoolRatio: bigint;
    maxDailyCashback: bigint;
  };
  game: {
    winCashoutMult: bigint;
    winReinvestMult: bigint;
    practiceLimit: bigint;
    cashLimit: bigint;
    winMultiplier: bigint;
  };
  lucky: {
    maxTickets: bigint;
    goldenPrice: bigint;
    silverPrice: bigint;
  };
  caps: {
    before: { directs: number; multiplier: number }[];
    after: { directs: number; multiplier: number }[];
    phaseThreshold: number;
  };
  onboarding: {
    minActivation: bigint;
    signupBonusTier1: bigint;
    tier1Limit: number;
    signupBonusTier2: bigint;
    tier2Limit: number;
    fullBridge: bigint;
  };
  isLoading: boolean;
}

const ConfigContext = createContext<EcosystemConfig | null>(null);

export function EcosystemConfigProvider({ children }: { children: React.ReactNode }) {
  const { data: systemSettings, isLoading: isSettingsLoading } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: 'getSystemSettings',
  });

  const { data: allSettings, isLoading: isAllLoading } = useReadContract({
    address: TRK_ADDRESSES.ROUTER,
    abi: TRKRouterABI.abi,
    functionName: 'getAllSettings',
  });

  const config = useMemo(() => {
    if (!systemSettings || !allSettings) return null;

    const [
      treasuryParams,
      refPercents,
      cashbackParams,
      roiPercents,
      gameParams,
      winRefPercents,
      luckyParams,
      capsBefore,
      capsAfter,
      phaseThreshold
    ] = systemSettings as any;

    const allS = allSettings as bigint[];

    return {
      treasury: {
        minActivation: treasuryParams[0],
        minWithdrawal: treasuryParams[1],
        maxDailyWithdrawal: treasuryParams[2],
        withdrawFee: treasuryParams[3],
        refP: treasuryParams[7],
        clubP: treasuryParams[8],
        luckyP: treasuryParams[9],
        protectP: treasuryParams[10],
      },
      cashback: {
        lossCashbackBps: cashbackParams[0],
        lossReferralBps: cashbackParams[1],
        dailyLossThreshold: cashbackParams[2],
        luckySharePercent: cashbackParams[3],
        roiPoolRatio: cashbackParams[4],
        maxDailyCashback: cashbackParams[5],
      },
      game: {
        winCashoutMult: gameParams[0],
        winReinvestMult: gameParams[1],
        practiceLimit: gameParams[2],
        cashLimit: gameParams[3],
        winMultiplier: gameParams[0] + gameParams[1],
      },
      lucky: {
        maxTickets: luckyParams[0],
        goldenPrice: luckyParams[1],
        silverPrice: luckyParams[2],
      },
      caps: {
        before: capsBefore.map((c: any) => ({ directs: Number(c.directs || c[0]), multiplier: Number(c.multiplier || c[1]) })),
        after: capsAfter.map((c: any) => ({ directs: Number(c.directs || c[0]), multiplier: Number(c.multiplier || c[1]) })),
        phaseThreshold: Number(phaseThreshold),
      },
      onboarding: {
        minActivation: allS[0],
        signupBonusTier1: allS[1],
        tier1Limit: Number(allS[2]),
        signupBonusTier2: allS[3],
        tier2Limit: Number(allS[4]),
        fullBridge: allS[8],
      },
      isLoading: false,
    };
  }, [systemSettings, allSettings]);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useEcosystemConfig() {
  const context = useContext(ConfigContext);
  return context;
}
