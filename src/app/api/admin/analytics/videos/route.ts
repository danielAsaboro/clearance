import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/admin/analytics/videos — Cross-video comparison leaderboard
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") ?? "winRate";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20")), 100);
  const categoryId = searchParams.get("categoryId");

  const allowedSortFields = ["winRate", "timesUsed", "avgVoteShare", "sessionsAppeared", "timesWon"];
  const sortField = allowedSortFields.includes(sort) ? sort : "winRate";

  // Get all videos with their stats
  const videoWhere: Record<string, unknown> = {};
  if (categoryId) videoWhere.categoryId = categoryId;

  const videos = await prisma.video.findMany({
    where: videoWhere,
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      status: true,
      category: { select: { id: true, name: true } },
      stats: true,
    },
  });

  // Build sorted results
  const allResults = videos
    .map((v) => ({
      id: v.id,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      status: v.status,
      category: v.category?.name ?? null,
      categoryId: v.category?.id ?? null,
      timesUsed: v.stats?.timesUsed ?? 0,
      timesWon: v.stats?.timesWon ?? 0,
      timesLost: v.stats?.timesLost ?? 0,
      winRate: v.stats?.winRate ?? 0,
      avgVoteShare: v.stats?.avgVoteShare ?? 0,
      sessionsAppeared: v.stats?.sessionsAppeared ?? 0,
      lastUsedAt: v.stats?.lastUsedAt ?? null,
    }))
    .sort((a, b) => {
      const aVal = a[sortField as keyof typeof a] ?? 0;
      const bVal = b[sortField as keyof typeof b] ?? 0;
      if (order === "asc") return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

  const total = allResults.length;
  const totalPages = Math.ceil(total / limit);
  const paginatedResults = allResults.slice((page - 1) * limit, page * limit);

  // Compute aggregates
  const usedVideos = videos.filter((v) => (v.stats?.timesUsed ?? 0) > 0);
  const totalWinRate = usedVideos.reduce((sum, v) => sum + (v.stats?.winRate ?? 0), 0);

  return NextResponse.json({
    videos: paginatedResults,
    total,
    page,
    totalPages,
    aggregates: {
      avgWinRate: usedVideos.length > 0 ? Math.round((totalWinRate / usedVideos.length) * 10) / 10 : 0,
      totalMatchups: usedVideos.reduce((sum, v) => sum + (v.stats?.timesUsed ?? 0), 0),
      totalVideosUsed: usedVideos.length,
      neverUsedCount: videos.length - usedVideos.length,
    },
  });
}
