"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { formatUnits } from "viem";
import {
  useReadContracts,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { TRK_GAME_ADDRESS } from "../../../config";
import TRKGameABI from "../../../abis/TRKRouter.json";
import { API_ENDPOINTS } from "../../../config/backend";

export default function UsersTab() {
  const [search, setSearch] = useState("");
  const [windowMode, setWindowMode] = useState<"24h" | "7d" | "30d" | "all">(
    "all",
  );
  const chainId = useChainId();
  const [pruningAddress, setPruningAddress] = useState<string | null>(null);
  const [prunedTx, setPrunedTx] = useState<`0x${string}` | undefined>(
    undefined,
  );

  const { writeContract, isPending: isPruning } = useWriteContract();
  const { isSuccess: isPruneSuccess } = useWaitForTransactionReceipt({
    hash: prunedTx,
  });

  const [backendUsers, setBackendUsers] = useState<any[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(true);

  const fetchUsers = async () => {
    setIsUsersLoading(true);
    try {
      const res = await fetch(API_ENDPOINTS.GET_ADMIN_USERS);
      const data = await res.json();
      if (data.success) {
        setBackendUsers(data.users);
      }
    } catch (e) {
      console.error("Failed to fetch users from backend:", e);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Refresh after a successful unprune
  useEffect(() => {
    if (isPruneSuccess) {
      setPruningAddress(null);
      setPrunedTx(undefined);
      fetchUsers();
    }
  }, [isPruneSuccess]);

  const userAddresses = useMemo(() => {
    return backendUsers.map((u) => u.address);
  }, [backendUsers]);

  const {
    data: userInfoData,
    isLoading: isLoadingInfo,
    refetch: refetchUsers,
  } = useReadContracts({
    contracts: userAddresses.map((addr) => ({
      address: TRK_GAME_ADDRESS as `0x${string}`,
      abi: TRKGameABI.abi as any,
      functionName: "getUserInfo",
      args: [addr],
    })),
    query: { enabled: userAddresses.length > 0 },
  });

  // Refresh chain data after unprune
  useEffect(() => {
    if (isPruneSuccess) refetchUsers();
  }, [isPruneSuccess]);

  const handleUnprune = (address: string) => {
    setPruningAddress(address);
    writeContract(
      {
        address: TRK_GAME_ADDRESS,
        abi: TRKGameABI.abi,
        functionName: "unpruneUser",
        args: [address],
      },
      {
        onSuccess: (hash) => setPrunedTx(hash),
        onError: () => setPruningAddress(null),
      },
    );
  };

  const now = Math.floor(Date.now() / 1000);
  const THIRTY_DAYS = 30 * 24 * 60 * 60;

  const users = useMemo(() => {
    if (!userInfoData) return [];
    return userAddresses
      .map((addr, idx) => {
        const res = userInfoData[idx];
        if (res.status !== "success") {
          console.warn(`Contract read failed for user ${addr}:`, res);
          return null;
        }
        const u = res.result as any;
        const backendUser = backendUsers.find(
          (b: any) => b.address.toLowerCase() === addr.toLowerCase(),
        );

        const id = u.userId?.toString() || u?.[0]?.toString() || "0";
        const totalBets =
          u.totalBets != null
            ? formatUnits(u.totalBets, 18)
            : u?.[21] != null
            ? formatUnits(u[21], 18)
            : "0";
        const totalDeposit =
          u.totalDeposit != null
            ? formatUnits(u.totalDeposit, 18)
            : u?.[6] != null
            ? formatUnits(u[6], 18)
            : "0";
        const totalWithdrawn =
          u.totalWithdrawn != null
            ? formatUnits(u.totalWithdrawn, 18)
            : u?.[7] != null
            ? formatUnits(u[7], 18)
            : "0";
        const practiceBalance =
          u.practiceBalance != null
            ? formatUnits(u.practiceBalance, 18)
            : u?.[4] != null
            ? formatUnits(u[4], 18)
            : "0";
        const registrationTime =
          u.registrationTime != null
            ? Number(u.registrationTime)
            : u?.[2] != null
            ? Number(u[2])
            : 0;
        const cumulativeDeposit =
          u.cumulativeDeposit != null
            ? Number(formatUnits(u.cumulativeDeposit, 18))
            : u?.[8] != null
            ? Number(formatUnits(u[8], 18))
            : 0;

        const net = (Number(totalWithdrawn) - Number(totalDeposit)).toFixed(2);

        // Pruned = registered >30 days ago with <10 USDT deposited (30-day rule triggered)
        const isPruned =
          registrationTime > 0 &&
          now > registrationTime + THIRTY_DAYS &&
          cumulativeDeposit < 10;

        const lastActivityTs = Number(backendUser?.lastActivityTs || 0);
        const createdAtTs = backendUser?.createdAt
          ? Math.floor(new Date(backendUser.createdAt).getTime() / 1000)
          : registrationTime;
        const activityTs = lastActivityTs > 0 ? lastActivityTs : createdAtTs;

        return {
          id,
          address: addr,
          betVol: Number(totalBets).toFixed(2),
          deposited: Number(totalDeposit).toFixed(2),
          practiceBalance: Number(practiceBalance).toFixed(2),
          net,
          isPruned,
          time:
            registrationTime > 0
              ? new Date(registrationTime * 1000).toLocaleDateString()
              : "Active",
          activityTs,
          lastActivity:
            activityTs > 0 ? new Date(activityTs * 1000).toLocaleString() : "-",
        };
      })
      .filter(Boolean)
      .sort(
        (a: any, b: any) =>
          Number(b.activityTs || 0) - Number(a.activityTs || 0),
      );
  }, [userAddresses, userInfoData, now, backendUsers]);

  const filtered = users.filter(
    (u: any) =>
      u.address.toLowerCase().includes(search.toLowerCase()) ||
      u.id.includes(search),
  );

  const nowSec = Math.floor(Date.now() / 1000);
  const recentCutoff =
    windowMode === "24h"
      ? nowSec - 24 * 60 * 60
      : windowMode === "7d"
      ? nowSec - 7 * 24 * 60 * 60
      : windowMode === "30d"
      ? nowSec - 30 * 24 * 60 * 60
      : 0;

  const scoped = filtered.filter((u: any) => {
    if (windowMode === "all") return true;
    return Number(u.activityTs || 0) >= recentCutoff;
  });

  const loading = isUsersLoading || isLoadingInfo;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-blue-500 italic uppercase">
            User_Index
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-2 h-2 rounded-full ${
                loading ? "bg-yellow-500 animate-pulse" : "bg-green-500"
              }`}
            />
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
              {loading
                ? `Syncing [LIVE]`
                : `System Online • ${users.length}/${backendUsers.length} Users Loaded`}
            </span>
            {backendUsers.length > users.length && !loading && (
              <span className="text-[10px] font-mono text-yellow-500 uppercase tracking-widest">
                ⚠ {backendUsers.length - users.length} failed to load
              </span>
            )}
          </div>
        </div>

        <input
          placeholder="Filter Identity..."
          className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm w-full md:w-64 outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={windowMode}
            onChange={(e) => setWindowMode(e.target.value as any)}
            className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm flex-1 md:flex-none md:w-48 outline-none font-mono"
          >
            <option value="24h">New activity: 24h</option>
            <option value="7d">New activity: 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All users (full history)</option>
          </select>
          {backendUsers.length > users.length && !loading && (
            <button
              onClick={() => refetchUsers()}
              className="px-4 py-2 rounded-xl text-sm font-mono bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all"
            >
              Retry Failed
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/40 backdrop-blur-md max-w-full no-scrollbar">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-white/[0.02] text-gray-500 uppercase text-[9px] tracking-[0.2em] font-black italic">
              <th className="px-6 py-4">UID</th>
              <th className="px-6 py-4">Wallet Address</th>
              <th className="px-6 py-4 text-center">Bet Volume</th>
              <th className="px-6 py-4 text-right">Deposited</th>
              <th className="px-6 py-4 text-right">Practice Bal</th>
              <th className="px-6 py-4 text-right">Net Profit</th>
              <th className="px-6 py-4 text-right">Last Activity</th>
              <th className="px-6 py-4 text-right">Registered</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {scoped.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-10 text-center text-gray-600 font-mono text-xs italic uppercase tracking-widest"
                >
                  No_Records_Found
                </td>
              </tr>
            ) : (
              scoped.map((u: any, idx: number) => (
                <motion.tr
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  key={u.id}
                  className="hover:bg-blue-500/[0.04] transition-all group"
                >
                  <td className="px-6 py-4 font-black text-blue-400 group-hover:scale-110 transition-transform origin-left italic">
                    #{u.id}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-400 group-hover:text-white transition-colors text-[10px]">
                    {u.address}
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-black text-white">
                    ${u.betVol}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-green-400 font-bold">
                    ${u.deposited}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold">
                    <span
                      className={
                        u.isPruned ? "text-red-400" : "text-purple-400"
                      }
                    >
                      ${u.practiceBalance}
                    </span>
                    {u.isPruned && (
                      <span className="ml-1 text-[9px] text-red-500 uppercase font-black">
                        pruned
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-6 py-4 text-right font-mono font-black ${
                      Number(u.net) > 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {Number(u.net) > 0 ? `+$${u.net}` : `$${u.net}`}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-gray-500 text-[10px]">
                    {u.lastActivity}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-gray-600 text-[10px] uppercase font-bold">
                    {u.time}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {u.isPruned && (
                      <button
                        onClick={() => handleUnprune(u.address)}
                        disabled={isPruning && pruningAddress === u.address}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPruning && pruningAddress === u.address
                          ? "Wait..."
                          : "Unprune"}
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono uppercase tracking-[0.2em]">
        <p>
          Showing {scoped.length} entries (
          {windowMode === "all"
            ? "full history"
            : `new activity: ${windowMode}`}
          )
        </p>
        <p>Network: Chain ID {chainId}</p>
      </div>
    </div>
  );
}
