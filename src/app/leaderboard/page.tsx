"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Eye, Trophy, TrendingUp, Target } from "lucide-react";
import Link from "next/link";
import OnChainLeaderboard from "@/components/OnChainLeaderboard";

interface PlayerRanking {
  rank: number;
  userId: string;
  displayName: string;
  profilePhoto: string | null;
  correctPredictions: number;
  totalVotes: number;
  sessionsPlayed: number;
  winRate: number;
}

const rankBadge = (rank: number) => {
  if (rank === 1) return { bg: "bg-yellow-400", text: "text-black", emoji: "1st" };
  if (rank === 2) return { bg: "bg-gray-300", text: "text-black", emoji: "2nd" };
  if (rank === 3) return { bg: "bg-amber-600", text: "text-white", emoji: "3rd" };
  return { bg: "bg-[#2A2A2A]", text: "text-[#888]", emoji: `${rank}` };
};

export default function LeaderboardPage() {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"platform" | "onchain">("platform");

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then(setRankings)
      .finally(() => setLoading(false));
  }, []);

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
          <h1 className="text-white font-bold text-lg">Player Leaderboard</h1>
          <p className="text-[#888] text-xs">Top predictors this season</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("platform")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === "platform"
              ? "bg-[#F5E642] text-black"
              : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          }`}
        >
          Platform Rankings
        </button>
        <button
          onClick={() => setTab("onchain")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === "onchain"
              ? "bg-[#F5E642] text-black"
              : "bg-[#1A1A1A] text-[#888] border border-[#2A2A2A]"
          }`}
        >
          On-Chain Rankings
        </button>
      </div>

      {tab === "onchain" ? (
        <OnChainLeaderboard />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-16 h-16 text-[#555] mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">No Rankings Yet</h2>
          <p className="text-[#888] text-sm">
            Rankings appear after the first session is finalized.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {rankings.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 mb-8">
              {[rankings[1], rankings[0], rankings[2]].map((player, i) => {
                const isCenter = i === 1;
                return (
                  <div
                    key={player.userId}
                    className={`flex flex-col items-center ${isCenter ? "-mt-4" : "mt-2"}`}
                  >
                    <div
                      className={`w-14 h-14 ${isCenter ? "w-18 h-18" : ""} rounded-full border-2 ${
                        player.rank === 1
                          ? "border-yellow-400"
                          : player.rank === 2
                            ? "border-gray-300"
                            : "border-amber-600"
                      } overflow-hidden bg-[#1A1A1A] flex items-center justify-center mb-2`}
                    >
                      {player.profilePhoto ? (
                        <img
                          src={player.profilePhoto}
                          alt={player.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#888] font-bold text-lg">
                          {player.displayName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-white text-xs font-bold text-center truncate w-full">
                      {player.displayName}
                    </p>
                    <p className="text-[#F5E642] text-xs font-bold">
                      {player.correctPredictions} correct
                    </p>
                    <div
                      className={`mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        rankBadge(player.rank).bg
                      } ${rankBadge(player.rank).text}`}
                    >
                      {rankBadge(player.rank).emoji}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full List */}
          <div className="space-y-2">
            {rankings.map((player) => {
              const badge = rankBadge(player.rank);
              return (
                <div
                  key={player.userId}
                  className={`bg-[#1A1A1A] rounded-xl p-4 border ${
                    player.rank <= 3 ? "border-[#F5E642]/20" : "border-[#2A2A2A]"
                  } flex items-center gap-3`}
                >
                  {/* Rank */}
                  <div
                    className={`w-8 h-8 rounded-full ${badge.bg} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className={`text-xs font-bold ${badge.text}`}>
                      {badge.emoji}
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#2A2A2A] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {player.profilePhoto ? (
                      <img
                        src={player.profilePhoto}
                        alt={player.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[#555] font-bold">
                        {player.displayName.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">
                      {player.displayName}
                    </p>
                    <p className="text-[#888] text-xs">
                      {player.sessionsPlayed} session{player.sessionsPlayed !== 1 ? "s" : ""} played
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-[#F5E642]" />
                        <span className="text-white text-sm font-bold">
                          {player.correctPredictions}
                        </span>
                      </div>
                      <p className="text-[#555] text-[10px]">correct</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-green-400" />
                        <span className="text-white text-sm font-bold">
                          {player.winRate}%
                        </span>
                      </div>
                      <p className="text-[#555] text-[10px]">win rate</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
