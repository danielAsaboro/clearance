"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ArrowLeft, Film, Loader2, Trophy, TrendingUp, BarChart3, Eye } from "lucide-react";
import Link from "next/link";

interface VideoInfo {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  tags: string[];
  status: string;
  createdAt: string;
}

interface Stats {
  timesUsed: number;
  timesWon: number;
  timesLost: number;
  totalVotesFor: number;
  totalVotesAgainst: number;
  winRate: number;
  avgVoteShare: number;
  sessionsAppeared: number;
  lastUsedAt: string | null;
}

interface MatchupHistoryItem {
  sessionId: string;
  sessionTitle: string;
  weekNumber: number;
  scheduledAt: string;
  matchupNumber: number;
  opponent: { id: string; title: string | null };
  won: boolean;
  lost: boolean;
  votesFor: number;
  votesAgainst: number;
  voteShare: number;
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
      <Icon className="mb-1 h-4 w-4 text-[#F5E642]" />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-[10px] text-[#888]">{label}</p>
    </div>
  );
}

export default function VideoDetailAnalytics() {
  const { id } = useParams<{ id: string }>();
  const { getAccessToken } = usePrivy();
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<MatchupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/videos/${id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVideo(data.video);
        setStats(data.stats);
        setHistory(data.matchupHistory);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#F5E642]" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[#888]">Video not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/videos/analytics"
          className="rounded-xl border border-[#2A2A2A] p-2 text-[#888] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-4">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt=""
              className="h-14 w-20 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-14 w-20 items-center justify-center rounded-xl bg-[#222]">
              <Film className="h-6 w-6 text-[#444]" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">
              {video.title ?? "Untitled"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-[#888]">
              {video.category && (
                <span className="rounded-full bg-[#1A1A1A] px-2 py-0.5">
                  {video.category}
                </span>
              )}
              <span>
                Added {new Date(video.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Trophy} value={`${stats.winRate}%`} label="Win Rate" />
          <StatCard icon={BarChart3} value={stats.timesUsed} label="Times Used" />
          <StatCard icon={TrendingUp} value={`${stats.avgVoteShare}%`} label="Avg Vote Share" />
          <StatCard icon={Eye} value={stats.sessionsAppeared} label="Sessions" />
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.timesWon}</p>
            <p className="text-[10px] text-[#888]">Wins</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.timesLost}</p>
            <p className="text-[10px] text-[#888]">Losses</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {stats.totalVotesFor + stats.totalVotesAgainst}
            </p>
            <p className="text-[10px] text-[#888]">Total Votes</p>
          </div>
        </div>
      )}

      {/* Matchup History */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">Matchup History</h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2B2B2B] bg-[#101010] py-10 text-center">
            <p className="text-sm text-[#888]">This video has not been used in any matchups yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#242424] bg-[#111]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#242424] text-[11px] uppercase tracking-wider text-[#888]">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Opponent</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Votes</th>
                  <th className="px-4 py-3">Vote Share</th>
                </tr>
              </thead>
              <tbody>
                {history.map((m, i) => (
                  <tr
                    key={`${m.sessionId}-${m.matchupNumber}`}
                    className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/sessions/${m.sessionId}`}
                        className="text-white hover:text-[#F5E642]"
                      >
                        {m.sessionTitle}
                      </Link>
                      <p className="text-[10px] text-[#666]">
                        {new Date(m.scheduledAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">#{m.matchupNumber}</td>
                    <td className="px-4 py-3">
                      <span className="text-[#ccc]">
                        {m.opponent.title ?? "Untitled"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.won ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          WON
                        </span>
                      ) : m.lost ? (
                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                          LOST
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#333]/50 px-2 py-0.5 text-[10px] text-[#888]">
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">
                      {m.votesFor} / {m.votesFor + m.votesAgainst}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#232323]">
                          <div
                            className="h-full rounded-full bg-[#F5E642]"
                            style={{ width: `${Math.min(m.voteShare, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#ccc]">{m.voteShare}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
