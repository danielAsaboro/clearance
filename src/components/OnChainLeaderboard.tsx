"use client";

import { useState, useEffect } from "react";
import { Shield, ExternalLink } from "lucide-react";

interface SoarScore {
  wallet: string;
  score: number;
  rank: number;
}

export default function OnChainLeaderboard() {
  const [scores, setScores] = useState<SoarScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/soar")
      .then((res) => res.json())
      .then((data) => setScores(data.scores ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-[#555] mx-auto mb-3" />
        <p className="text-white font-bold mb-1">No On-Chain Scores Yet</p>
        <p className="text-[#888] text-sm">
          Scores are submitted on-chain after sessions are judged.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {scores.map((entry) => (
        <div
          key={entry.wallet}
          className={`bg-[#1A1A1A] rounded-xl p-4 border ${
            entry.rank <= 3 ? "border-[#F5E642]/20" : "border-[#2A2A2A]"
          } flex items-center gap-3`}
        >
          {/* Rank */}
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              entry.rank === 1
                ? "bg-yellow-400"
                : entry.rank === 2
                  ? "bg-gray-300"
                  : entry.rank === 3
                    ? "bg-amber-600"
                    : "bg-[#2A2A2A]"
            }`}
          >
            <span
              className={`text-xs font-bold ${
                entry.rank <= 3 ? "text-black" : "text-[#888]"
              }`}
            >
              {entry.rank}
            </span>
          </div>

          {/* Wallet */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-mono text-sm truncate">
              {entry.wallet.slice(0, 4)}...{entry.wallet.slice(-4)}
            </p>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[#F5E642] font-bold">{entry.score}</span>
            <span className="text-[#555] text-xs">pts</span>
          </div>

          {/* Verified badge */}
          <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full flex-shrink-0">
            <Shield className="w-3 h-3 text-green-400" />
            <span className="text-green-400 text-[10px] font-bold">
              On-Chain
            </span>
          </div>

          {/* Explorer link */}
          <a
            href={`https://explorer.solana.com/address/${entry.wallet}${(process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") === "mainnet-beta" ? "" : `?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"}`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#555] hover:text-[#888] transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ))}
    </div>
  );
}
