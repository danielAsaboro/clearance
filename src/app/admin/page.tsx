"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import {
  Users,
  Film,
  Radio,
  Clock,
  ThumbsUp,
  Link2,
  Package,
  DollarSign,
  BarChart3,
  TrendingUp,
  Download,
  Trophy,
  Loader2,
} from "lucide-react";

interface Stats {
  totalPlayers: number;
  totalVideos: number;
  upcomingSession: { title: string; scheduledAt: string } | null;
  totalVotes: number;
  totalSessions: number;
  completedSessions: number;
  totalReferrals: number;
  totalGameResults: number;
  nftsMinted: number;
  usdcClaimed: number;
  sessionCompletionRate: number;
}

interface SessionTrend {
  sessionId: string;
  title: string;
  weekNumber: number;
  scheduledAt: string;
  participants: number;
  totalVotes: number;
  avgAccuracy: number;
  rewardsDistributed: number;
}

interface TopVideo {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  winRate: number;
  timesUsed: number;
  avgVoteShare: number;
}

interface TopPlayer {
  userId: string;
  displayName: string;
  profilePhoto: string | null;
  sessionsPlayed: number;
  correctVotes: number;
  accuracy: number;
}

interface Trends {
  sessionTrends: SessionTrend[];
  topVideos: TopVideo[];
  topPlayers: TopPlayer[];
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
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
      <Icon className="w-5 h-5 text-[#F5E642] mb-2" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[#888] text-xs">{label}</p>
    </div>
  );
}

function WinRateBar({ rate }: { rate: number }) {
  const color =
    rate >= 60 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#232323]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-xs text-[#ccc]">{rate}%</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { getAccessToken } = usePrivy();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState(false);
  const [trendsLoading, setTrendsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, trendsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/analytics/trends", { headers }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      else setError(true);

      if (trendsRes.ok) setTrends(await trendsRes.json());
    } catch {
      setError(true);
    } finally {
      setTrendsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleExport = async (type: string) => {
    const token = await getAccessToken();
    const res = await fetch(`/api/admin/analytics/export?type=${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spotr-${type}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>
        <p className="text-red-400 text-sm">Failed to load stats. Are you an admin?</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleExport("videos")}
            className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-[10px] text-[#999] flex items-center gap-1 hover:text-white"
          >
            <Download className="h-3 w-3" /> Videos CSV
          </button>
          <button
            onClick={() => void handleExport("players")}
            className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-[10px] text-[#999] flex items-center gap-1 hover:text-white"
          >
            <Download className="h-3 w-3" /> Players CSV
          </button>
          <button
            onClick={() => void handleExport("sessions")}
            className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-[10px] text-[#999] flex items-center gap-1 hover:text-white"
          >
            <Download className="h-3 w-3" /> Sessions CSV
          </button>
        </div>
      </div>

      {/* Core Stats */}
      <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Platform</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} value={stats?.totalPlayers ?? "-"} label="Total Players" />
        <StatCard icon={Film} value={stats?.totalVideos ?? "-"} label="Videos in Library" />
        <StatCard icon={Link2} value={stats?.totalReferrals ?? "-"} label="Referrals" />
        <StatCard icon={ThumbsUp} value={stats?.totalVotes ?? "-"} label="Total Votes" />
      </div>

      {/* Engagement Stats */}
      <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Engagement</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={TrendingUp} value={stats?.totalGameResults ?? "-"} label="Game Participations" />
        <StatCard
          icon={BarChart3}
          value={stats ? `${stats.sessionCompletionRate}%` : "-"}
          label="Session Completion"
        />
        <StatCard
          icon={Radio}
          value={stats ? `${stats.completedSessions}/${stats.totalSessions}` : "-"}
          label="Sessions (Done/Total)"
        />
      </div>

      {/* Rewards Stats */}
      <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Rewards</p>
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Package} value={stats?.nftsMinted ?? "-"} label="NFTs Minted" />
        <StatCard icon={DollarSign} value={stats?.usdcClaimed ?? "-"} label="USDC Claims" />
      </div>

      {/* Upcoming Session */}
      {stats?.upcomingSession && (
        <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-[#F5E642]" />
            <p className="text-white font-bold text-sm">Upcoming Session</p>
          </div>
          <p className="text-[#888] text-sm">{stats.upcomingSession.title}</p>
          <p className="text-[#F5E642] text-sm mt-1">
            {new Date(stats.upcomingSession.scheduledAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Session Trends */}
      {trendsLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#F5E642]" />
        </div>
      ) : trends ? (
        <>
          {/* Recent Sessions */}
          {trends.sessionTrends.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#888] text-xs uppercase tracking-wider">Recent Sessions</p>
                <Link href="/admin/sessions" className="text-[10px] text-[#F5E642] hover:underline">
                  View All
                </Link>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[#242424] bg-[#111]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#242424] text-[10px] uppercase tracking-wider text-[#666]">
                      <th className="px-4 py-2">Session</th>
                      <th className="px-4 py-2">Players</th>
                      <th className="px-4 py-2">Votes</th>
                      <th className="px-4 py-2">Accuracy</th>
                      <th className="px-4 py-2">Rewards</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trends.sessionTrends.slice(0, 5).map((s) => (
                      <tr key={s.sessionId} className="border-b border-[#1A1A1A]">
                        <td className="px-4 py-2">
                          <Link
                            href={`/admin/sessions/${s.sessionId}`}
                            className="text-white hover:text-[#F5E642] text-xs"
                          >
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-xs text-[#ccc]">{s.participants}</td>
                        <td className="px-4 py-2 text-xs text-[#ccc]">{s.totalVotes}</td>
                        <td className="px-4 py-2 text-xs text-[#ccc]">{s.avgAccuracy}%</td>
                        <td className="px-4 py-2 text-xs text-[#F5E642]">${s.rewardsDistributed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Videos */}
          {trends.topVideos.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#888] text-xs uppercase tracking-wider">Top Performing Videos</p>
                <Link href="/admin/videos/analytics" className="text-[10px] text-[#F5E642] hover:underline">
                  Full Analytics
                </Link>
              </div>
              <div className="space-y-2">
                {trends.topVideos.slice(0, 5).map((v, i) => (
                  <Link
                    key={v.id}
                    href={`/admin/videos/${v.id}/analytics`}
                    className="flex items-center gap-3 rounded-xl border border-[#242424] bg-[#111] p-3 hover:border-[#F5E642]/30"
                  >
                    <span className="text-xs font-bold text-[#F5E642] w-5">#{i + 1}</span>
                    {v.thumbnailUrl ? (
                      <img src={v.thumbnailUrl} alt="" className="h-8 w-12 rounded object-cover" />
                    ) : (
                      <div className="flex h-8 w-12 items-center justify-center rounded bg-[#222]">
                        <Film className="h-3 w-3 text-[#555]" />
                      </div>
                    )}
                    <span className="flex-1 truncate text-xs text-white">
                      {v.title ?? "Untitled"}
                    </span>
                    <WinRateBar rate={v.winRate} />
                    <span className="text-[10px] text-[#888]">{v.timesUsed} matchups</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Players */}
          {trends.topPlayers.length > 0 && (
            <div>
              <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Top Players</p>
              <div className="space-y-2">
                {trends.topPlayers.slice(0, 5).map((p, i) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-3 rounded-xl border border-[#242424] bg-[#111] p-3"
                  >
                    <span className="text-xs font-bold text-[#F5E642] w-5">#{i + 1}</span>
                    {p.profilePhoto ? (
                      <img src={p.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#222]">
                        <Users className="h-3 w-3 text-[#555]" />
                      </div>
                    )}
                    <span className="flex-1 truncate text-xs text-white">{p.displayName}</span>
                    <span className="text-xs text-[#ccc]">{p.correctVotes} correct</span>
                    <span className="text-[10px] text-[#888]">{p.sessionsPlayed} sessions</span>
                    <span className="text-xs font-medium text-[#F5E642]">{p.accuracy}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
