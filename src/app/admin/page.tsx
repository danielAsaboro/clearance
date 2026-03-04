"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
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

export default function AdminDashboard() {
  const { getAccessToken } = usePrivy();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setStats(await res.json());
        else setError(true);
      } catch {
        setError(true);
      }
    };
    fetchStats();
  }, [getAccessToken]);

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>
        <p className="text-red-400 text-sm">Failed to load stats. Are you an admin?</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Dashboard</h1>

      {/* Core Stats */}
      <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Platform</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={Users} value={stats?.totalPlayers ?? "-"} label="Total Players" />
        <StatCard icon={Film} value={stats?.totalVideos ?? "-"} label="Videos in Library" />
        <StatCard icon={Link2} value={stats?.totalReferrals ?? "-"} label="Referrals" />
        <StatCard icon={ThumbsUp} value={stats?.totalVotes ?? "-"} label="Total Votes" />
      </div>

      {/* Voting & Session Stats */}
      <p className="text-[#888] text-xs uppercase tracking-wider mb-3">Engagement</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
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
      <div className="grid grid-cols-2 gap-3 mb-6">
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
    </div>
  );
}
