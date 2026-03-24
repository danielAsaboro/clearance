"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { Check, Copy, Home, LogIn, Share2, User } from "lucide-react";
import Link from "next/link";
import CircularProgress from "@/components/CircularProgress";
import ProfileModal from "@/components/ProfileModal";
import ShareQR from "@/components/ShareQR";

const GUEST_TOKEN_KEY = "spotr_guest_token";
const GUEST_NAME_KEY = "spotr_guest_name";

interface GameResults {
  correctVotes: number;
  totalVotes: number;
  totalRounds: number;
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  nftMinted: boolean;
  tasteScore?: number;
  discountCode?: string;
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");
  const { getAccessToken, authenticated, login } = usePrivy();
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const [skippedSignup, setSkippedSignup] = useState(false);

  const isGuest = !authenticated && typeof window !== "undefined" && !!localStorage.getItem(GUEST_TOKEN_KEY);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (authenticated) {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    }
    const guestToken = typeof window !== "undefined" ? localStorage.getItem(GUEST_TOKEN_KEY) : null;
    if (guestToken) {
      return { "X-Guest-Token": guestToken };
    }
    return {};
  }, [authenticated, getAccessToken]);

  // After Privy login succeeds, merge guest data
  useEffect(() => {
    if (!authenticated || merged || merging) return;

    const guestToken = typeof window !== "undefined" ? localStorage.getItem(GUEST_TOKEN_KEY) : null;
    if (!guestToken) return;

    setMerging(true);
    (async () => {
      try {
        const token = await getAccessToken();
        await fetch("/api/auth/guest/merge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ guestToken }),
        });

        localStorage.removeItem(GUEST_TOKEN_KEY);
        localStorage.removeItem(GUEST_NAME_KEY);
        setMerged(true);
      } catch (err) {
        console.error("[results] merge failed:", err);
      } finally {
        setMerging(false);
      }
    })();
  }, [authenticated, getAccessToken, merged, merging]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const fetchResults = async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/sessions/${sessionId}/results`, { headers });

      if (res.ok) {
        setResults(await res.json());
      }

      setLoading(false);
    };

    fetchResults();
  }, [sessionId, getAuthHeaders]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
      </div>
    );
  }

  const tasteScore = results?.tasteScore ?? (results ? results.correctVotes : 0);
  const nftThreshold = 70;
  const scorePct = Math.min(100, (tasteScore / nftThreshold) * 100);

  return (
    <div className="spotr-page flex flex-1 flex-col">
      <div className="spotr-mobile-shell flex min-h-dvh flex-col px-5 pb-8 pt-4">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#161616] text-white transition-colors hover:bg-[#1d1d1d]"
          >
            <Home className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowProfile(true)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#161616] text-white transition-colors hover:bg-[#1d1d1d]"
          >
            <User className="h-4 w-4" />
          </button>
        </div>

        {results ? (
          <div className="flex flex-1 flex-col items-center">
            <p className="mb-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#d4b83a]">
              Session Complete
            </p>

            <CircularProgress
              value={results.correctVotes}
              max={results.totalRounds ?? results.totalVotes}
              size={130}
              label="Correct Predictions"
            />

            <div className="mt-8 w-full rounded-[18px] bg-[#f5d63d] px-5 py-5 text-black">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-black/55">
                Your Taste Score
              </p>
              <p className="mt-2 text-center text-[72px] font-semibold leading-none tracking-[-0.08em]">
                {tasteScore}
              </p>
              <p className="mt-3 text-[13px] text-black/68">
                {tasteScore} / {nftThreshold} to NFT Whitelist
              </p>
              <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-[#c3ac31]/42">
                <div
                  className="h-full rounded-full bg-[#c1ab38]"
                  style={{ width: `${scorePct}%` }}
                />
              </div>
              <p className="mt-3 text-center text-[12px] leading-4 text-black/60">
                Share your Blink to recruit your tribe and boost this score together.
              </p>
            </div>

            {/* Guest signup CTA */}
            {isGuest && !merged && !skippedSignup && (
              <div className="mt-4 w-full overflow-hidden rounded-[16px] border border-[#f5d63d]/40 bg-gradient-to-b from-[#1e1a0e] to-[#161616]">
                <div className="px-5 py-5">
                  <p className="text-center text-[18px] font-semibold tracking-[-0.03em] text-white">
                    Save your score & unlock rewards
                  </p>
                  <p className="mt-2 text-center text-[13px] leading-5 text-[#8b8b8b]">
                    Sign in with your email to keep your progress, earn discount codes, and compete on the leaderboard.
                  </p>
                  <button
                    onClick={() => login()}
                    className="spotr-primary-button mt-4 flex w-full items-center justify-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign In to Save Progress
                  </button>
                  <button
                    onClick={() => setSkippedSignup(true)}
                    className="mt-3 flex w-full items-center justify-center py-2 text-[14px] font-medium text-[#9b9b9b] underline underline-offset-2 transition-colors hover:text-white"
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            )}

            {merged && (
              <div className="mt-4 w-full rounded-[16px] border border-[#45ca61]/30 bg-[#161616] px-4 py-4 text-center">
                <p className="text-[14px] font-semibold text-[#45ca61]">Account saved!</p>
                <p className="mt-1 text-[12px] text-[#8b8b8b]">Your scores have been linked to your account.</p>
              </div>
            )}

            <div className="mt-3 w-full rounded-[16px] border border-[#8e7a24] bg-[#161616] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-3 w-3 rounded-[3px] bg-[#f5d63d]" />
                <div className="min-w-0">
                  <p className="text-[14px] leading-5 text-[#d6d6d6]">
                    Reach 70 collective points with your tribe to unlock{" "}
                    <span className="font-semibold text-white">FREE NFT mint</span>
                  </p>
                  <p className="mt-2 text-[12px] font-semibold text-[#d0b33a]">
                    Taste NFT Drop — May 14, 2026
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {["Common", "Uncommon", "Rare", "Legendary"].map((tier) => (
                  <div
                    key={tier}
                    className="rounded-[10px] bg-[#232323] px-2 py-2 text-center text-[11px] text-[#6b6b6b]"
                  >
                    {tier}
                  </div>
                ))}
              </div>
            </div>

            {results.discountCode && (
              <div className="mt-4 w-full rounded-[16px] border border-[#2a2a2a] bg-[#161616] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b6b6b]">
                  Your Discount Code
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <code className="flex-1 rounded-[10px] bg-[#232323] px-4 py-3 text-center text-[18px] font-semibold tracking-[0.12em] text-[#f5d63d]">
                    {results.discountCode}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(results.discountCode!);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#232323] text-white transition-colors hover:bg-[#2a2a2a]"
                  >
                    {codeCopied ? <Check className="h-4 w-4 text-[#45ca61]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 text-center text-[12px] text-[#6b6b6b]">
                  Use this code for exclusive rewards
                </p>
              </div>
            )}

            {sessionId && (
              <div className="mt-4 flex justify-center">
                <ShareQR
                  url={`${typeof window !== "undefined" ? window.location.origin : "https://spotr.tv"}/arena?session=${sessionId}`}
                  label="Share Session"
                  size={160}
                />
              </div>
            )}

            <div className="mt-auto flex w-full flex-col gap-4 pt-8">
              <Link href={`/blink?session=${sessionId}&score=${results.correctVotes}&total=${results.totalRounds}`} className="block w-full">
                <button className="spotr-primary-button flex w-full items-center justify-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Generate My Blink Link
                </button>
              </Link>

              <Link href="/" className="block w-full">
                <button className="spotr-secondary-button flex w-full items-center justify-center gap-2">
                  <Home className="h-4 w-4" />
                  Back to Home
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[14px] text-[#888]">No results found for this session.</p>
          </div>
        )}
      </div>

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
