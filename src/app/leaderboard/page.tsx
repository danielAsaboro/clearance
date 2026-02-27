"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Eye, Trophy, TrendingUp, ThumbsUp, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import OnChainLeaderboard from "@/components/OnChainLeaderboard";

interface CreatorRanking {
  rank: number;
  userId: string;
  displayName: string;
  tiktokUsername: string;
  profilePhoto: string | null;
  approvedVideos: number;
  totalVideos: number;
  approvalRate: number;
  fanVotesReceived: number;
  weekNumbers: number[];
  walletAddress?: string | null;
  followerCount?: number;
}

const rankBadge = (rank: number) => {
  if (rank === 1) return { bg: "bg-yellow-400", text: "text-black", emoji: "1st" };
  if (rank === 2) return { bg: "bg-gray-300", text: "text-black", emoji: "2nd" };
  if (rank === 3) return { bg: "bg-amber-600", text: "text-white", emoji: "3rd" };
  return { bg: "bg-[#2A2A2A]", text: "text-[#888]", emoji: `${rank}` };
};

export default function LeaderboardPage() {
  const { authenticated, getAccessToken } = usePrivy();
  const [rankings, setRankings] = useState<CreatorRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"platform" | "onchain">("platform");
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/creators/leaderboard")
      .then((res) => res.json())
      .then(setRankings)
      .finally(() => setLoading(false));
  }, []);

  const handleFollow = async (creatorWallet: string) => {
    if (!authenticated || !creatorWallet) return;
    setFollowLoading(creatorWallet);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/social/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ creatorWallet }),
      });
      if (res.ok) {
        setFollowingSet((prev) => new Set([...prev, creatorWallet]));
        setRankings((prev) =>
          prev.map((c) =>
            c.walletAddress === creatorWallet
              ? { ...c, followerCount: (c.followerCount ?? 0) + 1 }
              : c
          )
        );
      }
    } catch {
      // Non-fatal
    } finally {
      setFollowLoading(null);
    }
  };

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
          <h1 className="text-white font-bold text-lg">Creator Leaderboard</h1>
          <p className="text-[#888] text-xs">Who&apos;s trending this season</p>
        </div>
      </div>

      {/* Tab Toggle: Platform vs On-Chain */}
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
            Rankings appear after the first session is judged.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium */}
          {rankings.length >= 3 && (
            <div className="grid grid-cols-3 gap-2 mb-8">
              {[rankings[1], rankings[0], rankings[2]].map((creator, i) => {
                const isCenter = i === 1;
                return (
                  <div
                    key={creator.userId}
                    className={`flex flex-col items-center ${isCenter ? "-mt-4" : "mt-2"}`}
                  >
                    <div
                      className={`w-14 h-14 ${isCenter ? "w-18 h-18" : ""} rounded-full border-2 ${
                        creator.rank === 1
                          ? "border-yellow-400"
                          : creator.rank === 2
                            ? "border-gray-300"
                            : "border-amber-600"
                      } overflow-hidden bg-[#1A1A1A] flex items-center justify-center mb-2`}
                    >
                      {creator.profilePhoto ? (
                        <img
                          src={creator.profilePhoto}
                          alt={creator.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[#888] font-bold text-lg">
                          {creator.displayName.charAt(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-white text-xs font-bold text-center truncate w-full">
                      {creator.displayName}
                    </p>
                    <p className="text-[#F5E642] text-xs font-bold">
                      {creator.approvedVideos} approved
                    </p>
                    <div
                      className={`mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        rankBadge(creator.rank).bg
                      } ${rankBadge(creator.rank).text}`}
                    >
                      {rankBadge(creator.rank).emoji}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full List */}
          <div className="space-y-2">
            {rankings.map((creator) => {
              const badge = rankBadge(creator.rank);
              return (
                <div
                  key={creator.userId}
                  className={`bg-[#1A1A1A] rounded-xl p-4 border ${
                    creator.rank <= 3 ? "border-[#F5E642]/20" : "border-[#2A2A2A]"
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
                    {creator.profilePhoto ? (
                      <img
                        src={creator.profilePhoto}
                        alt={creator.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[#555] font-bold">
                        {creator.displayName.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm truncate">
                      {creator.displayName}
                    </p>
                    <p className="text-[#888] text-xs">@{creator.tiktokUsername}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3 text-[#F5E642]" />
                        <span className="text-white text-sm font-bold">
                          {creator.approvedVideos}
                        </span>
                      </div>
                      <p className="text-[#555] text-[10px]">approved</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        <span className="text-white text-sm font-bold">
                          {creator.followerCount ?? 0}
                        </span>
                      </div>
                      <p className="text-[#555] text-[10px]">followers</p>
                    </div>
                    {authenticated && creator.walletAddress && !followingSet.has(creator.walletAddress) && (
                      <button
                        onClick={() => handleFollow(creator.walletAddress!)}
                        disabled={followLoading === creator.walletAddress}
                        className="flex items-center gap-1 bg-[#F5E642] text-black px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#e6d73b] transition-colors disabled:opacity-50"
                      >
                        <UserPlus className="w-3 h-3" />
                        {followLoading === creator.walletAddress ? "..." : "Follow"}
                      </button>
                    )}
                    {authenticated && creator.walletAddress && followingSet.has(creator.walletAddress) && (
                      <span className="text-green-400 text-xs font-bold px-2">Following</span>
                    )}
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
