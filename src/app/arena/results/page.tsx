"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft, Share2, Eye, Gift } from "lucide-react";
import Link from "next/link";
import ResultsCard from "@/components/ResultsCard";

interface GameResults {
  correctVotes: number;
  totalVotes: number;
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  nftMinted: boolean;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessToken } = usePrivy();
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const fetchResults = async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/sessions/${sessionId}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setResults(await res.json());
      }
      setLoading(false);
    };

    fetchResults();
  }, [sessionId, getAccessToken]);

  if (loading) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/arena">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">Session Results</h1>
          <p className="text-[#888] text-xs">Your performance</p>
        </div>
      </div>

      {results ? (
        <div className="flex-1 flex flex-col">
          <ResultsCard
            correctVotes={results.correctVotes}
            totalRounds={28}
            tier={results.tier}
            reward={results.rewardAmount}
          />

          {/* Blind Box Preview */}
          <div className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] mt-6 text-center">
            <p className="text-white font-bold mb-2">Blind Box NFT</p>
            {results.nftMinted ? (
              <Link
                href="/rewards"
                className="text-[#F5E642] text-sm underline"
              >
                View in your collection
              </Link>
            ) : results.tier !== "participation" ? (
              <p className="text-[#888] text-sm">
                Your Blind Box will be minted soon!
              </p>
            ) : (
              <p className="text-[#888] text-sm">
                Score 10+ correct to earn a Blind Box
              </p>
            )}
          </div>

          {/* DRiP Collectible */}
          <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-purple-500/20 mt-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Gift className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">You earned a DRiP collectible!</p>
              <p className="text-[#888] text-xs">
                A participation collectible will be distributed to your wallet via DRiP.
              </p>
            </div>
          </div>

          <div className="mt-auto pt-6 space-y-3">
            <button
              onClick={() => {
                navigator.share?.({
                  title: "The Clearance Results",
                  text: `I scored ${results.correctVotes}/28 on The Clearance! ${results.tier === "gold" ? "Gold Tier!" : ""}`,
                });
              }}
              className="w-full bg-[#1A1A1A] rounded-xl py-4 text-sm text-white flex items-center justify-center gap-2 border border-[#2A2A2A]"
            >
              <Share2 className="w-4 h-4" />
              Share Results
            </button>
            <Link
              href="/arena"
              className="btn-yellow w-full rounded-xl py-4 text-base font-bold flex items-center justify-center"
            >
              Back to Arena
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#888] text-sm">No results found for this session.</p>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
