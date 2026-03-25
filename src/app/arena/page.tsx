"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, CheckCircle, Wallet, Gamepad2, Coins, Star, Gift } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import PageHeader from "@/components/PageHeader";
import SessionStateDisplay from "@/components/SessionStateDisplay";
import { getSessionState } from "@/lib/session-engine";
import type { SessionState } from "@/lib/session-engine";

interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  lateJoinCutoff: string | null;
  totalMatchups?: number;
  roundDurationSeconds?: number;
  isSample?: boolean;
}

const ENTRY_FEE = process.env.NEXT_PUBLIC_ENTRY_FEE_USDC ?? "1.00";

export default function Arena() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<SessionState>("future");
  const [loading, setLoading] = useState(true);

  const walletAddress = wallets[0]?.address;
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  const fetchSession = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (authenticated) {
        const token = await getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("/api/sessions", { headers });
      if (res.ok) {
        const data = await res.json();
        const current = data.current || data.next || null;
        setSession(current);
        if (current) {
          const sessionState = getSessionState({
            ...current,
            scheduledAt: new Date(current.scheduledAt),
            lateJoinCutoff: current.lateJoinCutoff
              ? new Date(current.lateJoinCutoff)
              : null,
          } as never);
          setState(sessionState);
        }
      }
    } catch {
      // Failed to fetch session
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 10000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        await fetch("/api/referrals", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal
      }
    })();
  }, [authenticated, getAccessToken]);

  // For non-live states, show session state display with existing component
  if (loading) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Live state: show Enter Session page
  if (state === "live" && session) {
    return (
      <div className="spotr-page flex flex-1 flex-col">
        <PageHeader title="Enter Session" backHref="/" />

        <div className="spotr-mobile-shell flex flex-1 flex-col gap-4 px-5 py-4">
          {authenticated && shortAddress && (
            <div className="spotr-wallet-pill flex items-center justify-center gap-2 px-4">
              <Wallet className="h-4 w-4 text-[#b59d2d]" />
              <span className="font-mono text-[13px] text-[#cbcbcb]">{shortAddress}</span>
              <CheckCircle className="h-4 w-4 text-[#49ca63]" />
            </div>
          )}

          <div className="rounded-[20px] bg-[#f5d63d] px-5 py-6 text-center text-black">
            <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-black/55">
              SESSION ENTRY
            </p>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span className="font-display text-[68px] font-bold leading-none tracking-[-0.08em]">${ENTRY_FEE}</span>
              <span className="text-[28px] font-semibold tracking-[-0.05em] text-black/82">USDC</span>
            </div>
            <p className="mt-2 text-[14px] text-black/52">Devnet - Season 1</p>
          </div>

          <div className="spotr-panel px-4 py-4">
            <p className="mb-4 text-[13px] font-medium text-[#7d7d7d]">What you get</p>
            <div className="space-y-5">
              {[
                { icon: <Gamepad2 className="h-3.5 w-3.5 text-[#d3b93b]" />, text: "7-round prediction session" },
                { icon: <Coins className="h-3.5 w-3.5 text-[#d3b93b]" />, text: "Earn USDC for correct spots" },
                { icon: <Star className="h-3.5 w-3.5 text-[#d3b93b]" />, text: "Build your Taste Score" },
                { icon: <Gift className="h-3.5 w-3.5 text-[#d3b93b]" />, text: "NFT whitelist eligibility at 70 points" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#27220f]">
                    {item.icon}
                  </div>
                  <span className="text-[14px] text-[#d0d0d0]">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <Link
            href={`/arena/game?session=${session.id}${session.isSample ? "&sample=true" : ""}`}
            className="spotr-primary-button mt-2 flex w-full items-center justify-center gap-2"
          >
            <Shield className="h-4 w-4" />
            Ready to Play
          </Link>

          <p className="spotr-screen-footer pt-1 text-center">
            One session per wallet. Make it count!
          </p>
        </div>
      </div>
    );
  }

  // Non-live states: future, today-waiting, ended
  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      <div className="flex-1 flex flex-col justify-center">
        <SessionStateDisplay
          session={session}
          state={state}
        />
      </div>
    </div>
  );
}
