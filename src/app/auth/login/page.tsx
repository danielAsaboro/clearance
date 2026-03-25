"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, authenticated, getAccessToken } = usePrivy();
  const redirect = searchParams.get("redirect") || "/";
  const [skipLoading, setSkipLoading] = useState(false);

  const { login } = useLogin({
    onComplete: () => {
      router.push(redirect);
    },
  });

  useEffect(() => {
    if (ready && authenticated) {
      router.push(redirect);
    }
  }, [ready, authenticated, redirect, router]);

  const handleSkip = useCallback(async () => {
    setSkipLoading(true);
    try {
      // Create guest token and go directly to the game
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.guestToken) {
          localStorage.setItem("spotr_guest_token", data.guestToken);
          if (data.displayName) {
            localStorage.setItem("spotr_guest_name", data.displayName);
          }
        }
      }

      // Fetch current session and navigate directly to the game
      const sessionRes = await fetch("/api/sessions");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const current = sessionData.current || sessionData.next || null;
        if (current && current.status === "live") {
          router.push(`/arena/game?session=${current.id}${current.isSample ? "&sample=true" : ""}`);
          return;
        }
      }

      // Fallback to arena if no live session
      router.push("/arena");
    } catch {
      router.push("/arena");
    }
  }, [router]);

  return (
    <div className="flex-1 bg-black flex flex-col items-center justify-center px-6">
      <Image src="/spotr-logo.png" alt="Spotr TV" width={64} height={64} className="rounded-2xl mb-4" />
      <h1 className="text-3xl font-bold tracking-wider text-white mb-8">Spotr TV</h1>

      <p className="text-[#888] text-sm text-center mb-8">
        Sign in to continue
      </p>

      <button
        onClick={login}
        className="btn-yellow w-full max-w-sm rounded-2xl py-4 font-bold text-lg"
      >
        Sign In
      </button>

      <button
        onClick={handleSkip}
        disabled={skipLoading}
        className="mt-4 rounded-2xl border border-transparent px-6 py-3 text-[#888] text-sm hover:border-[#888] hover:text-white transition-all"
      >
        {skipLoading ? "Loading..." : "Skip for now"}
      </button>

      <Link href="/leaderboard" className="mt-3 text-[#f5d63d] text-sm underline-offset-2 hover:text-[#e6c832] transition-colors">
        View Leaderboard
      </Link>

      <p className="text-[#888] text-xs mt-6 text-center">
        Email or Solana wallet supported
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
