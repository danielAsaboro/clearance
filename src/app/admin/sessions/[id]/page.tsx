"use client";

import { useState, useEffect, useCallback, use } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Users,
  Vote,
  Target,
  Trophy,
  Star,
  Award,
  Clock,
  Wallet,
  Package,
  Eye,
  DollarSign,
  TrendingDown,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────

interface SessionOverview {
  totalParticipants: number;
  totalMatchups: number;
  totalVotes: number;
  tierDistribution: { gold: number; base: number; participation: number };
  lateJoiners: number;
  averageAccuracy: number;
  nftsMinted: number;
  nftsRevealed: number;
  usdcClaimed: number;
  totalRewardsUsdc: number;
  depositsConfirmed: number;
  dropOffCount: number;
}

interface MatchupData {
  matchupNumber: number;
  videoA: { id: string; title: string | null };
  videoB: { id: string; title: string | null };
  winningVideo: { id: string; title: string | null } | null;
  totalVotes: number;
  videoAVotes: number;
  videoBVotes: number;
  consensusRate: number;
}

interface PlayerData {
  rank: number;
  userId: string;
  displayName: string | null;
  email: string | null;
  walletAddress: string | null;
  totalVotes: number;
  correctVotes: number;
  accuracy: number;
  tier: string | null;
  rewardAmount: number;
  nftMinted: boolean;
  nftRevealed: boolean;
  usdcClaimed: boolean;
  claimedAt: string | null;
  depositConfirmed: boolean;
  lateJoin: boolean;
  joinedAt: string;
  votedAllMatchups: boolean;
}

interface ReferralData {
  referrerName: string | null;
  referredName: string | null;
  code: string;
  createdAt: string;
}

interface DiscountCodeData {
  code: string;
  userName: string | null;
  usedAt: string | null;
}

interface AnalyticsData {
  session: {
    id: string;
    weekNumber: number;
    title: string;
    scheduledAt: string;
    status: string;
    collectionAddress: string | null;
    vaultAddress: string | null;
  };
  overview: SessionOverview;
  matchups: MatchupData[];
  players: PlayerData[];
  referrals: ReferralData[];
  discountCodes: DiscountCodeData[];
}

type Tab = "overview" | "players" | "matchups" | "shares";
type SortField = "rank" | "accuracy" | "correctVotes" | "rewardAmount";

// ─── CSV Helpers ─────────────────────────────────────────────

function escapeCSV(value: string | number | boolean | null | undefined): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generatePlayersCSV(players: PlayerData[], sessionTitle: string) {
  const headers = [
    "Rank",
    "Player",
    "Email",
    "Wallet",
    "Votes",
    "Correct",
    "Accuracy%",
    "Tier",
    "Reward (USDC)",
    "NFT Minted",
    "NFT Revealed",
    "USDC Claimed",
    "Claimed At",
    "Deposit Confirmed",
    "Late Join",
    "Joined At",
  ];
  const rows = players.map((p) =>
    [
      p.rank,
      p.displayName ?? "Anonymous",
      p.email ?? "",
      p.walletAddress ?? "",
      p.totalVotes,
      p.correctVotes,
      p.accuracy,
      p.tier ?? "—",
      p.rewardAmount.toFixed(2),
      p.nftMinted ? "Yes" : "No",
      p.nftRevealed ? "Yes" : "No",
      p.usdcClaimed ? "Yes" : "No",
      p.claimedAt ? new Date(p.claimedAt).toISOString() : "",
      p.depositConfirmed ? "Yes" : "No",
      p.lateJoin ? "Yes" : "No",
      new Date(p.joinedAt).toISOString(),
    ]
      .map(escapeCSV)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  downloadCSV(`${sessionTitle.replace(/\s+/g, "_")}_players.csv`, csv);
}

function generateMatchupsCSV(matchups: MatchupData[], sessionTitle: string) {
  const headers = [
    "Matchup#",
    "Video A",
    "Video B",
    "Winner",
    "A Votes",
    "B Votes",
    "Total Votes",
    "Consensus%",
  ];
  const rows = matchups.map((m) =>
    [
      m.matchupNumber,
      m.videoA.title ?? m.videoA.id,
      m.videoB.title ?? m.videoB.id,
      m.winningVideo?.title ?? "Undecided",
      m.videoAVotes,
      m.videoBVotes,
      m.totalVotes,
      m.consensusRate,
    ]
      .map(escapeCSV)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  downloadCSV(`${sessionTitle.replace(/\s+/g, "_")}_matchups.csv`, csv);
}

// ─── Component ───────────────────────────────────────────────

export default function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const { getAccessToken } = usePrivy();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [playerSearch, setPlayerSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    const token = await getAccessToken();
    const res = await fetch(`/api/admin/sessions/${sessionId}/analytics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [getAccessToken, sessionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#F5E642] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Link href="/admin/sessions" className="text-[#888] text-sm">
          Back to Sessions
        </Link>
        <p className="text-[#888] text-sm text-center py-8">
          Session not found.
        </p>
      </div>
    );
  }

  const { session, overview, matchups, players, referrals, discountCodes } =
    data;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "players", label: `Players (${overview.totalParticipants})` },
    { key: "matchups", label: `Matchups (${overview.totalMatchups})` },
    { key: "shares", label: "Shares" },
  ];

  // Player filtering & sorting
  const filteredPlayers = players.filter(
    (p) =>
      !playerSearch ||
      (p.displayName ?? "").toLowerCase().includes(playerSearch.toLowerCase()) ||
      (p.email ?? "").toLowerCase().includes(playerSearch.toLowerCase())
  );

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    if (sortField === "rank") return (a.rank - b.rank) * mul;
    if (sortField === "accuracy") return (a.accuracy - b.accuracy) * mul;
    if (sortField === "correctVotes")
      return (a.correctVotes - b.correctVotes) * mul;
    if (sortField === "rewardAmount")
      return (a.rewardAmount - b.rewardAmount) * mul;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "rank");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/admin/sessions">
          <div className="w-8 h-8 rounded-full border border-[#333] flex items-center justify-center hover:border-[#F5E642]/50 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white" />
          </div>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{session.title}</h1>
          <p className="text-[#888] text-xs">
            Week {session.weekNumber} &middot;{" "}
            {new Date(session.scheduledAt).toLocaleDateString()} &middot;{" "}
            <span
              className={
                session.status === "live"
                  ? "text-red-400"
                  : session.status === "ended"
                    ? "text-green-400"
                    : "text-[#F5E642]"
              }
            >
              {session.status}
            </span>
          </p>
        </div>
        {/* CSV Downloads */}
        <div className="flex gap-1.5">
          <button
            onClick={() => generatePlayersCSV(players, session.title)}
            className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[10px] text-white hover:border-[#F5E642]/30 transition-colors"
            title="Download players CSV"
          >
            <Download className="w-3 h-3" /> Players
          </button>
          <button
            onClick={() => generateMatchupsCSV(matchups, session.title)}
            className="flex items-center gap-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-[10px] text-white hover:border-[#F5E642]/30 transition-colors"
            title="Download matchups CSV"
          >
            <Download className="w-3 h-3" /> Matchups
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 bg-[#111] rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-[#F5E642] text-black"
                : "text-[#888] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ─── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Participants"
              value={overview.totalParticipants}
            />
            <StatCard
              icon={<Vote className="w-4 h-4" />}
              label="Total Votes"
              value={overview.totalVotes}
            />
            <StatCard
              icon={<Target className="w-4 h-4" />}
              label="Avg Accuracy"
              value={`${overview.averageAccuracy}%`}
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Late Joiners"
              value={`${overview.lateJoiners} (${overview.totalParticipants > 0 ? Math.round((overview.lateJoiners / overview.totalParticipants) * 100) : 0}%)`}
            />
            <StatCard
              icon={<Package className="w-4 h-4" />}
              label="NFTs Minted"
              value={`${overview.nftsMinted}/${overview.totalParticipants}`}
            />
            <StatCard
              icon={<Eye className="w-4 h-4" />}
              label="NFTs Revealed"
              value={`${overview.nftsRevealed}/${overview.totalParticipants}`}
            />
            <StatCard
              icon={<DollarSign className="w-4 h-4" />}
              label="USDC Claimed"
              value={`${overview.usdcClaimed}/${overview.totalParticipants}`}
            />
            <StatCard
              icon={<Wallet className="w-4 h-4" />}
              label="Deposits Confirmed"
              value={`${overview.depositsConfirmed}/${overview.totalParticipants}`}
            />
            <StatCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Total Rewards"
              value={`$${overview.totalRewardsUsdc.toFixed(2)}`}
              className="col-span-2"
            />
            <StatCard
              icon={<TrendingDown className="w-4 h-4" />}
              label="Drop-off"
              value={`${overview.dropOffCount} players didn't vote all rounds`}
              className="col-span-2"
            />
          </div>

          {/* Tier Distribution */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
            <h3 className="text-white text-sm font-bold mb-3">
              Tier Distribution
            </h3>
            <TierBar
              label="Gold"
              count={overview.tierDistribution.gold}
              total={overview.totalParticipants}
              color="bg-yellow-400"
              textColor="text-yellow-400"
            />
            <TierBar
              label="Base"
              count={overview.tierDistribution.base}
              total={overview.totalParticipants}
              color="bg-blue-400"
              textColor="text-blue-400"
            />
            <TierBar
              label="Participation"
              count={overview.tierDistribution.participation}
              total={overview.totalParticipants}
              color="bg-[#555]"
              textColor="text-[#888]"
            />
          </div>

          {/* Votes per Matchup */}
          <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
            <h3 className="text-white text-sm font-bold mb-3">
              Votes per Matchup
            </h3>
            <div className="space-y-2">
              {matchups.map((m) => {
                const maxVotes = Math.max(
                  ...matchups.map((x) => x.totalVotes),
                  1
                );
                return (
                  <div key={m.matchupNumber} className="flex items-center gap-2">
                    <span className="text-[#555] text-[10px] w-4 text-right">
                      {m.matchupNumber}
                    </span>
                    <div className="flex-1 h-4 bg-[#111] rounded overflow-hidden">
                      <div
                        className="h-full bg-[#F5E642]/60 rounded"
                        style={{
                          width: `${(m.totalVotes / maxVotes) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-[#888] text-[10px] w-6 text-right">
                      {m.totalVotes}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Players Tab ─── */}
      {tab === "players" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 relative">
              <Search className="w-3.5 h-3.5 text-[#555] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search players..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="w-full bg-[#111] text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:ring-1 focus:ring-[#F5E642] placeholder:text-[#444]"
              />
            </div>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A]">
                  <TableHead
                    className="text-[#888] text-[10px] cursor-pointer"
                    onClick={() => handleSort("rank")}
                  >
                    <span className="flex items-center gap-0.5">
                      # <ArrowUpDown className="w-2.5 h-2.5" />
                    </span>
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    Player
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    Votes
                  </TableHead>
                  <TableHead
                    className="text-[#888] text-[10px] cursor-pointer"
                    onClick={() => handleSort("correctVotes")}
                  >
                    <span className="flex items-center gap-0.5">
                      Correct <ArrowUpDown className="w-2.5 h-2.5" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-[#888] text-[10px] cursor-pointer"
                    onClick={() => handleSort("accuracy")}
                  >
                    <span className="flex items-center gap-0.5">
                      Acc% <ArrowUpDown className="w-2.5 h-2.5" />
                    </span>
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    Tier
                  </TableHead>
                  <TableHead
                    className="text-[#888] text-[10px] cursor-pointer"
                    onClick={() => handleSort("rewardAmount")}
                  >
                    <span className="flex items-center gap-0.5">
                      Reward <ArrowUpDown className="w-2.5 h-2.5" />
                    </span>
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    NFT
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    USDC
                  </TableHead>
                  <TableHead className="text-[#888] text-[10px]">
                    Late
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlayers.map((p) => (
                  <TableRow key={p.userId} className="border-[#2A2A2A]">
                    <TableCell className="text-[#555] text-xs">
                      {p.rank}
                    </TableCell>
                    <TableCell>
                      <p className="text-white text-xs font-medium">
                        {p.displayName ?? "Anonymous"}
                      </p>
                      {p.walletAddress && (
                        <p className="text-[#555] text-[10px]">
                          {p.walletAddress.slice(0, 4)}...
                          {p.walletAddress.slice(-4)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-[#888] text-xs">
                      {p.totalVotes}
                    </TableCell>
                    <TableCell className="text-white text-xs">
                      {p.correctVotes}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span
                        className={
                          p.accuracy >= 75
                            ? "text-yellow-400"
                            : p.accuracy >= 36
                              ? "text-blue-400"
                              : "text-[#888]"
                        }
                      >
                        {p.accuracy}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          p.tier === "gold"
                            ? "text-yellow-400 bg-yellow-400/10"
                            : p.tier === "base"
                              ? "text-blue-400 bg-blue-400/10"
                              : "text-[#888] bg-[#888]/10"
                        }`}
                      >
                        {p.tier ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#F5E642] text-xs">
                      {p.rewardAmount > 0
                        ? `$${p.rewardAmount.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.nftMinted ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-[#555]">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.usdcClaimed ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-[#555]">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.lateJoin ? (
                        <span className="text-orange-400">Yes</span>
                      ) : (
                        <span className="text-[#555]">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedPlayers.length === 0 && (
              <p className="text-[#888] text-xs text-center py-6">
                {playerSearch ? "No players match your search." : "No players yet."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Matchups Tab ─── */}
      {tab === "matchups" && (
        <div className="space-y-3">
          {matchups.map((m) => (
            <div
              key={m.matchupNumber}
              className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[#555] text-[10px] uppercase tracking-wider">
                  Matchup {m.matchupNumber}
                </p>
                <p className="text-[#888] text-[10px]">
                  {m.totalVotes} votes &middot; {m.consensusRate}% consensus
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`flex-1 text-xs font-medium text-right ${
                    m.winningVideo?.id === m.videoA.id
                      ? "text-[#F5E642]"
                      : "text-white"
                  }`}
                >
                  {m.videoA.title ?? "Video A"}
                  {m.winningVideo?.id === m.videoA.id && (
                    <Trophy className="w-3 h-3 inline ml-1 text-[#F5E642]" />
                  )}
                </span>
                <span className="text-[#555] text-[10px] font-bold">vs</span>
                <span
                  className={`flex-1 text-xs font-medium ${
                    m.winningVideo?.id === m.videoB.id
                      ? "text-[#F5E642]"
                      : "text-white"
                  }`}
                >
                  {m.winningVideo?.id === m.videoB.id && (
                    <Trophy className="w-3 h-3 inline mr-1 text-[#F5E642]" />
                  )}
                  {m.videoB.title ?? "Video B"}
                </span>
              </div>

              {/* Vote Split Bar */}
              {m.totalVotes > 0 ? (
                <div className="relative h-6 rounded-lg overflow-hidden flex">
                  <div
                    className="bg-blue-500 flex items-center justify-start pl-1.5"
                    style={{
                      width: `${(m.videoAVotes / m.totalVotes) * 100}%`,
                    }}
                  >
                    {m.videoAVotes > 0 && (
                      <span className="text-white text-[10px] font-bold">
                        {m.videoAVotes}
                      </span>
                    )}
                  </div>
                  <div
                    className="bg-red-500 flex items-center justify-end pr-1.5"
                    style={{
                      width: `${(m.videoBVotes / m.totalVotes) * 100}%`,
                    }}
                  >
                    {m.videoBVotes > 0 && (
                      <span className="text-white text-[10px] font-bold">
                        {m.videoBVotes}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[#555] text-[10px] text-center">
                  No votes yet
                </p>
              )}
            </div>
          ))}

          {matchups.length === 0 && (
            <p className="text-[#888] text-xs text-center py-8">
              No matchups configured.
            </p>
          )}
        </div>
      )}

      {/* ─── Shares Tab ─── */}
      {tab === "shares" && (
        <div className="space-y-4">
          {/* Referrals */}
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A2A]">
              <h3 className="text-white text-sm font-bold">
                Referrals ({referrals.length})
              </h3>
            </div>
            {referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#888] text-[10px]">
                      Referrer
                    </TableHead>
                    <TableHead className="text-[#888] text-[10px]">
                      Referred
                    </TableHead>
                    <TableHead className="text-[#888] text-[10px]">
                      Code
                    </TableHead>
                    <TableHead className="text-[#888] text-[10px]">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((r, i) => (
                    <TableRow key={i} className="border-[#2A2A2A]">
                      <TableCell className="text-white text-xs">
                        {r.referrerName ?? "Anonymous"}
                      </TableCell>
                      <TableCell className="text-white text-xs">
                        {r.referredName ?? "Anonymous"}
                      </TableCell>
                      <TableCell className="text-[#888] text-xs font-mono">
                        {r.code}
                      </TableCell>
                      <TableCell className="text-[#888] text-xs">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-[#888] text-xs text-center py-6">
                No referrals for this session.
              </p>
            )}
          </div>

          {/* Discount Codes */}
          <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2A2A2A]">
              <h3 className="text-white text-sm font-bold">
                Discount Codes ({discountCodes.length})
                {discountCodes.length > 0 && (
                  <span className="text-[#888] font-normal ml-2 text-[10px]">
                    {discountCodes.filter((dc) => dc.usedAt).length} redeemed
                  </span>
                )}
              </h3>
            </div>
            {discountCodes.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A]">
                    <TableHead className="text-[#888] text-[10px]">
                      Code
                    </TableHead>
                    <TableHead className="text-[#888] text-[10px]">
                      User
                    </TableHead>
                    <TableHead className="text-[#888] text-[10px]">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discountCodes.map((dc, i) => (
                    <TableRow key={i} className="border-[#2A2A2A]">
                      <TableCell className="text-white text-xs font-mono">
                        {dc.code}
                      </TableCell>
                      <TableCell className="text-white text-xs">
                        {dc.userName ?? "Anonymous"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {dc.usedAt ? (
                          <span className="text-green-400">
                            Used {new Date(dc.usedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-[#888]">Unused</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-[#888] text-xs text-center py-6">
                No discount codes for this session.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#1A1A1A] rounded-xl p-3 border border-[#2A2A2A] ${className}`}
    >
      <div className="flex items-center gap-2 mb-1 text-[#888]">{icon}</div>
      <p className="text-white font-bold text-lg">{value}</p>
      <p className="text-[#888] text-[10px]">{label}</p>
    </div>
  );
}

function TierBar({
  label,
  count,
  total,
  color,
  textColor,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  textColor: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <span className={`text-xs w-24 ${textColor}`}>{label}</span>
      <div className="flex-1 h-5 bg-[#111] rounded overflow-hidden">
        <div
          className={`h-full ${color} rounded`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[#888] text-[10px] w-16 text-right">
        {count} ({pct}%)
      </span>
    </div>
  );
}
