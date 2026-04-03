import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, resolveCampaignId } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaignId = await resolveCampaignId(req.nextUrl.searchParams.get("campaignId"));
  const sessionFilter = campaignId ? { campaignId } : {};
  const type = req.nextUrl.searchParams.get("type");

  // Return sessions list (paginated)
  if (type === "sessions") {
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
    const limit = Math.max(1, Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") ?? "10")));

    const [sessions, total] = await Promise.all([
      prisma.weeklySession.findMany({
        where: sessionFilter,
        include: {
          _count: { select: { matchups: true, gameResults: true } },
        },
        orderBy: { weekNumber: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.weeklySession.count({ where: sessionFilter }),
    ]);

    return NextResponse.json({
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }

  // Return results for most recent ended session
  if (type === "results") {
    const session = await prisma.weeklySession.findFirst({
      where: { status: "ended", ...sessionFilter },
      orderBy: { weekNumber: "desc" },
    });

    if (!session) {
      return NextResponse.json(null);
    }

    const gameResults = await prisma.gameResult.findMany({
      where: { sessionId: session.id },
      include: { user: { select: { displayName: true } } },
      orderBy: { correctVotes: "desc" },
    });

    const tierDistribution = {
      participation: gameResults.filter((r) => r.tier === "participation").length,
      base: gameResults.filter((r) => r.tier === "base").length,
      gold: gameResults.filter((r) => r.tier === "gold").length,
    };

    return NextResponse.json({
      sessionId: session.id,
      sessionTitle: session.title,
      sessionWeek: session.weekNumber,
      totalParticipants: gameResults.length,
      tierDistribution,
      results: gameResults.map((r) => ({
        userId: r.userId,
        gameResultId: r.id,
        displayName: r.user.displayName,
        correctVotes: r.correctVotes,
        totalVotes: r.totalVotes,
        tier: r.tier,
        rewardAmount: r.rewardAmount,
        nftMinted: r.nftMinted,
      })),
    });
  }

  // Default: dashboard stats
  const voteSessionFilter = campaignId
    ? { matchup: { session: { campaignId } } }
    : {};
  const gameResultSessionFilter = campaignId
    ? { session: { campaignId } }
    : {};

  const [
    totalPlayers,
    totalVideos,
    upcomingSession,
    totalVotes,
    totalSessions,
    completedSessions,
    totalReferrals,
    totalGameResults,
    nftsMinted,
    usdcClaimed,
  ] = await Promise.all([
    campaignId
      ? prisma.campaignEnrollment.count({ where: { campaignId } })
      : prisma.user.count({ where: { role: "player" } }),
    prisma.video.count(),
    prisma.weeklySession.findFirst({
      where: { status: "scheduled", ...sessionFilter },
      orderBy: { scheduledAt: "asc" },
      select: { title: true, scheduledAt: true },
    }),
    prisma.vote.count({ where: voteSessionFilter }),
    prisma.weeklySession.count({ where: sessionFilter }),
    prisma.weeklySession.count({ where: { status: "ended", ...sessionFilter } }),
    prisma.referral.count(),
    prisma.gameResult.count({ where: gameResultSessionFilter }),
    prisma.gameResult.count({ where: { nftMinted: true, ...gameResultSessionFilter } }),
    prisma.gameResult.count({ where: { usdcClaimed: true, ...gameResultSessionFilter } }),
  ]);

  return NextResponse.json({
    totalPlayers,
    totalVideos,
    upcomingSession,
    totalVotes,
    totalSessions,
    completedSessions,
    totalReferrals,
    totalGameResults,
    nftsMinted,
    usdcClaimed,
    sessionCompletionRate:
      totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0,
  });
}
