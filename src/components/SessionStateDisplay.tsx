"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Radio, CheckCircle, Bell } from "lucide-react";
import Link from "next/link";
import type { SessionState } from "@/lib/session-engine";

interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  totalMatchups?: number;
  roundDurationSeconds?: number;
}

interface SessionStateDisplayProps {
  session: SessionData | null;
  state: SessionState;
  onDownloadICS?: () => void;
}

export default function SessionStateDisplay({
  session,
  state,
  onDownloadICS,
}: SessionStateDisplayProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!session || (state !== "future" && state !== "today-waiting")) return;

    const update = () => {
      const now = new Date();
      const target = new Date(session.scheduledAt);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("Starting...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session, state]);

  if (!session) {
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] text-center">
        <Clock className="w-12 h-12 text-[#555] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No Upcoming Session</h2>
        <p className="text-[#888] text-sm">Check back soon for the next live session.</p>
      </div>
    );
  }

  if (state === "future") {
    const date = new Date(session.scheduledAt);
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] text-center">
        <Calendar className="w-12 h-12 text-[#F5E642] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">{session.title}</h2>
        <p className="text-[#888] text-sm mb-1">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p className="text-[#F5E642] text-sm font-medium mb-6">
          {date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        {onDownloadICS && (
          <button
            onClick={onDownloadICS}
            className="btn-dark px-6 py-3 rounded-xl text-sm text-white border border-[#2A2A2A] hover:border-[#F5E642]/40"
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Add to Calendar
          </button>
        )}
      </div>
    );
  }

  if (state === "today-waiting") {
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] text-center">
        <div className="text-5xl font-bold text-[#F5E642] tracking-wider mb-4 font-mono">
          {countdown}
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{session.title}</h2>
        <p className="text-[#888] text-sm mb-6">Session starts soon. Get ready!</p>
        <div className="flex justify-center gap-6 text-center mb-6">
          <div>
            <p className="text-white font-bold">{session.totalMatchups ?? "—"}</p>
            <p className="text-[#888] text-xs">Rounds</p>
          </div>
          <div>
            <p className="text-white font-bold">{session.roundDurationSeconds ?? "—"}s</p>
            <p className="text-[#888] text-xs">Per Round</p>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          {onDownloadICS && (
            <button
              onClick={onDownloadICS}
              className="px-5 py-3 rounded-xl text-sm text-white border border-[#2A2A2A] hover:border-[#F5E642]/40 flex items-center gap-2"
            >
              <Bell className="w-4 h-4 text-[#F5E642]" />
              Set Reminder
            </button>
          )}
        </div>
      </div>
    );
  }

  if (state === "live") {
    return (
      <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#F5E642]/30 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 font-bold text-sm tracking-wider">LIVE</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{session.title}</h2>
        <p className="text-[#888] text-sm mb-6">Session is happening now!</p>
        <Link
          href={`/arena/game?session=${session.id}`}
          className="btn-yellow inline-block px-8 py-4 rounded-xl font-bold text-base"
        >
          <Radio className="w-5 h-5 inline mr-2" />
          Join Session Now
        </Link>
      </div>
    );
  }

  // ended
  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] text-center">
      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Session Complete</h2>
      <p className="text-[#888] text-sm mb-6">{session.title} has ended.</p>
      <div className="flex gap-3 justify-center">
        <Link
          href={`/arena/results?session=${session.id}`}
          className="btn-yellow px-6 py-3 rounded-xl font-bold text-sm"
        >
          View Results
        </Link>
      </div>
    </div>
  );
}
