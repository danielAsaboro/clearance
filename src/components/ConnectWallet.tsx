"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Wallet } from "lucide-react";

export default function ConnectWallet() {
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const solanaWallet = wallets.find((w) => w.walletClientType?.includes("solana")) ?? wallets[0];

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white hover:border-[#F5E642]/40 transition-colors"
      >
        <Wallet className="w-4 h-4 text-[#F5E642]" />
        Connect Wallet
      </button>
    );
  }

  if (!solanaWallet) {
    return (
      <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm">
        <Wallet className="w-4 h-4 text-[#888]" />
        <span className="text-[#888]">No wallet found</span>
      </div>
    );
  }

  const shortAddress = `${solanaWallet.address.slice(0, 4)}...${solanaWallet.address.slice(-4)}`;

  return (
    <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#F5E642]/20 rounded-xl px-4 py-3 text-sm">
      <Wallet className="w-4 h-4 text-[#F5E642]" />
      <span className="text-white font-mono text-xs">{shortAddress}</span>
      <span className="w-2 h-2 bg-green-400 rounded-full ml-auto" />
    </div>
  );
}
