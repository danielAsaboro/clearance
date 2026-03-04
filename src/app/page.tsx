"use client";

import Link from "next/link";
import { Eye, Trophy, Gift, Gamepad2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

interface UserProfile {
  id: string;
  consentAccepted: boolean;
  role: string;
  displayName?: string | null;
}

export default function Home() {
  const { authenticated, user, getAccessToken } = usePrivy();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      setProfile(null);
      return;
    }

    setLoadingProfile(true);
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
          document.cookie = `clearance_role=${data.role};path=/;max-age=${60 * 60 * 24 * 30}`;
        }
        if (data?.consentAccepted) {
          document.cookie = `clearance_onboarded=1;path=/;max-age=${60 * 60 * 24 * 30}`;
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [authenticated, getAccessToken]);

  // Determine where Play button should go
  const playHref = !authenticated
    ? "/onboarding/categories"
    : profile?.consentAccepted
    ? "/arena"
    : "/onboarding/categories";

  const playSubtext = !authenticated
    ? "Predict trending videos & win NFTs"
    : profile?.consentAccepted
    ? "Go to Arena"
    : "Complete your registration";

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-between px-6 py-6">
      {/* Logo & Tagline */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-[#F5E642] rounded-2xl flex items-center justify-center mb-4">
          <Eye className="w-10 h-10 text-black" strokeWidth={2.5} />
        </div>

        <h1 className="text-4xl font-bold tracking-wider text-white">The Clearance</h1>

        <p className="text-[#888] text-center mt-6 text-sm leading-relaxed">
          Predict trending content. Earn rewards.
          <br />
          Own the moment.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm">
        <p className="text-[#888] text-xs tracking-[0.2em] text-center mb-4 uppercase">
          {authenticated ? "Continue" : "Get Started"}
        </p>

        {/* Play button */}
        <Link href={loadingProfile ? "#" : playHref}>
          <div
            className={`btn-yellow rounded-2xl p-5 flex items-center gap-4 mb-3 cursor-pointer ${
              loadingProfile ? "opacity-60" : ""
            }`}
          >
            <div className="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Play</h3>
              <p className="text-sm opacity-70">{playSubtext}</p>
            </div>
          </div>
        </Link>

        <Link href="/leaderboard">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 flex items-center gap-4 cursor-pointer border border-[#2A2A2A] card-hover mt-3">
            <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#F5E642]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Leaderboard</h3>
              <p className="text-sm text-[#888]">Player rankings & predictions</p>
            </div>
          </div>
        </Link>

        {authenticated && (
          <Link href="/rewards">
            <div className="bg-[#1A1A1A] rounded-2xl p-5 flex items-center gap-4 cursor-pointer border border-[#2A2A2A] card-hover mt-3">
              <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
                <Gift className="w-5 h-5 text-[#F5E642]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">My Rewards</h3>
                <p className="text-sm text-[#888]">View Blind Box collection</p>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* Season Badge */}
      <p className="text-[#888] text-xs mt-4">
        {authenticated && user?.email?.address
          ? `Signed in as ${user.email.address}`
          : "Season 1 is LIVE"}
      </p>
    </div>
  );
}
