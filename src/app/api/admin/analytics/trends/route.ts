import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/admin/analytics/trends — Platform-wide trend data
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rangeDays = parseInt(searchParams.get("days") ?? "30");
  const since = new Date();
  since.setDate(since.getDate() - rangeDays);

  // User growth (new users per day)
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const totalUsersBefore = await prisma.user.count({
    where: { createdAt: { lt: since } },
  });

  const userGrowthMap = new Map<string, number>();
  for (const u of users) {
    const day = u.createdAt.toISOString().slice(0, 10);
    userGrowthMap.set(day, (userGrowthMap.get(day) ?? 0) + 1);
  }

  let cumulative = totalUsersBefore;
  const userGrowth = Array.from(userGrowthMap.entries()).map(([date, newUsers]) => {
    cumulative += newUsers;
    return { date, newUsers, cumulativeUsers: cumulative };
  });

  // Session trends (for all ended sessions)
  const sessions = await prisma.weeklySession.findMany({
    where: { status: "ended" },
    select: {
      id: true,
      title: true,
      weekNumber: true,
      scheduledAt: true,
      _count: { select: { matchups: true } },
    },
    orderBy: { scheduledAt: "desc" },
    take: 20,
  });

  const sessionTrends = await Promise.all(
    sessions.map(async (s) => {
      const results = await prisma.gameResult.findMany({
        where: { sessionId: s.id },
        select: { correctVotes: true, totalVotes: true, tier: true, rewardAmount: true },
      });
      const totalVotes = await prisma.vote.count({
        where: { matchup: { sessionId: s.id } },
      });
      const participants = results.length;
      const avgAccuracy =
        participants > 0
          ? Math.round(
              (results.reduce((sum, r) => {
                const matchups = s._count.matchups;
                return sum + (matchups > 0 ? (r.correctVotes / matchups) * 100 : 0);
              }, 0) /
                participants) *
                10
            ) / 10
          : 0;
      const rewardsDistributed = results.reduce((sum, r) => sum + r.rewardAmount, 0);

      return {
        sessionId: s.id,
        title: s.title,
        weekNumber: s.weekNumber,
        scheduledAt: s.scheduledAt,
        participants,
        totalVotes,
        avgAccuracy,
        rewardsDistributed: Math.round(rewardsDistributed * 100) / 100,
      };
    })
  );

  // Top videos by win rate
  const topVideos = await prisma.videoStats.findMany({
    where: { timesUsed: { gte: 2 } },
    orderBy: { winRate: "desc" },
    take: 10,
    include: {
      video: { select: { id: true, title: true, thumbnailUrl: true } },
    },
  });

  // Top players by accuracy
  const topPlayersRaw = await prisma.gameResult.groupBy({
    by: ["userId"],
    _sum: { correctVotes: true, totalVotes: true },
    _count: { _all: true },
    having: { userId: { _count: { gte: 2 } } },
    orderBy: { _sum: { correctVotes: "desc" } },
    take: 10,
  });

  const topPlayerIds = topPlayersRaw.map((p) => p.userId);
  const topPlayerUsers = await prisma.user.findMany({
    where: { id: { in: topPlayerIds } },
    select: { id: true, displayName: true, profilePhoto: true },
  });
  const userMap = new Map(topPlayerUsers.map((u) => [u.id, u]));

  const topPlayers = topPlayersRaw.map((p) => {
    const u = userMap.get(p.userId);
    const totalVotes = p._sum.totalVotes ?? 0;
    const correctVotes = p._sum.correctVotes ?? 0;
    return {
      userId: p.userId,
      displayName: u?.displayName ?? "Unknown",
      profilePhoto: u?.profilePhoto ?? null,
      sessionsPlayed: p._count._all,
      correctVotes,
      accuracy: totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 1000) / 10 : 0,
    };
  });

  return NextResponse.json({
    userGrowth,
    sessionTrends,
    topVideos: topVideos.map((vs) => ({
      id: vs.video.id,
      title: vs.video.title,
      thumbnailUrl: vs.video.thumbnailUrl,
      winRate: vs.winRate,
      timesUsed: vs.timesUsed,
      avgVoteShare: vs.avgVoteShare,
    })),
    topPlayers,
  });
}
