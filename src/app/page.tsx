"use client";

import Link from "next/link";
import { Eye, Users, Gift, Trophy } from "lucide-react";
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

  // Determine where Creator button should go:
  // - If not authenticated → start onboarding
  // - If authenticated and already onboarded → go straight to creator-hub
  // - If authenticated but not onboarded yet → continue onboarding
  const creatorHref = !authenticated
    ? "/onboarding/step1?role=creator"
    : profile?.consentAccepted
    ? "/creator-hub"
    : "/onboarding/step1?role=creator";

  const creatorSubtext = !authenticated
    ? "Upload content & earn prizes"
    : profile?.consentAccepted
    ? "Go to Creator Hub"
    : "Complete your registration";

  // Role is locked once onboarding is complete
  const roleLocked = profile?.consentAccepted === true;
  const isCreator = roleLocked && profile?.role === "creator";
  const isFan = roleLocked && profile?.role === "fan";

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between px-6 py-12">
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

      {/* Choose Your Path */}
      <div className="w-full max-w-sm">
        <p className="text-[#888] text-xs tracking-[0.2em] text-center mb-4 uppercase">
          {authenticated ? "Continue" : "Choose Your Path"}
        </p>

        {/* Creator button — hidden if user is locked as fan */}
        {!isFan && (
          <Link href={loadingProfile ? "#" : creatorHref}>
            <div
              className={`btn-yellow rounded-2xl p-5 flex items-center gap-4 mb-3 cursor-pointer ${
                loadingProfile ? "opacity-60" : ""
              }`}
            >
              <div className="w-10 h-10 bg-black/10 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Creator</h3>
                <p className="text-sm opacity-70">{creatorSubtext}</p>
              </div>
            </div>
          </Link>
        )}

        {/* Fan button — hidden if user is locked as creator */}
        {!isCreator && (
          <Link href="/arena">
            <div className="bg-[#1A1A1A] rounded-2xl p-5 flex items-center gap-4 cursor-pointer border border-[#2A2A2A] card-hover">
              <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#F5E642]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Fan</h3>
                <p className="text-sm text-[#888]">Vote on content & win NFTs</p>
              </div>
            </div>
          </Link>
        )}

        <Link href="/leaderboard">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 flex items-center gap-4 cursor-pointer border border-[#2A2A2A] card-hover mt-3">
            <div className="w-10 h-10 bg-[#2A2A2A] rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-[#F5E642]" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Leaderboard</h3>
              <p className="text-sm text-[#888]">Creator rankings & competition</p>
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
      <p className="text-[#888] text-xs mt-12">
        {authenticated && user?.email?.address
          ? `Signed in as ${user.email.address}`
          : "Season 1 is LIVE"}
      </p>
    </div>
  );
}
