"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AlertCircle, Coins, ChevronRight, X, CheckCircle2, BarChart3, Trophy } from "lucide-react";
import Link from "next/link";
import MatchupPicker from "@/components/MatchupPicker";
import ProgressBar from "@/components/ProgressBar";

interface MatchupVideo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
}

interface Matchup {
  id: string;
  matchupNumber: number;
  duration: number;
  videoA: MatchupVideo;
  videoB: MatchupVideo;
}

interface RoundState {
  status: string;
  round: number;
  secondsRemaining: number;
  totalRounds: number;
  roundDuration: number;
}

type GamePhase = "confirming" | "joining" | "playing" | "insufficient";

const ENTRY_FEE = process.env.NEXT_PUBLIC_ENTRY_FEE_USDC ?? "3.50";

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
          <p className="text-white font-semibold">Entry Cost: ${ENTRY_FEE} USDC</p>
          <p>
            Joining this session costs{" "}
            <span className="text-white font-medium">${ENTRY_FEE} USDC</span>, which is
            added to the reward pool.
          </p>
          <p>
            You may win up to{" "}
            <span className="text-white font-medium">${ENTRY_FEE} USDC</span> back.
          </p>
        </div>

        <div className="bg-[#0d0d0d] rounded-xl p-4 text-sm text-[#888] space-y-2">
          <p className="text-[#F5E642] font-semibold">How It Works</p>
          <p>
            Each matchup shows two videos. Pick which one will trend — the majority
            vote determines the correct answer.
          </p>
          <p>
            Your accuracy determines your{" "}
            <span className="text-white font-medium">Blind Box tier</span>:
          </p>
          <ul className="space-y-1 pl-2">
            <li>
              🥇 <span className="text-white">Gold</span> — ≥75% correct
            </li>
            <li>
              🥈 <span className="text-white">Base</span> — ≥36% correct
            </li>
            <li>🎟 Participation — &lt;36% correct</li>
          </ul>
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
            <span className="text-white font-medium">${ENTRY_FEE} USDC</span> to join
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
// Synchronized countdown timer
// ---------------------------------------------------------------------------
function SyncedTimer({
  secondsRemaining,
  roundDuration,
  active,
}: {
  secondsRemaining: number;
  roundDuration: number;
  active: boolean;
}) {
  const pct = Math.min(100, (secondsRemaining / roundDuration) * 100);
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
// Round Transition Interstitial
// ---------------------------------------------------------------------------
function RoundTransition({
  completedRound,
  totalRounds,
  pick,
}: {
  completedRound: number;
  totalRounds: number;
  pick: "video_a" | "video_b" | null;
}) {
  const [phase, setPhase] = useState<"tallying" | "done">("tallying");

  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6 anim-fade-in">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        {/* Round badge */}
        <div className="text-[#888] text-xs tracking-wider uppercase">
          Round {completedRound} / {totalRounds}
        </div>

        {/* Animated icon */}
        <div className="relative w-20 h-20">
          {phase === "tallying" ? (
            <div className="w-20 h-20 rounded-full border-4 border-[#F5E642]/30 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-[#F5E642] animate-pulse" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#F5E642]/10 border-4 border-[#F5E642] flex items-center justify-center anim-zoom-in">
              <CheckCircle2 className="w-10 h-10 text-[#F5E642]" />
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-white font-bold text-lg">
            {phase === "tallying" ? "Tallying votes..." : "Vote recorded!"}
          </p>
          {pick && phase === "done" && (
            <p className="text-[#888] text-sm mt-1">
              You picked <span className="text-[#F5E642] font-semibold">{pick === "video_a" ? "Video A" : "Video B"}</span>
            </p>
          )}
          {!pick && phase === "done" && (
            <p className="text-[#888] text-sm mt-1">You didn&apos;t vote this round</p>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < completedRound ? "bg-[#F5E642]" : "bg-[#333]"
              }`}
            />
          ))}
        </div>

        {/* Next round hint */}
        {completedRound < totalRounds && (
          <p className="text-[#555] text-xs animate-pulse">
            Next matchup starting...
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game Over Screen
// ---------------------------------------------------------------------------
function GameOverScreen({ sessionId, totalRounds }: { sessionId: string; totalRounds: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 2400);
    const t3 = setTimeout(() => {
      router.push(`/arena/results?session=${sessionId}`);
    }, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [router, sessionId]);

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6 anim-fade-in">
      <div className="w-full max-w-xs flex flex-col items-center gap-8">
        {/* Trophy */}
        <div className="w-24 h-24 rounded-full bg-[#F5E642]/10 border-4 border-[#F5E642] flex items-center justify-center anim-zoom-in">
          <Trophy className="w-12 h-12 text-[#F5E642]" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-white font-bold text-2xl">Session Complete!</h2>
          <p className="text-[#888] text-sm">
            All <span className="text-white font-semibold">{totalRounds}</span> matchups finished
          </p>
        </div>

        {/* Animated steps */}
        <div className="w-full space-y-3">
          {[
            "Collecting votes from all players...",
            "Calculating majority picks...",
            "Determining your rewards...",
          ].map((text, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 ${step >= i ? "anim-slide-in" : "opacity-0"}`}
              style={step >= i ? { animationDelay: `${i * 100}ms` } : undefined}
            >
              {step > i ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              ) : step === i ? (
                <div className="w-5 h-5 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border border-[#333] flex-shrink-0" />
              )}
              <span className={`text-sm ${step >= i ? "text-white" : "text-[#555]"}`}>
                {text}
              </span>
            </div>
          ))}
        </div>
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
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [voted, setVoted] = useState<"video_a" | "video_b" | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const [defaultRoundDuration, setDefaultRoundDuration] = useState<number | null>(null);
  const [interstitial, setInterstitial] = useState<{
    round: number;
    totalRounds: number;
    pick: "video_a" | "video_b" | null;
  } | null>(null);

  // Track which SSE round we last voted on
  const lastVotedRound = useRef<number>(0);
  const prevRound = useRef<number>(0);
  const lastPick = useRef<"video_a" | "video_b" | null>(null);

  // Fetch matchups list
  const fetchMatchups = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const token = await getAccessToken();
    const res = await fetch(`/api/sessions/${sessionId}/rounds`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setMatchups(data.matchups);
      setDefaultRoundDuration(data.roundDurationSeconds);
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

  // Auto-advance voted state when server round changes — show interstitial
  useEffect(() => {
    if (!roundState) return;
    const serverRound = roundState.round;

    if (serverRound !== prevRound.current) {
      const completedRound = prevRound.current;
      prevRound.current = serverRound;

      // Show interstitial between rounds (skip on first load)
      if (completedRound > 0) {
        setInterstitial({
          round: completedRound,
          totalRounds: roundState.totalRounds,
          pick: lastPick.current,
        });
        setTimeout(() => {
          setInterstitial(null);
          setVoted(null);
          lastPick.current = null;
        }, 3000);
      } else {
        setVoted(null);
      }
    }
  }, [roundState]);

  const confirmJoin = async () => {
    if (!sessionId) return;
    setPhase("joining");

    try {
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

      if (!res.ok && res.status !== 201) {
        console.error("[game] join failed:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[game] join error:", err);
    }

    await fetchMatchups();
    setPhase("playing");
  };

  const handleVote = async (decision: "video_a" | "video_b") => {
    if (decision === voted) return; // same pick, no-op
    const serverRound = roundState?.round ?? 1;

    setVoted(decision);
    lastPick.current = decision;
    lastVotedRound.current = serverRound;

    const currentMatchup = matchups[serverRound - 1];
    if (!currentMatchup) return;

    try {
      const token = await getAccessToken();
      await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          matchupId: currentMatchup.id,
          decision,
        }),
      });
    } catch {
      // Vote submission failed silently
    }
  };

  if (gameOver) {
    return (
      <GameOverScreen
        sessionId={sessionId!}
        totalRounds={roundState?.totalRounds ?? matchups.length}
      />
    );
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

  if (!sessionId || matchups.length === 0) {
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

  if (interstitial) {
    return (
      <RoundTransition
        completedRound={interstitial.round}
        totalRounds={interstitial.totalRounds}
        pick={interstitial.pick}
      />
    );
  }

  const serverRound = roundState?.round ?? 1;
  const roundDuration = roundState?.roundDuration ?? defaultRoundDuration ?? parseInt(process.env.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS ?? "30");
  const secondsRemaining = roundState?.secondsRemaining ?? roundDuration;
  const currentMatchup = matchups[serverRound - 1] ?? matchups[0];
  const totalRounds = roundState?.totalRounds ?? matchups.length;

  return (
    <div className="flex-1 bg-black flex flex-col">
      {/* Top Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#888] text-xs tracking-wider uppercase">
            Matchup {serverRound} / {totalRounds}
          </span>
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] rounded-full px-3 py-1.5 border border-[#2A2A2A]">
            <BarChart3 className="w-4 h-4 text-[#F5E642]" />
            <span className="text-white text-sm font-bold">{serverRound}</span>
            <span className="text-[#555] text-sm">/ {totalRounds}</span>
          </div>
        </div>
        <div className="mb-3">
          <ProgressBar currentStep={serverRound} totalSteps={totalRounds} />
        </div>
        <SyncedTimer secondsRemaining={secondsRemaining} roundDuration={roundDuration} active={voted === null} />
      </div>

      {/* Matchup Area */}
      <div className="flex-1 px-4 py-2 flex flex-col min-h-0">
        <MatchupPicker
          key={currentMatchup.id}
          videoA={currentMatchup.videoA}
          videoB={currentMatchup.videoB}
          onPick={handleVote}
          voted={voted}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
        />
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
