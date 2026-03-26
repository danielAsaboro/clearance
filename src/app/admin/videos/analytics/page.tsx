"use client";

import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
  Trophy,
} from "lucide-react";
import Link from "next/link";

interface VideoAnalyticsItem {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: string;
  category: string | null;
  categoryId: string | null;
  timesUsed: number;
  timesWon: number;
  timesLost: number;
  winRate: number;
  avgVoteShare: number;
  sessionsAppeared: number;
  lastUsedAt: string | null;
}

interface Aggregates {
  avgWinRate: number;
  totalMatchups: number;
  totalVideosUsed: number;
  neverUsedCount: number;
}

type SortField = "winRate" | "timesUsed" | "avgVoteShare" | "sessionsAppeared" | "timesWon";

const PAGE_SIZE = 20;

function WinRateBar({ rate }: { rate: number }) {
  const color =
    rate >= 60 ? "bg-emerald-500" : rate >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-[#232323]">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-white">{rate}%</span>
    </div>
  );
}

export default function VideoAnalyticsPage() {
  const { getAccessToken } = usePrivy();
  const [videos, setVideos] = useState<VideoAnalyticsItem[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("winRate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchData = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const params = new URLSearchParams({
          sort: sortField,
          order: sortOrder,
          page: String(targetPage),
          limit: String(PAGE_SIZE),
        });
        const res = await fetch(`/api/admin/analytics/videos?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setVideos(data.videos);
          setAggregates(data.aggregates);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setTotal(data.total);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [getAccessToken, sortField, sortOrder]
  );

  useEffect(() => {
    void fetchData(1);
  }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortOrder === "desc" ? " \u2193" : " \u2191") : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/videos"
          className="rounded-xl border border-[#2A2A2A] p-2 text-[#888] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Video Analytics</h1>
          <p className="text-xs text-[#7D7D7D]">
            Performance metrics across all sessions
          </p>
        </div>
      </div>

      {/* Aggregate Stats */}
      {aggregates && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <BarChart3 className="mb-1 h-4 w-4 text-[#F5E642]" />
            <p className="text-xl font-bold text-white">{aggregates.avgWinRate}%</p>
            <p className="text-[10px] text-[#888]">Avg Win Rate</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <Trophy className="mb-1 h-4 w-4 text-[#F5E642]" />
            <p className="text-xl font-bold text-white">{aggregates.totalMatchups}</p>
            <p className="text-[10px] text-[#888]">Total Matchups</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <Film className="mb-1 h-4 w-4 text-[#F5E642]" />
            <p className="text-xl font-bold text-white">{aggregates.totalVideosUsed}</p>
            <p className="text-[10px] text-[#888]">Videos Used</p>
          </div>
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <Film className="mb-1 h-4 w-4 text-[#888]" />
            <p className="text-xl font-bold text-white">{aggregates.neverUsedCount}</p>
            <p className="text-[10px] text-[#888]">Never Used</p>
          </div>
        </div>
      )}

      {/* Videos Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#F5E642]" />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#2B2B2B] bg-[#101010] py-16 text-center">
          <p className="text-sm text-[#9A9A9A]">No video stats available yet. Finalize a session first.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[#242424] bg-[#111]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#242424] text-[11px] uppercase tracking-wider text-[#888]">
                  <th className="px-4 py-3">Video</th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-white"
                    onClick={() => toggleSort("timesUsed")}
                  >
                    Used{sortIndicator("timesUsed")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-white"
                    onClick={() => toggleSort("timesWon")}
                  >
                    Won{sortIndicator("timesWon")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-white"
                    onClick={() => toggleSort("winRate")}
                  >
                    Win Rate{sortIndicator("winRate")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-white"
                    onClick={() => toggleSort("avgVoteShare")}
                  >
                    Avg Vote %{sortIndicator("avgVoteShare")}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-white"
                    onClick={() => toggleSort("sessionsAppeared")}
                  >
                    Sessions{sortIndicator("sessionsAppeared")}
                  </th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/videos/${v.id}/analytics`}
                        className="flex items-center gap-3 hover:text-[#F5E642]"
                      >
                        {v.thumbnailUrl ? (
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            className="h-8 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-12 items-center justify-center rounded bg-[#222]">
                            <Film className="h-3 w-3 text-[#555]" />
                          </div>
                        )}
                        <span className="max-w-[200px] truncate text-white">
                          {v.title ?? "Untitled"}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">{v.timesUsed}</td>
                    <td className="px-4 py-3 text-[#ccc]">
                      {v.timesWon}/{v.timesUsed}
                    </td>
                    <td className="px-4 py-3">
                      <WinRateBar rate={v.winRate} />
                    </td>
                    <td className="px-4 py-3 text-[#ccc]">{v.avgVoteShare}%</td>
                    <td className="px-4 py-3 text-[#ccc]">{v.sessionsAppeared}</td>
                    <td className="px-4 py-3">
                      {v.category ? (
                        <span className="rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[10px] text-[#aaa]">
                          {v.category}
                        </span>
                      ) : (
                        <span className="text-[#555]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#888]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} videos
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void fetchData(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-[#2A2A2A] p-2 text-[#888] hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-[#888]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => void fetchData(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-[#2A2A2A] p-2 text-[#888] hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
