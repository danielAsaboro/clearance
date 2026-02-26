import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");

  // Return creators list
  if (type === "creators") {
    const creators = await prisma.user.findMany({
      where: { role: "creator" },
      include: {
        _count: { select: { tasks: true, referralsMade: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(creators);
  }

  // Return sessions list
  if (type === "sessions") {
    const sessions = await prisma.weeklySession.findMany({
      include: {
        _count: { select: { rounds: true, gameResults: true } },
      },
      orderBy: { weekNumber: "desc" },
    });
    return NextResponse.json(sessions);
  }

  // Return results for most recent ended session
  if (type === "results") {
    const session = await prisma.weeklySession.findFirst({
      where: { status: "ended" },
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
  const [
    totalCreators,
    totalFans,
    pendingSubmissions,
    upcomingSession,
    totalVotes,
    totalSessions,
    completedSessions,
    totalReferrals,
    totalGameResults,
    nftsMinted,
    usdcClaimed,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "creator" } }),
    prisma.user.count({ where: { role: "fan" } }),
    prisma.task.count({ where: { status: "submitted" } }),
    prisma.weeklySession.findFirst({
      where: { status: "scheduled" },
      orderBy: { scheduledAt: "asc" },
      select: { title: true, scheduledAt: true },
    }),
    prisma.vote.count(),
    prisma.weeklySession.count(),
    prisma.weeklySession.count({ where: { status: "ended" } }),
    prisma.referral.count(),
    prisma.gameResult.count(),
    prisma.gameResult.count({ where: { nftMinted: true } }),
    prisma.gameResult.count({ where: { usdcClaimed: true } }),
  ]);

  return NextResponse.json({
    totalCreators,
    totalFans,
    pendingSubmissions,
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
