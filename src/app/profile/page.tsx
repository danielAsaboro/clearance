"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  DollarSign,
  Loader2,
  Package,
  Share2,
  Target,
  TrendingUp,
} from "lucide-react";

interface Overview {
  sessionsPlayed: number;
  totalVotes: number;
  correctVotes: number;
  overallAccuracy: number;
  totalEarnings: number;
  totalClaimed: number;
  pendingRewards: number;
  nftsMinted: number;
}

interface TrendItem {
  sessionId: string;
  sessionTitle: string;
  weekNumber: number;
  scheduledAt: string;
  accuracy: number;
  earnings: number;
}

interface GameHistoryItem {
  sessionId: string;
  sessionTitle: string;
  weekNumber: number;
  scheduledAt: string;
  totalVotes: number;
  correctVotes: number;
  totalMatchups: number;
  accuracy: number;
  rewardAmount: number;
  nftMinted: boolean;
  usdcClaimed: boolean;
  lateJoin: boolean;
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

export default function ProfilePage() {
  const { getAccessToken, user: privyUser, authenticated, ready } = usePrivy();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [history, setHistory] = useState<GameHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralLink = privyUser?.id
    ? `${window.location.origin}/ref/${privyUser.id}`
    : null;

  const copyReferralLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferralLink = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      await navigator.share({
        title: "Join me on Spotr TV",
        text: "Predict, compete & earn on Spotr TV!",
        url: referralLink,
      });
    } else {
      await copyReferralLink();
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/users/me/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data.overview);
        setTrend(data.recentTrend);
      }
    } catch {
      // ignore
    }
  }, [getAccessToken]);

  const fetchHistory = useCallback(
    async (page: number) => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch(`/api/users/me/history?page=${page}&limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.games);
          setTotalPages(data.totalPages);
          setHistoryPage(data.page);
        }
      } catch {
        // ignore
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchHistory(1)]);
      setLoading(false);
    })();
  }, [ready, authenticated, fetchStats, fetchHistory]);

  if (!ready || loading) {
    return (
      <div className="spotr-page flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5E642]" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="spotr-page flex flex-1 flex-col items-center justify-center gap-4 px-5">
        <p className="text-sm text-[#888]">Sign in to view your profile.</p>
        <Link href="/auth/login" className="spotr-primary-button px-6">
          Sign In
        </Link>
      </div>
    );
  }

  const walletAddress = privyUser?.wallet?.address;

  return (
    <div className="spotr-page min-h-dvh bg-black px-4 pb-8 pt-6">
      <div className="spotr-mobile-shell space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[#888] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Your Profile</h1>
            {walletAddress && (
              <p className="text-[11px] text-[#666]">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </p>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        {overview && (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Target} value={overview.sessionsPlayed} label="Sessions Played" />
            <StatCard icon={TrendingUp} value={`${overview.overallAccuracy}%`} label="Overall Accuracy" />
            <StatCard icon={DollarSign} value={`$${overview.totalEarnings}`} label="Total Earnings" />
            <StatCard icon={Package} value={overview.nftsMinted} label="NFTs Minted" />
          </div>
        )}

        {/* Referral Link */}
        {referralLink && (
          <div>
            <p className="mb-3 text-xs font-semibold text-[#888] uppercase tracking-wider">Invite Friends</p>
            <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 space-y-3">
              <p className="text-xs text-[#888]">Share your link and earn when friends join!</p>
              <div className="flex items-center gap-2 rounded-xl bg-black/50 border border-[#333] px-3 py-2">
                <span className="flex-1 truncate text-xs text-[#ccc]">{referralLink}</span>
                <button onClick={copyReferralLink} className="text-[#888] hover:text-white">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button
                onClick={shareReferralLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5E642] py-2.5 text-sm font-semibold text-black"
              >
                <Share2 className="h-4 w-4" />
                Share Referral Link
              </button>
            </div>
          </div>
        )}

        {/* Earnings Breakdown */}
        {overview && overview.totalEarnings > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold text-[#888] uppercase tracking-wider">Earnings</p>
            <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Total Earned</span>
                <span className="font-semibold text-white">${overview.totalEarnings}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#888]">Claimed</span>
                <span className="text-emerald-400">${overview.totalClaimed}</span>
              </div>
              {overview.pendingRewards > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#888]">Pending</span>
                  <span className="text-[#F5E642]">${overview.pendingRewards}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Accuracy Trend */}
        {trend.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold text-[#888] uppercase tracking-wider">
              Recent Performance
            </p>
            <div className="flex items-end gap-1.5">
              {trend
                .slice(0, 8)
                .reverse()
                .map((t) => {
                  const height = Math.max(8, (t.accuracy / 100) * 60);
                  const color =
                    t.accuracy >= 70
                      ? "bg-[#F5E642]"
                      : t.accuracy >= 40
                        ? "bg-[#888]"
                        : "bg-[#444]";
                  return (
                    <div key={t.sessionId} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[9px] text-[#888]">{t.accuracy}%</span>
                      <div
                        className={`w-full rounded-t ${color}`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[8px] text-[#666]">W{t.weekNumber}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Game History */}
        <div>
          <p className="mb-3 text-xs font-semibold text-[#888] uppercase tracking-wider">Game History</p>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2B2B2B] bg-[#101010] py-10 text-center">
              <Award className="mx-auto h-8 w-8 text-[#444]" />
              <p className="mt-3 text-sm text-[#888]">No games played yet.</p>
              <Link href="/arena" className="mt-3 inline-block text-sm text-[#F5E642] hover:underline">
                Play Now
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((g) => (
                <div
                  key={g.sessionId}
                  className="rounded-2xl border border-[#242424] bg-[#111] p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{g.sessionTitle}</p>
                    <p className="text-[10px] text-[#666]">
                      {new Date(g.scheduledAt).toLocaleDateString()} {g.lateJoin ? "- Late Join" : ""}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-[#ccc]">
                    <span>
                      {g.correctVotes}/{g.totalMatchups} correct
                    </span>
                    <span className="text-[#F5E642]">{g.accuracy}%</span>
                    {g.rewardAmount > 0 && (
                      <span className="text-emerald-400">${g.rewardAmount}</span>
                    )}
                    {g.nftMinted && (
                      <span className="rounded bg-[#222] px-1.5 py-0.5 text-[9px] text-[#aaa]">
                        NFT
                      </span>
                    )}
                    {g.usdcClaimed && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-400">
                        CLAIMED
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-2">
                  <button
                    onClick={() => void fetchHistory(historyPage - 1)}
                    disabled={historyPage <= 1}
                    className="rounded-lg border border-[#2A2A2A] p-1.5 text-[#888] disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-[#888]">
                    {historyPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => void fetchHistory(historyPage + 1)}
                    disabled={historyPage >= totalPages}
                    className="rounded-lg border border-[#2A2A2A] p-1.5 text-[#888] disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
