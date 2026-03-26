"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Trophy, Star, Award, Package, Send } from "lucide-react";
import { clientEnv } from "@/lib/env";

interface ResultEntry {
  userId: string;
  gameResultId: string;
  displayName: string | null;
  correctVotes: number;
  totalVotes: number;
  tier: string;
  rewardAmount: number;
  nftMinted: boolean;
}

interface ResultSummary {
  sessionId: string;
  sessionTitle: string;
  sessionWeek: number;
  totalParticipants: number;
  tierDistribution: {
    participation: number;
    base: number;
    gold: number;
  };
  results: ResultEntry[];
}

export default function AdminResults() {
  const { getAccessToken } = usePrivy();
  const [data, setData] = useState<ResultSummary | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintProgress, setMintProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [distributing, setDistributing] = useState(false);
  const [dripStatus, setDripStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/stats?type=results", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    };
    fetchResults();
  }, [getAccessToken]);

  const handleBatchMint = async () => {
    if (!data) return;
    const eligible = data.results.filter(
      (r) => !r.nftMinted && r.tier !== "participation"
    );
    if (eligible.length === 0) return;

    setMinting(true);
    setMintProgress({ done: 0, total: eligible.length, errors: 0 });
    const token = await getAccessToken();

    let done = 0;
    let errors = 0;

    for (const result of eligible) {
      try {
        const res = await fetch("/api/nft/mint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gameResultId: result.gameResultId }),
        });
        if (res.ok) {
          result.nftMinted = true;
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
      done++;
      setMintProgress({ done, total: eligible.length, errors });
    }

    setData({ ...data });
    setMinting(false);
  };

  const handleDripDistribute = async () => {
    if (!data?.sessionId) return;
    setDistributing(true);
    setDripStatus(null);

    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/drip/distribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: data.sessionId }),
      });

      const result = await res.json();
      setDripStatus(
        res.ok
          ? `Distributed to ${result.totalParticipants} participants (${result.status})`
          : `Failed: ${result.error}`
      );
    } catch {
      setDripStatus("Network error");
    } finally {
      setDistributing(false);
    }
  };

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-4">Results</h1>
        <p className="text-[#888] text-sm text-center py-8">
          No session results yet.
        </p>
      </div>
    );
  }

  const unmintedCount = data.results.filter(
    (r) => !r.nftMinted && r.tier !== "participation"
  ).length;

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-2">Results</h1>
      <p className="text-[#888] text-sm mb-4">
        {data.sessionTitle} — Week {data.sessionWeek}
      </p>

      {/* Tier Distribution */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#2A2A2A]">
          <Award className="w-5 h-5 text-[#888] mx-auto mb-1" />
          <p className="text-white font-bold text-lg">
            {data.tierDistribution.participation}
          </p>
          <p className="text-[#888] text-[10px]">Participation</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-[#F5E642]/20">
          <Star className="w-5 h-5 text-[#F5E642] mx-auto mb-1" />
          <p className="text-white font-bold text-lg">
            {data.tierDistribution.base}
          </p>
          <p className="text-[#888] text-[10px]">Base (${clientEnv.BASE_REWARD_USDC})</p>
        </div>
        <div className="bg-[#1A1A1A] rounded-xl p-3 text-center border border-yellow-400/20">
          <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-white font-bold text-lg">
            {data.tierDistribution.gold}
          </p>
          <p className="text-[#888] text-[10px]">Gold (${clientEnv.ENTRY_FEE_USDC})</p>
        </div>
      </div>

      {/* NFT Actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleBatchMint}
          disabled={minting || unmintedCount === 0}
          className="flex-1 btn-yellow rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Package className="w-4 h-4" />
          {minting
            ? `Minting ${mintProgress.done}/${mintProgress.total}...`
            : unmintedCount > 0
              ? `Mint NFTs (${unmintedCount} eligible)`
              : "All NFTs Minted"}
        </button>

        <button
          onClick={handleDripDistribute}
          disabled={distributing}
          className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
          {distributing ? "Sending..." : "DRiP Participation"}
        </button>
      </div>

      {mintProgress.errors > 0 && (
        <p className="text-red-400 text-xs mb-3">
          {mintProgress.errors} mint(s) failed. Check console for details.
        </p>
      )}

      {dripStatus && (
        <p className={`text-xs mb-3 ${dripStatus.startsWith("Failed") ? "text-red-400" : "text-green-400"}`}>
          {dripStatus}
        </p>
      )}

      {/* Participant List */}
      <h2 className="text-white font-bold text-sm mb-3">Participants</h2>
      <div className="space-y-2">
        {data.results.map((r) => (
          <div
            key={r.userId}
            className="bg-[#1A1A1A] rounded-xl p-3 border border-[#2A2A2A] flex items-center justify-between"
          >
            <div>
              <p className="text-white text-sm font-medium">
                {r.displayName || "Anonymous"}
              </p>
              <p className="text-[#888] text-xs">
                {r.correctVotes}/{r.totalVotes} correct
                {r.nftMinted && (
                  <span className="ml-2 text-[#F5E642]">NFT minted</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-xs font-bold ${
                  r.tier === "gold"
                    ? "text-yellow-400"
                    : r.tier === "base"
                      ? "text-[#F5E642]"
                      : "text-[#888]"
                }`}
              >
                {r.tier}
              </p>
              {r.rewardAmount > 0 && (
                <p className="text-[#F5E642] text-xs">
                  ${r.rewardAmount.toFixed(2)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
