"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AlertCircle, Coins, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import TikTokEmbed from "@/components/TikTokEmbed";
import VoteButtons from "@/components/VoteButtons";
import ScoreTracker from "@/components/ScoreTracker";
import ProgressBar from "@/components/ProgressBar";

interface Round {
  id: string;
  roundNumber: number;
  tiktokUrl: string;
  tiktokEmbedData: { thumbnail_url?: string; author_name?: string } | null;
  duration: number;
}

interface RoundState {
  status: string;
  round: number;
  secondsRemaining: number;
  totalRounds: number;
}

type GamePhase = "confirming" | "joining" | "playing" | "insufficient";

// ---------------------------------------------------------------------------
// Entry Confirmation Modal
// ---------------------------------------------------------------------------
function EntryConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#F5E642]" />
            <span className="text-white font-bold text-lg">Join Session</span>
          </div>
          <button onClick={onCancel} className="text-[#555] hover:text-[#888]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0d0d0d] rounded-xl p-4 text-sm text-[#888] space-y-2">
          <p className="text-white font-semibold">Entry Cost: $3.50 USDC</p>
          <p>
            Joining this session costs{" "}
            <span className="text-white font-medium">$3.50 USDC</span>, which is
            added to the reward pool.
          </p>
          <p>
            You may win up to{" "}
            <span className="text-white font-medium">$3.50 USDC</span> back.
          </p>
        </div>

        <div className="bg-[#0d0d0d] rounded-xl p-4 text-sm text-[#888] space-y-2">
          <p className="text-[#F5E642] font-semibold">How Rewards Work</p>
          <p>
            Your voting accuracy determines your{" "}
            <span className="text-white font-medium">Blind Box tier</span>:
          </p>
          <ul className="space-y-1 pl-2">
            <li>
              🥇 <span className="text-white">Gold</span> — ≥21 correct votes
            </li>
            <li>
              🥈 <span className="text-white">Base</span> — 10–20 correct votes
            </li>
            <li>🎟 Participation — &lt;10 correct votes</li>
          </ul>
          <p className="pt-1">
            A <span className="text-white font-medium">raffle</span> at reveal
            determines your exact reward — keep it a mystery until you open your
            Blind Box.
          </p>
        </div>

        <button
          onClick={onConfirm}
          className="btn-yellow w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
        >
          Confirm &amp; Join <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="text-[#555] text-sm text-center hover:text-[#888] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insufficient Balance Screen
// ---------------------------------------------------------------------------
function InsufficientBalanceScreen() {
  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <div>
          <h2 className="text-white text-xl font-bold mb-2">
            Insufficient Balance
          </h2>
          <p className="text-[#888] text-sm">
            You need at least{" "}
            <span className="text-white font-medium">$3.50 USDC</span> to join
            this session.
          </p>
        </div>
        <Link
          href="/mint"
          className="btn-yellow w-full py-4 rounded-xl font-bold text-sm text-center"
        >
          Get Test USDC →
        </Link>
        <Link
          href="/arena"
          className="text-[#555] text-sm hover:text-[#888] transition-colors"
        >
          Back to Arena
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Synchronized countdown timer (reads from SSE state)
// ---------------------------------------------------------------------------
function SyncedTimer({
  secondsRemaining,
  active,
}: {
  secondsRemaining: number;
  active: boolean;
}) {
  const pct = Math.min(100, (secondsRemaining / 30) * 100);
  const color = secondsRemaining <= 5 ? "#ef4444" : "#F5E642";

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="13" fill="none" stroke="#222" strokeWidth="3" />
          <circle
            cx="16"
            cy="16"
            r="13"
            fill="none"
            stroke={active ? color : "#555"}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
            style={{ transition: "stroke-dashoffset 0.9s linear" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
          style={{ color: active ? color : "#555" }}
        >
          {secondsRemaining}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main game content
// ---------------------------------------------------------------------------
function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessToken } = usePrivy();

  const [phase, setPhase] = useState<GamePhase>("confirming");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [voted, setVoted] = useState<"approve" | "reject" | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalVoted, setTotalVoted] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Track which SSE round we last voted on to handle auto-advance
  const lastVotedRound = useRef<number>(0);
  const prevRound = useRef<number>(0);

  // Fetch rounds list
  const fetchRounds = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/sessions/${sessionId}/rounds`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setRounds(data);
    }
    setLoading(false);
  }, [sessionId, getAccessToken]);

  // Connect to SSE stream after joining
  useEffect(() => {
    if (phase !== "playing" || !sessionId) return;

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);

    es.onmessage = (event) => {
      const data: RoundState = JSON.parse(event.data);
      setRoundState(data);

      if (data.status === "ended") {
        setGameOver(true);
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [phase, sessionId]);

  // Auto-advance voted state when server round changes
  useEffect(() => {
    if (!roundState) return;
    const serverRound = roundState.round;

    if (serverRound !== prevRound.current) {
      prevRound.current = serverRound;
      setVoted(null);
    }
  }, [roundState]);

  // Handle missed vote when timer runs out (server advanced the round)
  useEffect(() => {
    if (!roundState) return;
    const serverRound = roundState.round;

    if (
      roundState.secondsRemaining === 0 &&
      voted === null &&
      serverRound === prevRound.current
    ) {
      setTotalVoted((prev) => prev + 1);
    }
  }, [roundState, voted]);

  const confirmJoin = async () => {
    if (!sessionId) return;
    setPhase("joining");

    const token = await getAccessToken();
    const res = await fetch(`/api/sessions/${sessionId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 400) {
      const data = await res.json();
      if (
        data.error?.toLowerCase().includes("insufficient") ||
        data.error?.toLowerCase().includes("wallet")
      ) {
        setPhase("insufficient");
        return;
      }
    }

    await fetchRounds();
    setPhase("playing");
  };

  const handleVote = async (decision: "approve" | "reject") => {
    if (voted !== null) return;
    const serverRound = roundState?.round ?? 1;
    if (lastVotedRound.current === serverRound) return;

    setVoted(decision);
    lastVotedRound.current = serverRound;
    setTotalVoted((prev) => prev + 1);

    const currentRound = rounds[serverRound - 1];
    if (!currentRound) return;

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
      // Vote submission failed silently
    }
  };

  if (gameOver) {
    router.push(`/arena/results?session=${sessionId}`);
    return null;
  }

  if (phase === "confirming") {
    return (
      <EntryConfirmModal
        onConfirm={confirmJoin}
        onCancel={() => router.push("/arena")}
      />
    );
  }

  if (phase === "insufficient") {
    return <InsufficientBalanceScreen />;
  }

  if (phase === "joining" || loading) {
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

  // Use server-authoritative round, fallback to round 1 while stream connects
  const serverRound = roundState?.round ?? 1;
  const secondsRemaining = roundState?.secondsRemaining ?? 30;
  const currentRound = rounds[serverRound - 1] ?? rounds[0];
  const totalRounds = roundState?.totalRounds ?? rounds.length;

  return (
    <div className="flex-1 bg-black flex flex-col">
      {/* Top Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#888] text-xs tracking-wider uppercase">
            Round {serverRound} / {totalRounds}
          </span>
          <ScoreTracker correct={correctCount} total={totalVoted} />
        </div>
        <div className="mb-3">
          <ProgressBar currentStep={serverRound} totalSteps={totalRounds} />
        </div>
        <SyncedTimer secondsRemaining={secondsRemaining} active={voted === null} />
      </div>

      {/* Video Area */}
      <div className="flex-1 px-4 py-2">
        <TikTokEmbed
          url={currentRound.tiktokUrl}
          thumbnailUrl={currentRound.tiktokEmbedData?.thumbnail_url}
          key={currentRound.id}
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
