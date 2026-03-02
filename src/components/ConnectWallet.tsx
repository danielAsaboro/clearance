"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { useCluster } from "@/components/cluster/cluster-data-access";
import { Wallet, Copy, ExternalLink, LogOut, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ConnectWallet() {
  const { authenticated, user, login, logout } = usePrivy();
  const { wallets, ready } = useWallets();
  const { getExplorerUrl } = useCluster();
  const [copied, setCopied] = useState(false);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? user?.wallet?.address;

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm text-white hover:border-[#F5E642]/40 transition-colors cursor-pointer"
      >
        <Wallet className="w-4 h-4 text-[#F5E642]" />
        Connect Wallet
      </button>
    );
  }

  if (!ready || !walletAddress) {
    return (
      <button
        disabled
        className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm text-[#888] cursor-wait"
      >
        <Loader2 className="w-4 h-4 text-[#F5E642] animate-spin" />
        Loading...
      </button>
    );
  }

  const shortAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

  const walletType = solanaWallet?.walletClientType;
  const walletName =
    walletType === "privy"
      ? "Privy Wallet"
      : walletType
        ? walletType.charAt(0).toUpperCase() + walletType.slice(1)
        : "Wallet";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExplorer = () => {
    window.open(getExplorerUrl(`address/${walletAddress}`), "_blank");
  };

  const handleDisconnect = async () => {
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm text-white hover:border-[#F5E642]/40 transition-colors cursor-pointer outline-none">
          <Wallet className="w-4 h-4 text-[#F5E642]" />
          <span className="font-mono text-xs">{shortAddress}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-[#888]">
          {walletName}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={handleCopy} className="cursor-pointer">
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-[#888]" />
          )}
          {copied ? "Copied!" : "Copy address"}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={handleExplorer} className="cursor-pointer">
          <ExternalLink className="w-4 h-4 text-[#888]" />
          View on Explorer
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onSelect={handleDisconnect}
          className="cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
