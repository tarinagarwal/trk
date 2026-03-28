"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { useState } from "react";
import { TRK_GAME_ADDRESS } from "../config";
import TRKGameABI from "../abis/TRKRouter.json";

export default function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if user is contract owner (admin)
  // 1. Correctly allow Hardhat (31337)
  const isLocalOrBsc = chain?.id === 56 || chain?.id === 31337;

  const { data: ownerAddress, isLoading: isOwnerLoading } = useReadContract({
    address: TRK_GAME_ADDRESS as `0x${string}`,
    abi: TRKGameABI.abi,
    functionName: "owner",
    query: {
      enabled: isConnected && !!address && isLocalOrBsc,
    },
  });

  // 2. Add these logs to find the culprit
  console.log("--- ADMIN DEBUG ---");
  console.log("Connected Wallet:", address);
  console.log("Contract Owner:", ownerAddress);
  console.log("Is Network Valid (Local/BSC):", isLocalOrBsc);

  const isAdmin = Boolean(
    ownerAddress &&
      address &&
      String(ownerAddress).toLowerCase() === String(address).toLowerCase(),
  );

  const navItems = [
    { name: "Home", path: "/", protected: false },
    { name: "Dashboard", path: "/dashboard", protected: true },
    { name: "Game", path: "/game", protected: true },
    { name: "Referral", path: "/referral", protected: true },
    { name: "Income", path: "/income", protected: true },
    { name: "Conversions", path: "/conversions", protected: true },
    { name: "Admin", path: "/admin/", protected: true, adminOnly: true },
    {
      name: "Analytics",
      path: "/admin/analytics",
      protected: true,
      adminOnly: true,
    },
    {
      name: "Distributions",
      path: "/admin/distributions",
      protected: true,
      adminOnly: true,
    },
    { name: "About", path: "/about", protected: false },
    { name: "How It Works", path: "/how-it-works", protected: false },
    { name: "FAQ", path: "/faq", protected: false },
    { name: "Terms", path: "/terms", protected: false },
  ];

  const visibleNavItems = navItems.filter((item) => {
    // If the item is admin-only, only show if isAdmin is true
    if (item.adminOnly) return isAdmin;

    // If item is protected, only show if connected
    if (item.protected) return isConnected;

    return true;
  });

  return (
    <header className="border-b border-gray-800 bg-black/90 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 md:h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-12 h-12 md:w-14 md:h-14 rounded-lg"
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-1 lg:gap-4">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-yellow-500/20 text-yellow-500"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Connect Button */}
        <div className="hidden md:block shrink-0">
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-gray-400 hover:text-white"
        >
          {mobileMenuOpen ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-black/95 backdrop-blur-md">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-2">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? "bg-yellow-500/20 text-yellow-500"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-gray-800">
              <ConnectButton
                accountStatus="full"
                chainStatus="icon"
                showBalance={false}
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
