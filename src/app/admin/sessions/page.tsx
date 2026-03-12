"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Plus, Radio, Calendar, Box, CheckCircle } from "lucide-react";

interface Session {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  collectionAddress: string | null;
  _count: { matchups: number; gameResults: number };
}

export default function AdminSessions() {
  const { getAccessToken } = usePrivy();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [finalizing, setFinalizing] = useState<string | null>(null);
  const [form, setForm] = useState({
    weekNumber: "",
    title: "",
    scheduledAt: "",
  });

  const fetchSessions = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch("/api/admin/stats?type=sessions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSessions(await res.json());
  }, [getAccessToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    const token = await getAccessToken();
    await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        weekNumber: parseInt(form.weekNumber),
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      }),
    });
    setShowCreate(false);
    setForm({ weekNumber: "", title: "", scheduledAt: "" });
    fetchSessions();
  };

  const handleCreateCollection = async (weekNumber: number) => {
    const token = await getAccessToken();
    const res = await fetch("/api/nft/collection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionWeek: weekNumber }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to create collection");
    }
    fetchSessions();
  };

  const handleStatusChange = async (id: string, status: string) => {
    const token = await getAccessToken();
    await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    fetchSessions();
  };

  const handleFinalize = async (id: string) => {
    setFinalizing(id);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/sessions/${id}/finalize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Finalized: ${data.matchupsFinalized} matchups, ${data.resultsUpdated} results updated`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to finalize");
      }
    } finally {
      setFinalizing(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Sessions</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="btn-yellow px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {showCreate && (
        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] mb-4 space-y-3">
          <input
            type="number"
            placeholder="Week Number"
            value={form.weekNumber}
            onChange={(e) => setForm({ ...form, weekNumber: e.target.value })}
            className="w-full bg-[#111] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444]"
          />
          <input
            type="text"
            placeholder="Session Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-[#111] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444]"
          />
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            className="w-full bg-[#111] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#F5E642]"
          />
          <button
            onClick={handleCreate}
            className="w-full btn-yellow py-2 rounded-lg text-sm font-bold"
          >
            Create Session
          </button>
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-white font-bold text-sm">{session.title}</p>
                <p className="text-[#888] text-xs mt-0.5">
                  Week {session.weekNumber}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  session.status === "live"
                    ? "text-red-400 bg-red-400/10"
                    : session.status === "ended"
                      ? "text-green-400 bg-green-400/10"
                      : "text-[#F5E642] bg-[#F5E642]/10"
                }`}
              >
                {session.status === "live" && (
                  <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                )}
                {session.status}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[#888] text-xs mb-3">
              <Calendar className="w-3 h-3" />
              {new Date(session.scheduledAt).toLocaleString()}
            </div>

            <div className="flex items-center gap-2 text-xs text-[#888] mb-3">
              <span>{session._count.matchups}/{process.env.NEXT_PUBLIC_MATCHUPS_PER_SESSION ?? "28"} matchups</span>
              <span>|</span>
              <span>{session._count.gameResults} participants</span>
              {session.collectionAddress && (
                <>
                  <span>|</span>
                  <span className="text-[#F5E642]" title={session.collectionAddress}>
                    NFT Collection
                  </span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {session.status === "scheduled" && (
                <>
                  {!session.collectionAddress && (
                    <button
                      onClick={() => handleCreateCollection(session.weekNumber)}
                      className="flex-1 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Box className="w-3 h-3" /> Create Collection
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusChange(session.id, "live")}
                    className="flex-1 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium flex items-center justify-center gap-1"
                  >
                    <Radio className="w-3 h-3" /> Go Live
                  </button>
                  <Link
                    href={`/admin/sessions/${session.id}/matchups`}
                    className="flex-1 py-2 rounded-lg bg-[#2A2A2A] text-[#888] text-xs font-medium flex items-center justify-center"
                  >
                    Build Matchups
                  </Link>
                </>
              )}
              {session.status === "live" && (
                <button
                  onClick={() => handleStatusChange(session.id, "ended")}
                  className="flex-1 py-2 rounded-lg bg-[#F5E642]/10 text-[#F5E642] text-xs font-medium"
                >
                  End Session
                </button>
              )}
              {session.status === "ended" && (
                <button
                  onClick={() => handleFinalize(session.id)}
                  disabled={finalizing === session.id}
                  className="flex-1 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <CheckCircle className="w-3 h-3" />
                  {finalizing === session.id ? "Finalizing..." : "Finalize Results"}
                </button>
              )}
            </div>
          </div>
        ))}

        {sessions.length === 0 && (
          <p className="text-[#888] text-sm text-center py-8">
            No sessions yet. Create one to get started.
          </p>
        )}
      </div>
    </div>
  );
}
