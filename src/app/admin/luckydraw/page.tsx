"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { formatUnits } from 'viem';
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { TRK_GAME_ADDRESS, TRK_ADDRESSES } from '../../../config';
import RouterABI from '../../../abis/TRKRouter.json';
import RegistryABI from '../../../abis/TRKUserRegistry.json';
import { API_ENDPOINTS } from "../../../config/backend";

type DrawType = 0 | 1;

export default function LuckyDrawTab() {
  const [drawType, setDrawType] = useState<DrawType>(1); // Default to Golden
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [manualWinners, setManualWinners] = useState<string[]>(Array(50).fill(""));
  const [search, setSearch] = useState("");
  const { writeContract, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  // Fetch Current Manual Winners from Contract
  const { data: currentManualWinners, refetch: refetchManualWinners } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: RouterABI.abi,
    functionName: "getLuckyDrawManualWinners",
    args: [drawType],
  });

  useEffect(() => {
    if (currentManualWinners) {
      const winners = Array.from(currentManualWinners as string[]);
      const padded = [...winners, ...Array(50 - winners.length).fill("")];
      setManualWinners(padded);
    } else {
      setManualWinners(Array(50).fill(""));
    }
  }, [currentManualWinners]);

  // Fetch Users from Backend
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(API_ENDPOINTS.GET_ADMIN_USERS);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users.map((u: any) => ({
          id: u.referralCode || "0",
          address: u.address
        })));
      }
    } catch (e) {
      console.error("User fetch failed:", e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSetWinner = (address: string, index: number) => {
    const newWinners = [...manualWinners];
    newWinners[index] = address;
    setManualWinners(newWinners);
  };

  const handleAutoFill = (type: 'recent' | 'random' | 'clear') => {
    if (type === 'clear') {
      setManualWinners(Array(50).fill(""));
      return;
    }
    
    let selected: string[] = [];
    if (type === 'recent') {
      selected = users.slice(0, 50).map(u => u.address);
    } else if (type === 'random') {
      selected = [...users].sort(() => Math.random() - 0.5).slice(0, 50).map(u => u.address);
    }
    
    const padded = [...selected, ...Array(50 - selected.length).fill("")];
    setManualWinners(padded);
  };

  const saveToBlockchain = () => {
    const winners = manualWinners.filter(w => w && w.startsWith("0x"));
    writeContract({
      address: TRK_GAME_ADDRESS,
      abi: RouterABI.abi,
      functionName: "setLuckyDrawManualWinners",
      args: [drawType, winners],
    });
  };

  const filteredUsers = users.filter(u => 
    u.address.toLowerCase().includes(search.toLowerCase()) || 
    u.id.includes(search)
  ).slice(0, 20);

  const prizes = drawType === 1 
    ? [
        { tier: "🥇 JACKPOT", prize: "10,000" },
        { tier: "🥈 2nd PRIZE", prize: "5,000" },
        { tier: "🥉 3rd PRIZE", prize: "4,000" },
        { tier: "🎖️ TIER 1", prize: "1,000" },
        { tier: "🎖️ TIER 2", prize: "300" }
      ]
    : [
        { tier: "🥇 JACKPOT", prize: "1,000" },
        { tier: "🥈 2nd PRIZE", prize: "500" },
        { tier: "🥉 3rd PRIZE", prize: "400" },
        { tier: "🎖️ TIER 1", prize: "100" },
        { tier: "🎖️ TIER 2", prize: "30" }
      ];

  const getTierInfo = (idx: number) => {
    if (idx === 0) return prizes[0];
    if (idx === 1) return prizes[1];
    if (idx === 2) return prizes[2];
    if (idx < 10) return prizes[3];
    return prizes[4];
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tighter text-pink-500 flex items-center gap-2">
            LUCKY_DRAW_CONTROL
            <span className="text-gray-600 text-sm font-light">/ {drawType === 1 ? "GOLDEN" : "SILVER"}</span>
          </h2>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest mt-1">Manual Selection Core [Top 50 Slots]</p>
        </div>

        {/* Draw Type Selector */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 w-full md:w-fit overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setDrawType(1)}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${drawType === 1 ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' : 'text-gray-500 hover:text-white'}`}
          >
            🥇 GOLDEN ($10)
          </button>
          <button 
            onClick={() => setDrawType(0)}
            className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap ${drawType === 0 ? 'bg-gray-400 text-black shadow-lg shadow-gray-400/20' : 'text-gray-500 hover:text-white'}`}
          >
            🥈 SILVER ($1)
          </button>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => handleAutoFill('recent')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Fill Recent
          </button>
          <button 
            onClick={() => handleAutoFill('random')}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Fill Random
          </button>
          <button 
            onClick={() => handleAutoFill('clear')}
            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Selection Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 h-fit sticky top-8">
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${drawType === 1 ? 'bg-yellow-500' : 'bg-gray-400'} animate-pulse`} />
              USER_SOURCE
            </h3>
            
            <input 
              placeholder="Search users..." 
              className="w-full bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-sm mb-4 outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {loadingUsers ? (
                <div className="p-4 text-center text-gray-600 animate-pulse font-mono text-xs">SCANNING_REGISTRY...</div>
              ) : filteredUsers.map((u) => (
                <motion.div
                  key={u.id}
                  layoutId={u.address}
                  className="p-3 bg-white/[0.02] hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 rounded-xl cursor-pointer transition-all group"
                  onClick={() => {
                    const firstEmpty = manualWinners.indexOf("");
                    if (firstEmpty !== -1) handleSetWinner(u.address, firstEmpty);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-blue-400">UID #{u.id}</span>
                    <span className="text-[9px] text-gray-600 uppercase group-hover:text-blue-300 transition-colors">Select Slot &rarr;</span>
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 truncate mt-1 group-hover:text-white transition-colors">{u.address}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Manual Winner Slots */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-3">
                <span className={`px-2 py-0.5 ${drawType === 1 ? 'bg-yellow-500' : 'bg-gray-400'} text-black text-[10px] font-black rounded uppercase`}>Config</span>
                Assigned Winners [{drawType === 1 ? "GOLDEN" : "SILVER"}]
              </h3>
              <div className="text-xs font-mono text-gray-500">
                {manualWinners.filter(w => w).length} / 50 Assigned
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
              {manualWinners.map((addr, idx) => {
                const isTop3 = idx < 3;
                const info = getTierInfo(idx);
                
                return (
                  <motion.div
                    key={`${drawType}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    className={`relative p-4 rounded-2xl border transition-all ${
                      addr 
                        ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.05)]' 
                        : 'bg-black/20 border-white/5 border-dashed'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isTop3 ? (drawType === 1 ? 'text-yellow-400' : 'text-gray-300') : 'text-gray-500'}`}>
                          {info.tier}
                        </span>
                        <span className="text-[10px] font-mono text-gray-400">${info.prize} USDT</span>
                      </div>
                      {addr && (
                        <button 
                          onClick={() => handleSetWinner("", idx)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      {addr ? (
                        <motion.div 
                          className="font-mono text-[11px] text-white truncate bg-black/40 px-2 py-1.5 rounded-lg border border-white/5"
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                        >
                          {addr}
                        </motion.div>
                      ) : (
                        <div className="text-[10px] font-mono text-gray-700 italic px-2 py-1.5">
                          Empty Slot #{idx + 1}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8">
              <button
                onClick={saveToBlockchain}
                disabled={isPending}
                className={`w-full py-4 bg-gradient-to-r ${drawType === 0 ? 'from-yellow-600 to-orange-600' : 'from-blue-600 to-gray-600'} hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest flex items-center justify-center gap-3`}
              >
                {isPending ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Syncing to Blockchain...
                  </>
                ) : (
                  <>
                    <span className="text-2xl">💾</span>
                    Save {drawType === 1 ? "GOLDEN" : "SILVER"} Winners
                  </>
                )}
              </button>
              <p className="text-center text-[10px] text-gray-500 mt-4 uppercase tracking-[0.2em]">
                Transactions are permanent once confirmed. configuration applies to current draw type.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
