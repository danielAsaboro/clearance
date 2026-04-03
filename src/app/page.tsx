"use client";

import Link from "next/link";
import { PlayCircle, Trophy, Home as HomeIcon, User } from "lucide-react";
import SpotrIcon from "@/components/SpotrIcon";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import ProfileModal from "@/components/ProfileModal";

// ─── Winners crawl goes live at 9:00 AM GMT+1 on June 30, 2026 ───
const WINNERS_GO_LIVE = new Date("2026-06-30T08:00:00Z").getTime(); // 9am WAT (GMT+1)
// ──────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════
// Original Home Page
// ════════════════════════════════════════════════════

interface UserProfile {
  id: string;
  consentAccepted: boolean;
  role: string;
  displayName?: string | null;
  sessionComplete?: boolean;
}

function OriginalHome() {
  const { authenticated, getAccessToken } = usePrivy();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!authenticated) return;
    getAccessToken()
      .then((token) =>
        fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProfile(data);
        if (data?.role) {
          document.cookie = `spotr_role=${data.role};path=/;max-age=${60 * 60 * 24 * 30}`;
        }
        if (data?.consentAccepted) {
          document.cookie = `spotr_onboarded=1;path=/;max-age=${60 * 60 * 24 * 30}`;
        }
      })
      .catch(() => setProfile(null));
  }, [authenticated, getAccessToken]);

  const playHref = !authenticated ? "/auth/login" : "/arena";
  const sessionComplete = authenticated && profile?.sessionComplete === true;

  return (
    <div className="spotr-page flex flex-1 flex-col">
      <div className="spotr-mobile-shell flex min-h-dvh flex-col px-6 pb-8 pt-10">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#161616] text-white transition-colors hover:bg-[#1d1d1d]"
          >
            <HomeIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#161616] text-white transition-colors hover:bg-[#1d1d1d]"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col items-center pt-6 text-center">
          <SpotrIcon size={96} className="mb-6" />
          <h1 className="font-display text-[52px] font-bold leading-none tracking-[-0.07em] text-white">
            SPOTR <span className="text-[#f5d63d]">/</span> TV
          </h1>
          <p className="mt-4 text-[17px] text-[#717171]">
            Spot what sells. Earn while you do.
          </p>
        </div>
        <div className="mb-10 w-full">
          <div className="mx-auto flex w-full max-w-[312px] flex-col gap-4">
            {sessionComplete ? (
              <div className="spotr-panel px-5 py-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#707070]">
                  Session Complete
                </p>
                <p className="mt-2 text-[13px] leading-5 text-[#8c8c8c]">
                  One session per wallet. Check your profile to view your results.
                </p>
              </div>
            ) : (
              <Link href={playHref}>
                <button className="spotr-primary-button flex w-full items-center justify-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Start Session
                </button>
              </Link>
            )}
            <Link href="/leaderboard">
              <button className="spotr-secondary-button flex w-full items-center justify-center gap-2">
                <Trophy className="h-4 w-4" />
                See Leaderboard
              </button>
            </Link>
          </div>
        </div>
        <p className="spotr-screen-footer text-center">Season 1 is LIVE • May 2026 NFT Drop</p>
      </div>
      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}

// ════════════════════════════════════════════════════
// Star Wars Winners Crawl
// ════════════════════════════════════════════════════

interface PlayerRanking {
  rank: number;
  userId: string;
  displayName: string;
  correctPredictions: number;
  winRate: number;
}

interface TribeRanking {
  rank: number;
  leaderId: string;
  leaderName: string;
  memberCount: number;
  tribeScore: number;
}

const RANK_COLORS = ["#f5d63d", "#c0c0c0", "#cd7f32"];

function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    // Generate stars
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.4,
      baseOpacity: Math.random() * 0.6 + 0.3,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.3,
    }));

    let frame: number;
    function draw(t: number) {
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const star of stars) {
        const opacity =
          star.baseOpacity +
          Math.sin(t * 0.001 * star.speed + star.phase) * 0.25;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${Math.max(0.05, Math.min(1, opacity))})`;
        ctx!.fill();
      }
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}

const LOADING_MESSAGES = [
  "Accessing the vault...",
  "Counting predictions...",
  "Verifying on-chain results...",
  "Ranking the Spotrs...",
  "Tallying tribe scores...",
  "Preparing the reveal...",
];

function LoadingSequence() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
      <p
        key={msgIndex}
        className="anim-fade-in font-display text-[15px] tracking-wide text-[#f5d63d]/70"
      >
        {LOADING_MESSAGES[msgIndex]}
      </p>
    </div>
  );
}

function WinnersCrawl() {
  const [players, setPlayers] = useState<PlayerRanking[]>([]);
  const [tribes, setTribes] = useState<TribeRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/leaderboard").then((r) => r.json()),
      fetch("/api/leaderboard?tab=tribes").then((r) => r.json()),
    ])
      .then(([playerData, tribeData]) => {
        const rankings = playerData.rankings ?? playerData;
        const tribeList = tribeData.tribes ?? tribeData;
        setPlayers(rankings.slice(0, 3));
        setTribes(tribeList.slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <StarField />

      {/* Leaderboard nav link */}
      <Link
        href="/leaderboard"
        className="fixed right-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-[13px] font-semibold text-[#f5d63d] backdrop-blur-sm transition-all hover:border-[#f5d63d]/40 hover:bg-black/80"
      >
        <Trophy className="h-3.5 w-3.5" />
        Leaderboard
      </Link>

      {loading ? (
        <LoadingSequence />
      ) : (
        <CrawlViewport players={players} tribes={tribes} />
      )}
    </div>
  );
}

function CrawlViewport({ players, tribes }: { players: PlayerRanking[]; tribes: TribeRanking[] }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const SPEED = 30; // pixels per second
    let lastTime = performance.now();

    function tick(now: number) {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      scrollRef.current += SPEED * delta;

      const el = contentRef.current;
      if (el) {
        // Keep scrolling until the last line has fully passed the vanishing point
        const maxScroll = el.scrollHeight + window.innerHeight;
        if (scrollRef.current >= maxScroll) {
          scrollRef.current = -window.innerHeight * 0.15;
        }
        el.style.transform = `translateY(${-scrollRef.current}px)`;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    // Start just barely below the bottom edge
    scrollRef.current = -window.innerHeight * 0.15;
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <>
      {/* Perspective wrapper */}
      <div
        className="absolute inset-0 z-[1] overflow-hidden"
        style={{
          perspective: "350px",
          perspectiveOrigin: "50% 40%",
          animation: "crawlFadeIn 2s ease-out",
        }}
      >
        {/* Tilted plane */}
        <div
          className="relative mx-auto flex h-full w-full justify-center"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateX(25deg)",
            transformOrigin: "50% 50%",
          }}
        >
          {/* Scrolling content — positioned by JS */}
          <div
            ref={contentRef}
            className="absolute top-[50%] w-full max-w-[650px] px-6 text-center font-display leading-relaxed text-[#f5d63d]"
          >
            {/* ── Prologue ── */}
            <div className="mb-20">
              <p className="mb-6 text-[13px] tracking-[0.35em] text-[#f5d63d]/50 md:text-[15px]">
                A LONG TIME AGO IN A GROUP CHAT FAR, FAR AWAY...
              </p>
            </div>

            <div className="mb-28">
              <h1 className="mb-4 text-[40px] font-bold tracking-[-0.04em] md:text-[52px]">
                SPOTR <span className="text-white">/</span> TV
              </h1>
              <p className="text-[16px] tracking-[0.25em] text-[#f5d63d]/60 md:text-[20px]">
                SEASON 1
              </p>
            </div>

            {/* ── Chapter 1: The Beginning ── */}
            <div className="mb-24 space-y-8 text-[17px] md:text-[21px]">
              <p className="text-[#f5d63d]/70">
                It started with an idea so simple
                it almost felt stupid.
              </p>
              <p>
                What if people could predict
                which content would go viral —
                and actually earn from it?
              </p>
              <p className="text-[#f5d63d]/70">
                No followers needed. No clout.
                Just your instinct. Your taste.
              </p>
              <p>
                That was the seed. Planted somewhere
                between late nights, cold coffee,
                and too many browser tabs.
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 2: The Struggle ── */}
            <div className="mb-24 space-y-8 text-[17px] md:text-[21px]">
              <p className="text-[20px] font-semibold md:text-[24px]">
                But building it? That was the hard part.
              </p>
              <p className="text-[#f5d63d]/70">
                Smart contracts that had to be rewritten.
                Twice. Three times. More than we&apos;d
                like to admit.
              </p>
              <p>
                Wallets that wouldn&apos;t connect.
                Transactions that failed silently.
                Edge cases that only showed up
                at 2 AM on a Sunday.
              </p>
              <p className="text-[#f5d63d]/70">
                There were days we wondered
                if anyone would even care.
              </p>
              <p>
                Days where the code broke in ways
                that made us question everything.
                Days where &ldquo;ship it tomorrow&rdquo;
                became next week. Then next month.
              </p>
              <p className="text-[20px] font-semibold md:text-[24px]">
                But we kept building.
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 3: The Call ── */}
            <div className="mb-24 space-y-8 text-[17px] md:text-[21px]">
              <p>
                Then came the moment of truth.
              </p>
              <p className="text-[20px] font-semibold md:text-[24px]">
                We opened the doors for testing.
              </p>
              <p className="text-[#f5d63d]/70">
                We planned for 100 testers.
                Set up the servers for 100.
                Prepared support for 100.
              </p>
              <p className="text-[24px] font-bold md:text-[30px]">
                Over 200 of you showed up.
              </p>
              <p className="text-[#f5d63d]/70">
                You didn&apos;t just test it.
                You stress-tested it.
                You broke things we didn&apos;t
                know could break.
              </p>
              <p>
                You sent feedback at midnight.
                You tagged us in group chats.
                You told your friends.
                Your friends told their friends.
              </p>
              <p className="text-[20px] font-semibold md:text-[24px]">
                You turned a test into a movement.
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 4: The Game ── */}
            <div className="mb-24 space-y-8 text-[17px] md:text-[21px]">
              <p>
                Round after round, you voted.
              </p>
              <p className="text-[#f5d63d]/70">
                You studied the matchups.
                You trusted your gut.
                Some of you argued about picks
                like it was Champions League night.
              </p>
              <p>
                Every prediction was a statement.
                Every correct call, a flex.
              </p>
              <p className="text-[20px] font-semibold md:text-[24px]">
                And some of you were ridiculously good at it.
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 5: The Winners — Players ── */}
            <div className="mb-28">
              <p className="mb-4 text-[13px] tracking-[0.3em] text-[#f5d63d]/40 md:text-[15px]">
                AND NOW... THE MOMENT YOU&apos;VE BEEN WAITING FOR
              </p>
              <h2 className="mb-14 text-[30px] font-bold tracking-[-0.03em] md:text-[40px]">
                TOP SPOTRS
              </h2>
              <div className="space-y-12">
                {players.map((player, i) => (
                  <div key={player.userId} className="mb-4">
                    <p
                      className="text-[13px] font-bold tracking-[0.2em] md:text-[15px]"
                      style={{ color: RANK_COLORS[i] }}
                    >
                      {i === 0 ? "1ST PLACE" : i === 1 ? "2ND PLACE" : "3RD PLACE"}
                    </p>
                    <p
                      className="mt-3 text-[26px] font-bold md:text-[34px]"
                      style={{ color: RANK_COLORS[i] }}
                    >
                      {player.displayName}
                    </p>
                    <p className="mt-2 text-[14px] text-[#f5d63d]/50 md:text-[16px]">
                      {player.correctPredictions} correct predictions &middot; {player.winRate}% accuracy
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 6: The Winners — Tribes ── */}
            <div className="mb-28">
              <p className="mb-4 text-[13px] tracking-[0.3em] text-[#f5d63d]/40 md:text-[15px]">
                THEY DIDN&apos;T JUST PLAY ALONE
              </p>
              <h2 className="mb-14 text-[30px] font-bold tracking-[-0.03em] md:text-[40px]">
                TOP TRIBES
              </h2>
              <div className="space-y-12">
                {tribes.map((tribe, i) => (
                  <div key={tribe.leaderId} className="mb-4">
                    <p
                      className="text-[13px] font-bold tracking-[0.2em] md:text-[15px]"
                      style={{ color: RANK_COLORS[i] }}
                    >
                      {i === 0 ? "1ST PLACE" : i === 1 ? "2ND PLACE" : "3RD PLACE"}
                    </p>
                    <p
                      className="mt-3 text-[26px] font-bold md:text-[34px]"
                      style={{ color: RANK_COLORS[i] }}
                    >
                      {tribe.leaderName}&apos;s Tribe
                    </p>
                    <p className="mt-2 text-[14px] text-[#f5d63d]/50 md:text-[16px]">
                      {tribe.memberCount + 1} members &middot; Score: {tribe.tribeScore}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Chapter 7: Thank You ── */}
            <div className="mb-24 space-y-8 text-[17px] md:text-[21px]">
              <p className="text-[22px] font-semibold md:text-[26px]">
                To every single one of you —
              </p>
              <p className="text-[#f5d63d]/70">
                The ones who signed up day one.
                The ones who dragged their friends in.
                The ones who found bugs and reported them
                instead of just closing the tab.
              </p>
              <p>
                The ones who said &ldquo;this is actually fire&rdquo;
                when we weren&apos;t sure ourselves.
              </p>
              <p className="text-[22px] font-semibold md:text-[26px]">
                Thank you.
              </p>
              <p className="text-[#f5d63d]/70">
                You didn&apos;t just test a product.
                You believed in something
                before it was ready to be believed in.
              </p>
            </div>

            {/* ── Divider ── */}
            <div className="mx-auto mb-24 h-px w-40 bg-[#f5d63d]/20" />

            {/* ── Epilogue ── */}
            <div className="mb-60 space-y-8 text-[17px] md:text-[21px]">
              <p className="text-[24px] font-bold md:text-[30px]">
                This is just the beginning.
              </p>
              <p className="text-[#f5d63d]/80">
                Season 1 was the proof
                that this thing works.
              </p>
              <p className="text-[#f5d63d]/80">
                That people want this.
                That taste can be a skill.
                That the culture can be the game.
              </p>
              <p className="text-[22px] font-semibold md:text-[26px]">
                Season 2 will be the statement.
              </p>
              <p className="text-[#f5d63d]/70">
                Bigger stakes. Bigger rewards.
                More ways to prove your eye.
              </p>
              <p className="mt-12 text-[26px] font-bold md:text-[34px]">
                See you on the other side.
              </p>
              <p className="mt-8 text-[15px] tracking-[0.3em] text-[#f5d63d]/40 md:text-[17px]">
                #SpotrTV
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fade mask — on top of everything */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to bottom, black 0%, black 5%, transparent 30%, transparent 85%, black 100%)",
        }}
      />
    </>
  );
}

// ════════════════════════════════════════════════════
// Default Export — toggle between crawl and original
// ════════════════════════════════════════════════════

export default function Home() {
  const [showWinners, setShowWinners] = useState(false);

  useEffect(() => {
    setShowWinners(Date.now() >= WINNERS_GO_LIVE);
  }, []);

  if (showWinners) {
    return <WinnersCrawl />;
  }
  return <OriginalHome />;
}
