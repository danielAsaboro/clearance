"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { Connection } from "@solana/web3.js";
import { ArrowLeft, Eye, Gift, Link2, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import BlindBoxCard from "@/components/BlindBoxCard";
import ConnectWallet from "@/components/ConnectWallet";
import LoyaltyBadges from "@/components/LoyaltyBadges";
import { useCluster, getPrivySolanaChain } from "@/components/cluster/cluster-data-access";

interface GameResultNFT {
  id: string;
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  nftMinted: boolean;
  nftTokenId: string | null;
  nftRevealed: boolean;
  usdcClaimed: boolean;
  claimTxHash: string | null;
  session: { title: string; weekNumber: number };
}

type RaffleStatus = "idle" | "requesting" | "polling" | "resolved";

const solanaConnection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);

export default function RewardsPage() {
  const { getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { cluster } = useCluster();
  const [results, setResults] = useState<GameResultNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [raffleStatus, setRaffleStatus] = useState<Record<string, RaffleStatus>>({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    const fetchRewards = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        const resultsRes = await fetch(`/api/users/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resultsRes.ok) {
          const userData = await resultsRes.json();
          setResults(userData.gameResults || []);
        }
      }
      setLoading(false);
    };
    fetchRewards();
  }, [getAccessToken]);

  // Cleanup poll timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  const pollRaffleStatus = useCallback(
    (gameResultId: string) => {
      // Clear any existing poll for this result
      if (pollTimers.current[gameResultId]) {
        clearInterval(pollTimers.current[gameResultId]);
      }

      pollTimers.current[gameResultId] = setInterval(async () => {
        try {
          const token = await getAccessToken();
          const res = await fetch(
            `/api/nft/raffle/status?gameResultId=${gameResultId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) return;

          const { resolved, rewardAmount } = await res.json();
          if (resolved) {
            clearInterval(pollTimers.current[gameResultId]);
            delete pollTimers.current[gameResultId];

            setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "resolved" }));
            setResults((prev) =>
              prev.map((r) =>
                r.id === gameResultId ? { ...r, rewardAmount } : r
              )
            );
          }
        } catch {
          // continue polling
        }
      }, 3000);
    },
    [getAccessToken]
  );

  const handleOpenBox = async (gameResultId: string) => {
    const wallet = solanaWallets[0];
    if (!wallet) {
      alert("No Solana wallet connected. Please connect a wallet first.");
      return;
    }

    setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "requesting" }));

    try {
      const token = await getAccessToken();

      // 1. Get partially-signed raffle tx from server
      const res = await fetch("/api/nft/raffle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameResultId }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        alert(error || "Failed to start raffle. Please try again.");
        setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "idle" }));
        return;
      }

      const { unsignedTx } = await res.json();

      // 2. Fan signs the tx
      const txBytes = Uint8Array.from(Buffer.from(unsignedTx, "base64"));

      const { signedTransaction } = await signTransaction({
        transaction: txBytes,
        wallet,
        chain: getPrivySolanaChain(cluster),
      });

      // 3. Submit to Solana
      await solanaConnection.sendRawTransaction(signedTransaction, {
        skipPreflight: false,
      });

      // 4. Start polling for VRF resolution
      setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "polling" }));
      pollRaffleStatus(gameResultId);
    } catch (err) {
      console.error("Open box failed:", err);
      alert("Failed to open box. Please try again.");
      setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "idle" }));
    }
  };

  const handleReveal = async (gameResultId: string) => {
    const token = await getAccessToken();
    const res = await fetch("/api/nft/reveal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ gameResultId }),
    });

    if (res.ok) {
      const { rewardAmount } = await res.json();
      setResults((prev) =>
        prev.map((r) =>
          r.id === gameResultId ? { ...r, nftRevealed: true, rewardAmount } : r
        )
      );
      setRaffleStatus((prev) => {
        const next = { ...prev };
        delete next[gameResultId];
        return next;
      });
    }
  };

  const handleClaim = async (gameResultId: string) => {
    const wallet = solanaWallets[0];
    if (!wallet) {
      alert("No Solana wallet connected. Please connect a wallet first.");
      return;
    }

    try {
      const token = await getAccessToken();

      // 1. Get partially-signed tx from server
      const res = await fetch("/api/nft/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameResultId }),
      });

      if (res.status === 409) {
        const { claimTxHash } = await res.json();
        setResults((prev) =>
          prev.map((r) =>
            r.id === gameResultId
              ? { ...r, usdcClaimed: true, claimTxHash }
              : r
          )
        );
        return;
      }

      if (!res.ok) {
        const { error } = await res.json();
        alert(error || "Claim failed. Please try again.");
        return;
      }

      const { transaction } = await res.json();

      // 2. Deserialize and sign with user's wallet
      const txBytes = Uint8Array.from(
        Buffer.from(transaction, "base64")
      );

      const { signedTransaction } = await signTransaction({
        transaction: txBytes,
        wallet,
        chain: getPrivySolanaChain(cluster),
      });

      // 3. Send signed tx to the network
      const txHash = await solanaConnection.sendRawTransaction(
        signedTransaction,
        { skipPreflight: false }
      );

      // 4. Confirm with backend
      await fetch("/api/nft/claim/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameResultId, txHash }),
      });

      setResults((prev) =>
        prev.map((r) =>
          r.id === gameResultId
            ? { ...r, usdcClaimed: true, claimTxHash: txHash }
            : r
        )
      );
    } catch (err) {
      console.error("Claim failed:", err);
      alert("Claim failed. Please try again.");
    }
  };

  const mintedResults = results.filter(
    (r) => r.nftMinted && (r.tier === "base" || r.tier === "gold")
  );

  return (
    <div className="flex-1 bg-black px-6 py-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">My Rewards</h1>
          <p className="text-[#888] text-xs">Blind Box Collection</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <ConnectWallet />
      </div>

      {/* Loyalty Progress — Torque */}
      <LoyaltyBadges />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : mintedResults.length === 0 ? (
        <div className="text-center py-16">
          <Gift className="w-16 h-16 text-[#555] mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">No Blind Boxes Yet</h2>
          <p className="text-[#888] text-sm mb-6">
            Participate in live sessions and score 10+ to earn Blind Box NFTs!
          </p>
          <Link
            href="/arena"
            className="btn-yellow inline-block px-6 py-3 rounded-xl font-bold text-sm"
          >
            Go to Arena
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6">
            {mintedResults.map((result) => {
              const status = raffleStatus[result.id] ?? "idle";
              const needsRaffle = !result.nftRevealed && status === "idle";
              const isPolling = status === "polling";
              const isRequesting = status === "requesting";
              const isResolved = status === "resolved";

              return (
                <div key={result.id}>
                  <p className="text-[#888] text-xs mb-2">
                    {result.session?.title || "Session"} — Week{" "}
                    {result.session?.weekNumber}
                  </p>

                  {/* Polling overlay */}
                  {(isRequesting || isPolling) && (
                    <div className="mb-3 bg-[#1A1A1A] rounded-xl p-4 border border-[#F5E642]/20 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-[#F5E642] animate-spin" />
                      <div>
                        <p className="text-white text-sm font-medium">
                          {isRequesting
                            ? "Submitting raffle transaction..."
                            : "Resolving randomness on-chain..."}
                        </p>
                        <p className="text-[#888] text-xs">
                          {isPolling && "This usually takes ~3 seconds"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Resolved — show reward + "Reveal" button */}
                  {isResolved && !result.nftRevealed && (
                    <div className="mb-3 bg-[#1A1A1A] rounded-xl p-4 border border-green-500/20">
                      <p className="text-green-400 text-sm font-medium mb-2">
                        Raffle resolved! Your reward: ${result.rewardAmount.toFixed(2)} USDC
                      </p>
                      <button
                        onClick={() => handleReveal(result.id)}
                        className="btn-yellow w-full py-2.5 rounded-xl font-bold text-sm"
                      >
                        Reveal NFT
                      </button>
                    </div>
                  )}

                  {/* "Open Box" button — before raffle */}
                  {needsRaffle && (
                    <div className="mb-3">
                      <button
                        onClick={() => handleOpenBox(result.id)}
                        className="btn-yellow w-full py-3 rounded-xl font-bold text-sm"
                      >
                        Open Box
                      </button>
                    </div>
                  )}

                  <BlindBoxCard
                    gameResultId={result.id}
                    tier={result.tier as "base" | "gold"}
                    rewardAmount={result.rewardAmount}
                    revealed={result.nftRevealed}
                    tokenId={result.nftTokenId}
                    onReveal={handleReveal}
                    usdcClaimed={result.usdcClaimed}
                    claimTxHash={result.claimTxHash}
                    onClaim={handleClaim}
                  />
                  {/* Share Claim Link as Blink */}
                  {result.nftRevealed && !result.usdcClaimed && (
                    <button
                      onClick={() => {
                        const origin = window.location.origin;
                        const actionUrl = `${origin}/api/actions/claim?result=${result.id}`;
                        const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
                        navigator.clipboard.writeText(blinkUrl);
                        alert("Claim Blink URL copied!");
                      }}
                      className="mt-2 w-full bg-[#1A1A1A] rounded-xl py-2.5 text-xs text-white flex items-center justify-center gap-2 border border-[#2A2A2A] hover:border-[#F5E642]/30 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#F5E642]" />
                      Share Claim Link
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* DRiP Collectibles Section */}
          <div className="mt-8 bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-bold text-sm">DRiP Collectibles</h3>
              <span className="ml-auto text-xs text-[#888] bg-[#2A2A2A] px-2 py-0.5 rounded-full">
                Powered by DRiP
              </span>
            </div>
            <p className="text-[#888] text-sm mb-3">
              Participation collectibles are distributed as compressed NFTs after each session via DRiP.
            </p>
            <a
              href="https://drip.haus"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-purple-400 text-sm hover:text-purple-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View DRiP Channel
            </a>
          </div>
        </>
      )}
    </div>
  );
}
