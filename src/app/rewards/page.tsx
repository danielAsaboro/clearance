"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { Connection } from "@solana/web3.js";
import { ArrowLeft, Eye, Gift, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import ConnectWallet from "@/components/ConnectWallet";
import { useCluster, getPrivySolanaChain } from "@/components/cluster/cluster-data-access";
import { clientEnv } from "@/lib/env";

interface GameResultReward {
  id: string;
  sessionId: string;
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  depositConfirmed: boolean;
  usdcClaimed: boolean;
  claimTxHash: string | null;
  session: { title: string; weekNumber: number; status: string };
}

const solanaConnection = new Connection(
  clientEnv.SOLANA_RPC_URL,
  "confirmed"
);

export default function RewardsPage() {
  const { getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { cluster } = useCluster();
  const [results, setResults] = useState<GameResultReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchRewards = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/users/me/history?limit=50", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.games || []);
      }
      setLoading(false);
    };
    fetchRewards();
  }, [getAccessToken]);

  const handleClaim = useCallback(
    async (result: GameResultReward) => {
      const wallet = solanaWallets[0];
      if (!wallet) {
        alert("No Solana wallet connected. Please connect a wallet first.");
        return;
      }

      setClaiming((prev) => ({ ...prev, [result.id]: true }));

      try {
        const token = await getAccessToken();

        // 1. Get claim + withdraw txs from server
        const res = await fetch(`/api/sessions/${result.sessionId}/withdraw`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 409) {
          const { claimTxHash } = await res.json();
          setResults((prev) =>
            prev.map((r) =>
              r.id === result.id ? { ...r, usdcClaimed: true, claimTxHash } : r
            )
          );
          return;
        }

        if (!res.ok) {
          const { error } = await res.json();
          alert(error || "Claim failed. Please try again.");
          return;
        }

        const { claimTransaction, withdrawTransaction } = await res.json();

        // 2. Sign and send claim_reward tx (vault → PDA ATA)
        const claimBytes = Uint8Array.from(Buffer.from(claimTransaction, "base64"));
        const { signedTransaction: signedClaim } = await signTransaction({
          transaction: claimBytes,
          wallet,
          chain: getPrivySolanaChain(cluster),
        });
        const claimTxHash = await solanaConnection.sendRawTransaction(signedClaim, {
          skipPreflight: false,
        });
        // Wait for claim to confirm before withdrawing
        await solanaConnection.confirmTransaction(claimTxHash, "confirmed");

        // 3. Sign and send withdraw tx (PDA ATA → wallet)
        let txHash = claimTxHash;
        try {
          const withdrawBytes = Uint8Array.from(Buffer.from(withdrawTransaction, "base64"));
          const { signedTransaction: signedWithdraw } = await signTransaction({
            transaction: withdrawBytes,
            wallet,
            chain: getPrivySolanaChain(cluster),
          });
          txHash = await solanaConnection.sendRawTransaction(signedWithdraw, {
            skipPreflight: false,
          });
        } catch (withdrawErr) {
          console.error("[rewards] withdraw failed, funds safe in PDA:", withdrawErr);
          // Claim succeeded — funds are in PDA ATA, user can withdraw later
        }

        // 4. Confirm with backend
        await fetch(`/api/sessions/${result.sessionId}/confirm-withdraw`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ txSignature: txHash }),
        });

        setResults((prev) =>
          prev.map((r) =>
            r.id === result.id ? { ...r, usdcClaimed: true, claimTxHash: txHash } : r
          )
        );
      } catch (err) {
        console.error("Claim failed:", err);
        alert("Claim failed. Please try again.");
      } finally {
        setClaiming((prev) => ({ ...prev, [result.id]: false }));
      }
    },
    [getAccessToken, signTransaction, solanaWallets, cluster]
  );

  const claimableResults = results.filter(
    (r) =>
      r.depositConfirmed &&
      r.rewardAmount > 0 &&
      r.session.status === "ended"
  );

  const noRewardResults = results.filter(
    (r) => !r.depositConfirmed || r.rewardAmount <= 0
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
          <p className="text-[#888] text-xs">Pool Rewards</p>
        </div>
      </div>

      {/* Wallet */}
      <div className="mb-6">
        <ConnectWallet />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : claimableResults.length === 0 && noRewardResults.length === 0 ? (
        <div className="text-center py-16">
          <Gift className="w-16 h-16 text-[#555] mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">No Rewards Yet</h2>
          <p className="text-[#888] text-sm mb-6">
            Play a live session and deposit to earn pool rewards!
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
          {claimableResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-sm">Claimable Rewards</h3>
              {claimableResults.map((result) => (
                <div
                  key={result.id}
                  className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]"
                >
                  <p className="text-[#888] text-xs mb-1">
                    {result.session?.title || "Session"} — Week{" "}
                    {result.session?.weekNumber}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <p className="text-white font-bold text-lg">
                        ${result.rewardAmount.toFixed(2)} USDC
                      </p>
                      <p className="text-[#888] text-xs capitalize">
                        {result.tier} tier
                      </p>
                    </div>

                    {result.usdcClaimed ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-green-400 text-sm font-medium">Claimed</span>
                        {result.claimTxHash && (
                          <a
                            href={`https://explorer.solana.com/tx/${result.claimTxHash}?cluster=${clientEnv.SOLANA_NETWORK}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[#F5E642] text-xs hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View tx
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleClaim(result)}
                        disabled={claiming[result.id]}
                        className="btn-yellow px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
                      >
                        {claiming[result.id] ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming...
                          </>
                        ) : (
                          `Claim $${result.rewardAmount.toFixed(2)}`
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {noRewardResults.length > 0 && (
            <div className="mt-8">
              <h3 className="text-white font-bold text-sm mb-4">Past Sessions</h3>
              <div className="grid grid-cols-1 gap-4">
                {noRewardResults.map((result) => (
                  <div
                    key={result.id}
                    className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]"
                  >
                    <p className="text-[#888] text-xs mb-1">
                      {result.session?.title || "Session"} — Week{" "}
                      {result.session?.weekNumber}
                    </p>
                    <p className="text-white font-bold text-sm">
                      {!result.depositConfirmed
                        ? "No deposit — played for free"
                        : "No reward earned"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
