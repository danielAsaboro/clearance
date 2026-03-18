"use client";

import Link from "next/link";
import { PlayCircle, Trophy } from "lucide-react";
import SpotrIcon from "@/components/SpotrIcon";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  consentAccepted: boolean;
  role: string;
  displayName?: string | null;
  sessionComplete?: boolean;
}

export default function Home() {
  const { authenticated, getAccessToken } = usePrivy();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

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

  // Bypass onboarding — go straight to arena
  const playHref = !authenticated
    ? "/auth/login"
    : "/arena";

  const sessionComplete = authenticated && profile?.sessionComplete === true;

  return (
    <div className="spotr-page flex flex-1 flex-col">
      <div className="spotr-mobile-shell flex min-h-dvh flex-col px-6 pb-8 pt-10">
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
                <button
                  className="spotr-primary-button flex w-full items-center justify-center gap-2"
                >
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
    </div>
  );
}
