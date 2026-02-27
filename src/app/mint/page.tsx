"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Wallet, Coins, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import ConnectWallet from "@/components/ConnectWallet";
import { useCluster } from "@/components/cluster/cluster-data-access";

type MintStatus = "idle" | "minting" | "success" | "error";

export default function MintPage() {
  const { authenticated, getAccessToken } = usePrivy();
  const { cluster, getExplorerUrl } = useCluster();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!authenticated) return;
    setLoadingBalance(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/usdc/balance", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setWalletAddress(data.walletAddress);
      }
    } catch {
      // ignore
    } finally {
      setLoadingBalance(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleMint = async () => {
    setMintStatus("minting");
    setErrorMsg(null);
    setTxSignature(null);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/usdc/mint", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Mint failed");
      }
      setTxSignature(data.signature);
      setMintStatus("success");
      // Refresh balance after successful mint
      setTimeout(fetchBalance, 2000);
    } catch (err) {
      setMintStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (!authenticated) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center px-6 gap-6">
        <div className="text-center">
          <Wallet className="w-12 h-12 text-[#F5E642] mx-auto mb-4" />
          <h1 className="text-white text-2xl font-bold mb-2">Connect Wallet</h1>
          <p className="text-[#888] text-sm mb-6">
            Connect your wallet to get test USDC for The Clearance.
          </p>
        </div>
        <ConnectWallet />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <Link href="/arena" className="text-[#888] hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-white text-lg font-bold">Get Test USDC</h1>
      </div>

      <div className="flex-1 px-4 py-6 flex flex-col gap-6 max-w-md mx-auto w-full">
        {/* Network badge */}
        <div className="flex items-center gap-2">
          <span className="bg-[#1a1a2e] border border-[#F5E642]/30 text-[#F5E642] text-xs font-bold px-3 py-1 rounded-full">
            {cluster.name?.toUpperCase() ?? "DEVNET"} · TEST USDC
          </span>
        </div>

        {/* Balance card */}
        <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-1">
            <Coins className="w-5 h-5 text-[#F5E642]" />
            <span className="text-[#888] text-sm">Your Balance</span>
          </div>
          {loadingBalance ? (
            <div className="flex items-center gap-2 mt-2">
              <Loader2 className="w-4 h-4 text-[#888] animate-spin" />
              <span className="text-[#555] text-sm">Fetching balance…</span>
            </div>
          ) : (
            <p className="text-white text-3xl font-bold mt-1">
              {balance !== null ? `${balance.toFixed(2)} USDC` : "—"}
            </p>
          )}
          {walletAddress && (
            <p className="text-[#555] text-xs mt-2 font-mono truncate">
              {walletAddress}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 text-sm text-[#888] space-y-1">
          <p>• Each mint gives you <span className="text-white font-medium">10 USDC</span></p>
          <p>• Session entry costs <span className="text-white font-medium">$3.50 USDC</span></p>
          <p>• Funds are on Solana Devnet and have no real value</p>
          <p>• Limit: 3 mints per hour</p>
        </div>

        {/* Mint button */}
        {mintStatus === "success" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">10 USDC minted!</span>
            </div>
            {txSignature && (
              <a
                href={getExplorerUrl(`tx/${txSignature}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#F5E642] text-xs underline"
              >
                View on Explorer
              </a>
            )}
            <button
              onClick={() => setMintStatus("idle")}
              className="btn-yellow w-full py-4 rounded-xl font-bold text-sm mt-2"
            >
              Mint Again
            </button>
          </div>
        ) : (
          <>
            {mintStatus === "error" && (
              <div className="flex items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <button
              onClick={handleMint}
              disabled={mintStatus === "minting"}
              className="btn-yellow w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {mintStatus === "minting" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Minting…
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4" />
                  Mint 10 USDC
                </>
              )}
            </button>
          </>
        )}

        {/* Link back to arena */}
        <Link
          href="/arena"
          className="text-center text-[#555] text-sm hover:text-[#888] transition-colors"
        >
          Back to Arena
        </Link>
      </div>
    </div>
  );
}
