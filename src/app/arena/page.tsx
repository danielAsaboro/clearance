"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Eye, Link2 } from "lucide-react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import SessionStateDisplay from "@/components/SessionStateDisplay";
import { getSessionState, generateCalendarICS } from "@/lib/session-engine";
import type { SessionState } from "@/lib/session-engine";

interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  lateJoinCutoff: string | null;
}

export default function Arena() {
  const { authenticated, getAccessToken } = usePrivy();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<SessionState>("future");
  const [loading, setLoading] = useState(true);

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

    // Record referral if the user arrived via a referral link.
    // The server reads the HTTP-only referral_code cookie automatically.
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

  const handleDownloadICS = () => {
    if (!session) return;
    const ics = generateCalendarICS({
      title: session.title,
      scheduledAt: new Date(session.scheduledAt),
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spotr-tv-session-week${session.weekNumber}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 bg-black flex flex-col px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <div className="w-10 h-10 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </Link>
        <div className="w-8 h-8 bg-[#F5E642] rounded-full flex items-center justify-center">
          <Eye className="w-4 h-4 text-black" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">The Arena</h1>
          <p className="text-[#888] text-xs">Live Voting Sessions</p>
        </div>
      </div>

      {/* Session Display */}
      <div className="flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <SessionStateDisplay
              session={session}
              state={state}
              onDownloadICS={handleDownloadICS}
            />

            {/* Share as Blink */}
            {session && (
              <div className="mt-4">
                <button
                  onClick={() => {
                    const origin = window.location.origin;
                    const actionUrl = `${origin}/api/actions/vote?session=${session.id}`;
                    const blinkUrl = `https://dial.to/?action=solana-action:${encodeURIComponent(actionUrl)}`;
                    navigator.clipboard.writeText(blinkUrl);
                    alert("Blink URL copied! Share it on Twitter/X.");
                  }}
                  className="w-full bg-[#1A1A1A] rounded-xl py-3 text-sm text-white flex items-center justify-center gap-2 border border-[#2A2A2A] hover:border-[#F5E642]/30 transition-colors"
                >
                  <Link2 className="w-4 h-4 text-[#F5E642]" />
                  Share as Blink
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
