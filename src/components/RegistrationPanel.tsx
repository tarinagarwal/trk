"use client";

import { useEffect, useState } from "react";
import { isAddress, formatUnits } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { TRK_GAME_ADDRESS } from "../config";
import TRKGameABI from "../abis/TRKRouter.json";
import { API_ENDPOINTS } from "../config/backend";
import { useEcosystemConfig } from "./EcosystemConfig";

export default function RegistrationPanel() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  // State for inputs
  const [referralInput, setReferralInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [validationError, setValidationError] = useState("");

  const config = useEcosystemConfig();

  // 1. Contract Writes & Transaction Monitoring
  const { data: hash, writeContract, isPending } = useWriteContract();

  // Wait for the transaction to be mined (confirmed)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // 2. Read newly assigned Referral Code (Refetch triggers after registration)
  const { data: myNewCode, refetch: refetchMyCode } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "addressToReferralCode",
    args: [userAddress],
  });

  // Read user info after registration to confirm practice balance credited
  const { data: newUserData, refetch: refetchUserData } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "getUserInfo",
    args: [userAddress],
    query: { enabled: isSuccess },
  });

  // 3. Read Total Users for Bonus Logic
  const { data: totalUsersData } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "totalUsers",
  });

  const currentTotalUsers = totalUsersData ? Number(totalUsersData) : 0;

  // Calculate current bonus available
  const tier1Limit = config?.onboarding.tier1Limit ?? 100000;
  const tier2Limit = config?.onboarding.tier2Limit ?? 1000000;
  const isTier1 = currentTotalUsers < tier1Limit;
  const isTier2 = currentTotalUsers < tier1Limit + tier2Limit;

  const currentBonus = isTier1
    ? config?.onboarding.signupBonusTier1 ?? BigInt(0)
    : isTier2
    ? config?.onboarding.signupBonusTier2 ?? BigInt(0)
    : BigInt(0);

  const isBonusAvailable = currentBonus > BigInt(0);
  const spotsLeft = isTier1
    ? tier1Limit - currentTotalUsers
    : isTier2
    ? tier1Limit + tier2Limit - currentTotalUsers
    : 0;

  // 4. Admin Check
  const { data: ownerAddress } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "owner",
  });

  const isOwner: boolean = Boolean(
    ownerAddress &&
      userAddress &&
      (ownerAddress as string).toLowerCase() === userAddress.toLowerCase(),
  );

  // --- EFFECTS ---

  // Trigger a refetch of the referral code once the transaction succeeds
  useEffect(() => {
    if (isSuccess && myNewCode && userAddress) {
      const syncRegistration = async () => {
        try {
          await fetch(API_ENDPOINTS.SYNC_REGISTER, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: userAddress,
              referrer: resolvedAddress,
              userId: myNewCode.toString(),
              hash: hash,
              timestamp: Math.floor(Date.now() / 1000),
            }),
          });
        } catch (err) {
          console.error("Failed to sync registration:", err);
        }
      };
      syncRegistration();
      refetchMyCode();
      refetchUserData();
    } else if (isSuccess) {
      refetchMyCode();
      refetchUserData();
    }
  }, [
    isSuccess,
    myNewCode,
    userAddress,
    resolvedAddress,
    hash,
    refetchMyCode,
    refetchUserData,
  ]);

  // Initialize Referral Input from URL or LocalStorage
  useEffect(() => {
    let ref = "";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      ref = params.get("ref") || "";
    }
    if (!ref) ref = localStorage.getItem("referral") || "";
    setReferralInput(ref);
  }, []);

  // Auto-fill for Admin
  useEffect(() => {
    if (isOwner) {
      setResolvedAddress("0x0000000000000000000000000000000000000000");
      setIsValid(true);
      setValidationError("");
    }
  }, [isOwner]);

  // Validation Logic (Same as before)
  useEffect(() => {
    if (referralInput !== undefined) checkReferral(referralInput);
  }, [referralInput, isOwner]);

  // --- HELPERS ---

  const resolveTRKCode = async (
    trkCode: string,
  ): Promise<{ address: string | null; error?: string }> => {
    if (!publicClient || !trkCode.startsWith("TRK")) return { address: null };
    try {
      const walletAddress = (await publicClient.readContract({
        address: TRK_GAME_ADDRESS as `0x${string}`,
        abi: TRKGameABI.abi as any,
        functionName: "referralCodeToAddress",
        args: [trkCode],
      })) as string;

      if (
        walletAddress &&
        walletAddress !== "0x0000000000000000000000000000000000000000"
      ) {
        return { address: walletAddress };
      }
      return { address: null, error: "TRK code not found." };
    } catch (error: any) {
      console.error("Error resolving TRK code:", error);
      const isConnectionError =
        error.message?.toLowerCase().includes("failed to fetch") ||
        error.message?.toLowerCase().includes("network");
      return {
        address: null,
        error: isConnectionError
          ? "Connection error. Check network/tunnel."
          : "Code lookup failed. Are you on the right network?",
      };
    }
  };

  const checkReferral = async (input: string) => {
    if (isOwner) return; // Admin handled in useEffect

    const target = input.trim();
    if (!target) {
      setIsValid(false);
      setResolvedAddress("");
      setValidationError("Referral address is required");
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setIsValid(false);
    setResolvedAddress("");
    setValidationError("");

    if (target.startsWith("TRK") && target.length === 8) {
      const { address: walletAddress, error } = await resolveTRKCode(target);
      if (!walletAddress) {
        setIsValid(false);
        setValidationError(error || "TRK code not found.");
        setIsChecking(false);
        return;
      }
      if (
        userAddress &&
        walletAddress.toLowerCase() === userAddress.toLowerCase()
      ) {
        setIsValid(false);
        setValidationError("Cannot refer yourself");
        setIsChecking(false);
        return;
      }
      setResolvedAddress(walletAddress);
      setIsValid(true);
      setIsChecking(false);
      return;
    }

    if (!isAddress(target)) {
      setIsValid(false);
      setValidationError("Invalid format");
      setIsChecking(false);
      return;
    }

    if (userAddress && target.toLowerCase() === userAddress.toLowerCase()) {
      setIsValid(false);
      setValidationError("Cannot refer yourself");
      setIsChecking(false);
      return;
    }

    setResolvedAddress(target);
    setIsValid(true);
    setIsChecking(false);
  };

  const handleRegister = async () => {
    if (!isValid || isChecking || !resolvedAddress) return;
    try {
      writeContract({
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "register",
        args: [resolvedAddress],
      });
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  // --- SUCCESS VIEW (Shows new Referral Code + Practice Balance) ---
  if (isSuccess) {
    const newUserInfo = newUserData ? (newUserData as any) : null;
    const creditedPracticeBalance =
      newUserInfo?.practiceBalance ?? newUserInfo?.[4] ?? null;
    const displayBonus =
      creditedPracticeBalance != null
        ? formatUnits(creditedPracticeBalance as bigint, 18)
        : isBonusAvailable
        ? formatUnits(currentBonus, 18)
        : null;

    return (
      <div className="bg-surface/90 backdrop-blur-md border border-green-500/50 p-8 rounded-2xl shadow-2xl w-full max-w-md text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
          <span className="text-4xl">🎉</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Welcome to TRK!</h2>
        <p className="text-gray-300 mb-6">Your registration was successful.</p>

        {displayBonus && Number(displayBonus) > 0 && (
          <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4 mb-4">
            <p className="text-xs text-green-400 uppercase tracking-widest mb-1">
              Sign Up Bonus Credited
            </p>
            <p className="text-3xl font-mono font-black text-green-400">
              +{Number(displayBonus).toFixed(2)} USDT
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              Added to your Practice Balance
            </p>
          </div>
        )}

        <div className="bg-black/40 rounded-xl p-4 border border-gray-700 mb-6">
          <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">
            Your Referral Code
          </p>
          <p className="text-3xl font-mono font-bold text-yellow-400 tracking-wider">
            {myNewCode ? (
              (myNewCode as string)
            ) : (
              <span className="animate-pulse">Loading...</span>
            )}
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
        >
          Enter Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface/80 backdrop-blur-md border border-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10"></div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Join TRK Game</h2>
        <p className="text-gray-400 text-sm">
          Register to unlock your referral code and rewards.
        </p>
        <div className="mt-1 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          Activation:{" "}
          {formatUnits(
            config?.onboarding.minActivation ?? BigInt(10000000000000000000),
            18,
          )}{" "}
          USDT
        </div>
        {isBonusAvailable && (
          <div className="mt-2 text-[10px] text-yellow-500/80 uppercase tracking-widest">
            {spotsLeft.toLocaleString()} {isTier1 ? "TIER-1" : "TIER-2"} Bonus
            Spots Left
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-500 uppercase font-bold tracking-wider">
            Referral Address {isOwner ? "(Optional)" : "(Required)"}
          </label>
          <div className="relative">
            <input
              type="text"
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value)}
              disabled={isPending || isConfirming}
              className={`bg-black/50 border ${
                isValid ? "border-green-500/50" : "border-gray-700"
              } rounded-xl p-4 text-white font-mono text-sm w-full outline-none focus:border-primary transition-all shadow-inner`}
              placeholder={
                isOwner ? "Admin registration" : "Enter Referral Code (TRK...)"
              }
            />
            {isChecking && (
              <div className="absolute right-4 top-4 text-xs text-yellow-500 animate-pulse">
                Checking...
              </div>
            )}
            {isValid && !isChecking && (
              <div className="absolute right-4 top-4 text-xs text-green-500">
                ✓ Valid
              </div>
            )}
          </div>
          {isValid && resolvedAddress && (
            <p className="text-xs text-green-500/80 px-1">
              {resolvedAddress === "0x0000000000000000000000000000000000000000"
                ? "✨ Admin Registration"
                : `Referrer: ${resolvedAddress.slice(
                    0,
                    6,
                  )}...${resolvedAddress.slice(-4)}`}
            </p>
          )}
          {!isValid && !isChecking && validationError && (
            <p className="text-xs text-red-500/80 px-1">⚠️ {validationError}</p>
          )}
        </div>

        <button
          onClick={handleRegister}
          disabled={isPending || isConfirming || !isValid || isChecking}
          className="w-full py-4 mt-2 bg-gradient-to-r from-primary to-yellow-400 text-black font-bold text-lg rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending
            ? "Check Wallet..."
            : isConfirming
            ? "Registering..."
            : isBonusAvailable
            ? `Register & Claim ${formatUnits(currentBonus, 18)} USDT Bonus`
            : "Register Account"}
        </button>

        <div className="text-center text-xs text-gray-500 mt-2">
          {isConfirming && (
            <p className="text-yellow-500 animate-pulse">
              Waiting for network confirmation...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
