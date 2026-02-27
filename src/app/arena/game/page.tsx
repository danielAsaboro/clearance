"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import TikTokEmbed from "@/components/TikTokEmbed";
import VoteButtons from "@/components/VoteButtons";
import RoundTimer from "@/components/RoundTimer";
import ScoreTracker from "@/components/ScoreTracker";
import ProgressBar from "@/components/ProgressBar";

interface Round {
  id: string;
  roundNumber: number;
  tiktokUrl: string;
  tiktokEmbedData: { thumbnail_url?: string; author_name?: string } | null;
  duration: number;
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessToken } = usePrivy();

  const [rounds, setRounds] = useState<Round[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [voted, setVoted] = useState<"approve" | "reject" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalVoted, setTotalVoted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchRounds = async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/sessions/${sessionId}/rounds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRounds(data);
      }
      setLoading(false);
    };

    const joinSession = async () => {
      const token = await getAccessToken();
      await fetch(`/api/sessions/${sessionId}/join`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    };

    joinSession();
    fetchRounds();
  }, [sessionId, getAccessToken]);

  const advanceRound = useCallback(() => {
    if (currentRoundIndex >= rounds.length - 1) {
      setGameOver(true);
      return;
    }
    setCurrentRoundIndex((prev) => prev + 1);
    setVoted(null);
  }, [currentRoundIndex, rounds.length]);

  const handleVote = async (decision: "approve" | "reject") => {
    setVoted(decision);
    setTotalVoted((prev) => prev + 1);

    const currentRound = rounds[currentRoundIndex];
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roundId: currentRound.id,
          decision,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.correct) {
          setCorrectCount((prev) => prev + 1);
        }
      }
    } catch {
      // Vote submission failed
    }

    // Auto-advance after 1.5s
    setTimeout(advanceRound, 1500);
  };

  const handleTimerExpire = useCallback(() => {
    if (voted === null) {
      // Missed vote = incorrect
      setTotalVoted((prev) => prev + 1);
      advanceRound();
    }
  }, [voted, advanceRound]);

  if (loading) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sessionId || rounds.length === 0) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
        <p className="text-[#888] text-sm mb-4">No active session found.</p>
        <button
          onClick={() => router.push("/arena")}
          className="btn-yellow px-6 py-3 rounded-xl font-bold text-sm"
        >
          Back to Arena
        </button>
      </div>
    );
  }

  if (gameOver) {
    router.push(`/arena/results?session=${sessionId}`);
    return null;
  }

  const currentRound = rounds[currentRoundIndex];

  return (
    <div className="flex-1 bg-black flex flex-col">
      {/* Top Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#888] text-xs tracking-wider uppercase">
            Round {currentRound.roundNumber} / {rounds.length}
          </span>
          <ScoreTracker correct={correctCount} total={totalVoted} />
        </div>
        <div className="mb-3">
          <ProgressBar currentStep={currentRoundIndex + 1} totalSteps={rounds.length} />
        </div>
        <RoundTimer
          duration={currentRound.duration}
          onExpire={handleTimerExpire}
          active={voted === null}
          key={currentRound.id}
        />
      </div>

      {/* Video Area */}
      <div className="flex-1 px-4 py-2">
        <TikTokEmbed
          url={currentRound.tiktokUrl}
          thumbnailUrl={currentRound.tiktokEmbedData?.thumbnail_url}
        />
      </div>

      {/* Creator Info */}
      {currentRound.tiktokEmbedData?.author_name && (
        <div className="px-4 mb-2">
          <p className="text-white font-bold text-sm">
            @{currentRound.tiktokEmbedData.author_name}
          </p>
        </div>
      )}

      {/* Vote Buttons */}
      <div className="px-4 pb-6">
        <VoteButtons onVote={handleVote} voted={voted} />
      </div>
    </div>
  );
}

export default function ArenaGame() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
