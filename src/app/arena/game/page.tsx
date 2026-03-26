"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { AlertCircle, User } from "lucide-react";
import Link from "next/link";
import MatchupPicker from "@/components/MatchupPicker";
import ProgressBar from "@/components/ProgressBar";

interface MatchupVideo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  uploadedBy?: { displayName: string | null } | null;
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

interface RoundResults {
  videoAPercent: number;
  videoBPercent: number;
  winner: "video_a" | "video_b";
  userCorrect: boolean;
  correctCount: number;
}

type GamePhase = "joining" | "playing" | "insufficient";

const ENTRY_FEE = process.env.NEXT_PUBLIC_ENTRY_FEE_USDC!;

const GUEST_TOKEN_KEY = "spotr_guest_token";
const GUEST_NAME_KEY = "spotr_guest_name";

function getStoredGuestToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GUEST_TOKEN_KEY);
}

function storeGuestSession(token: string, name: string) {
  localStorage.setItem(GUEST_TOKEN_KEY, token);
  localStorage.setItem(GUEST_NAME_KEY, name);
}

function InsufficientBalanceScreen() {
  return (
    <div className="spotr-page flex flex-1 flex-col items-center justify-center px-5">
      <div className="spotr-mobile-shell flex flex-col items-center gap-5 text-center">
        <AlertCircle className="h-11 w-11 text-[#eb5a52]" />
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.04em] text-white">Insufficient Balance</h2>
          <p className="mt-2 text-[14px] leading-5 text-[#888]">
            You need at least <span className="font-semibold text-white">${ENTRY_FEE} USDC</span> to join this session.
          </p>
        </div>
        <Link href="/mint" className="spotr-primary-button flex w-full items-center justify-center">
          Get Test USDC
        </Link>
        <Link href="/arena" className="text-[14px] text-[#666]">
          Back to Arena
        </Link>
      </div>
    </div>
  );
}

function CountdownRing({ duration, onExpire }: { duration: number; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const expiredRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire();
    }
  }, [timeLeft, onExpire]);

  const size = 34;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = duration > 0 ? timeLeft / duration : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#373737" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f5d63d"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold text-white">
        {timeLeft}
      </div>
    </div>
  );
}

function RoundResultOverlay({
  correct,
  videoAPercent,
  videoBPercent,
  winner,
  correctCount,
  completedRound,
  onExpire,
}: {
  correct: boolean;
  videoAPercent: number;
  videoBPercent: number;
  winner: "video_a" | "video_b";
  correctCount: number;
  completedRound: number;
  onExpire: () => void;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/72 px-5 anim-fade-in">
      <div className="w-full max-w-[280px] overflow-hidden rounded-[18px] bg-[#171717] shadow-[0_40px_80px_rgba(0,0,0,0.7)]">
        <div className={`h-[5px] w-full ${correct ? "bg-[#45ca61]" : "bg-[#eb5a52]"}`} />
        <div className="px-4 py-5">
          <p className="text-center text-[18px] font-semibold tracking-[-0.04em] text-white">
            {correct ? "CORRECT!" : "MISSED."}
          </p>
          <p className="mt-1 text-center text-[13px] text-[#818181]">
            {correct ? "You spotted the trend." : "The crowd went the other way."}
          </p>

          <div className="mt-5 space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-[13px] text-white">
                <span>
                  Video A {winner === "video_a" ? "👑" : ""}
                </span>
                <span className="font-semibold text-[#d7bb39]">{videoAPercent}%</span>
              </div>
              <div className="spotr-progress-track h-[7px]">
                <div
                  className="h-full rounded-full bg-[#f5d63d]"
                  style={{
                    width: animated ? `${videoAPercent}%` : "0%",
                    transition: "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[13px] text-white">
                <span>
                  Video B {winner === "video_b" ? "👑" : ""}
                </span>
                <span className="font-semibold text-[#d7bb39]">{videoBPercent}%</span>
              </div>
              <div className="spotr-progress-track h-[7px]">
                <div
                  className="h-full rounded-full bg-[#f5d63d]"
                  style={{
                    width: animated ? `${videoBPercent}%` : "0%",
                    transition: "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="rounded-full bg-[#222] px-4 py-2 text-[12px] font-medium text-[#9a9a9a]">
              {correctCount} / {completedRound} correct this session
            </div>
            <CountdownRing duration={5} onExpire={onExpire} />
          </div>
        </div>
      </div>
    </div>
  );
}

function GameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessToken, authenticated } = usePrivy();
  const isSample = searchParams.get("sample") === "true";
  const isReplay = searchParams.get("replay") === "true";
  const [phase, setPhase] = useState<GamePhase>("joining");
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [voted, setVoted] = useState<"video_a" | "video_b" | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const [defaultRoundDuration, setDefaultRoundDuration] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [interstitial, setInterstitial] = useState<(RoundResults & { completedRound: number }) | null>(null);
  const [displayedRound, setDisplayedRound] = useState(1);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [asyncReplay, setAsyncReplay] = useState(false);

  const prevStatusRef = useRef<string>("");
  const completedRoundRef = useRef(0);
  const redirectScheduled = useRef(false);
  const guestTokenRef = useRef<string | null>(getStoredGuestToken());
  const roundStartRef = useRef<number>(Date.now());

  // Returns auth headers for API calls — Privy token or guest token
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (authenticated) {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }

    // Guest path
    if (guestTokenRef.current) {
      return { "X-Guest-Token": guestTokenRef.current };
    }

    // Create a new guest
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        guestTokenRef.current = data.guestToken;
        storeGuestSession(data.guestToken, data.displayName);
        setGuestName(data.displayName);
        return { "X-Guest-Token": data.guestToken };
      }
    } catch (err) {
      console.error("[game] guest creation failed:", err);
    }

    return {};
  }, [authenticated, getAccessToken]);

  // Load stored guest name on mount
  useEffect(() => {
    if (!authenticated) {
      const storedName = typeof window !== "undefined" ? localStorage.getItem(GUEST_NAME_KEY) : null;
      if (storedName) setGuestName(storedName);
    }
  }, [authenticated]);

  const fetchMatchups = useCallback(async () => {
    if (!sessionId) return;

    setLoading(true);
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sessions/${sessionId}/rounds`, { headers });

    if (res.ok) {
      const data = await res.json();
      setMatchups(data.matchups);
      setDefaultRoundDuration(data.roundDurationSeconds);
    }

    setLoading(false);
  }, [sessionId, getAuthHeaders]);

  useEffect(() => {
    if (!sessionId) return;

    (async () => {
      setPhase("joining");

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/sessions/${sessionId}/join`, {
          method: "POST",
          headers,
        });

        if (res.ok || res.status === 201) {
          const data = await res.json();

          // Guest users: set display name
          if (data.isGuest && data.displayName) {
            setGuestName(data.displayName);
          }

          // Ended sessions: use per-player timing (async replay)
          if (data.asyncReplay) {
            setAsyncReplay(true);
          }

          // Record referral if cookie exists (fire-and-forget)
          fetch("/api/referrals", { method: "POST", headers }).catch(() => {});

          // Go straight to playing — deposit handled server-side
          await fetchMatchups();
          roundStartRef.current = Date.now();
          setPhase("playing");
          return;
        }

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
      } catch (err) {
        console.error("[game] join error:", err);
      }

      await fetchMatchups();
      setPhase("playing");
    })();
  }, [fetchMatchups, getAuthHeaders, sessionId]);

  useEffect(() => {
    if (phase !== "playing" || !sessionId) return;

    const streamUrl = (isSample || isReplay || asyncReplay)
      ? `/api/sessions/sample/stream?sessionId=${sessionId}&async=true`
      : `/api/sessions/${sessionId}/stream`;

    const es = new EventSource(streamUrl);

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
  }, [isSample, isReplay, asyncReplay, phase, sessionId]);

  const fetchRoundResults = useCallback(
    async (round: number) => {
      if (!sessionId) return null;

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/sessions/${sessionId}/rounds/${round}/results`, { headers });

        if (res.ok) {
          return (await res.json()) as RoundResults;
        }
      } catch {
        // ignore
      }

      return null;
    },
    [getAuthHeaders, sessionId],
  );

  useEffect(() => {
    if (!roundState) return;

    const { status, round } = roundState;

    // Trigger overlay once when server enters the results phase for a round
    if (status === "results" && prevStatusRef.current !== "results") {
      prevStatusRef.current = "results";
      completedRoundRef.current = round;
      setDisplayedRound(round);

      fetchRoundResults(round).then((result) => {
        if (!result) return;
        setCorrectCount(result.correctCount);
        setInterstitial({ ...result, completedRound: round });
      });
    } else if (status !== "results") {
      prevStatusRef.current = status;
    }
  }, [fetchRoundResults, roundState]);

  // Track video impressions when round changes
  useEffect(() => {
    const matchup = matchups[displayedRound - 1];
    if (!matchup || !sessionId) return;

    fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        events: [
          { type: "video_impression", videoId: matchup.videoA.id, sessionId, matchupId: matchup.id },
          { type: "video_impression", videoId: matchup.videoB.id, sessionId, matchupId: matchup.id },
        ],
      }),
    }).catch(() => {});
  }, [displayedRound, matchups, sessionId]);

  const handleVote = async (decision: "video_a" | "video_b") => {
    if (decision === voted) return;

    setVoted(decision);

    const currentRound = roundState?.round ?? 1;
    const currentMatchup = matchups[currentRound - 1];
    if (!currentMatchup) return;

    try {
      const headers = await getAuthHeaders();
      const timeToVoteMs = Math.round(Date.now() - roundStartRef.current);
      await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          matchupId: currentMatchup.id,
          decision,
          timeToVoteMs,
        }),
      });
    } catch {
      // silent failure for live voting
    }
  };

  useEffect(() => {
    if (!gameOver || redirectScheduled.current) return;

    redirectScheduled.current = true;
    const timer = setTimeout(() => {
      router.push(`/arena/results?session=${sessionId}`);
    }, 1500);

    return () => clearTimeout(timer);
  }, [gameOver, router, sessionId]);

  if (gameOver) {
    return (
      <div className="spotr-page flex flex-1 flex-col items-center justify-center gap-4 anim-fade-in">
        <p className="text-[24px] font-semibold tracking-[-0.04em] text-white">Session Complete</p>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
      </div>
    );
  }

  if (phase === "insufficient") {
    return <InsufficientBalanceScreen />;
  }

  if (phase === "joining" || loading) {
    return (
      <div className="spotr-page flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
      </div>
    );
  }

  if (!sessionId || matchups.length === 0) {
    return (
      <div className="spotr-page flex flex-1 flex-col items-center justify-center px-5 text-center">
        <p className="mb-4 text-[14px] text-[#8b8b8b]">No active session found.</p>
        <button
          onClick={() => router.push("/arena")}
          className="spotr-primary-button px-6"
        >
          Back to Arena
        </button>
      </div>
    );
  }

  const serverRound = roundState?.round ?? 1;
  const roundDuration =
    roundState?.roundDuration ??
    defaultRoundDuration ??
    parseInt(process.env.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS!);
  const secondsRemaining = interstitial ? roundDuration : (roundState?.secondsRemaining ?? roundDuration);
  const totalRounds = roundState?.totalRounds ?? matchups.length;
  const currentMatchup = matchups[displayedRound - 1] ?? matchups[0];
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black">
      <div className="spotr-mobile-shell flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4">
        <div className="mb-0 pb-2">
          <div className="mb-1 flex items-center justify-between text-[14px] font-semibold">
            <span className="text-[#f5d63d]">
              ROUND {displayedRound} / {totalRounds}
            </span>
            <div className="flex items-center gap-2">
              {guestName && !authenticated && (
                <span className="flex items-center gap-1 rounded-full bg-[#222] px-3 py-1 text-[11px] font-medium text-[#9b9b9b]">
                  <User className="h-3 w-3" />
                  {guestName}
                </span>
              )}
              <span className="text-[#d8d8d8]">{correctCount} correct</span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1">
              <ProgressBar
                secondsLeft={secondsRemaining}
                roundDuration={roundDuration}
              />
            </div>
            <span
              className={`min-w-[28px] text-right text-[14px] font-semibold ${
                secondsRemaining <= 5 ? "text-[#eb5a52]" : "text-[#d7bb39]"
              }`}
            >
              {secondsRemaining}s
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 flex flex-col">
          <MatchupPicker
            key={currentMatchup.id}
            videoA={{ ...currentMatchup.videoA, creatorHandle: currentMatchup.videoA.uploadedBy?.displayName ?? null }}
            videoB={{ ...currentMatchup.videoB, creatorHandle: currentMatchup.videoB.uploadedBy?.displayName ?? null }}
            onPick={handleVote}
            voted={voted}
            muted={muted}
            onToggleMute={() => setMuted((prev) => !prev)}
            roundNumber={displayedRound}
          />
        </div>
      </div>

      {interstitial ? (
        <RoundResultOverlay
          correct={interstitial.userCorrect}
          videoAPercent={interstitial.videoAPercent}
          videoBPercent={interstitial.videoBPercent}
          winner={interstitial.winner}
          correctCount={interstitial.correctCount}
          completedRound={interstitial.completedRound}
          onExpire={() => {
            setDisplayedRound(completedRoundRef.current + 1);
            setInterstitial(null);
            setVoted(null);
            roundStartRef.current = Date.now();
          }}
        />
      ) : null}
    </div>
  );
}

export default function ArenaGame() {
  return (
    <Suspense
      fallback={
        <div className="spotr-page flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
