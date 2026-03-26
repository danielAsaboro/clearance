import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/users/me/stats — Personal performance stats
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await prisma.gameResult.findMany({
    where: { userId: user.id },
    include: {
      session: { select: { title: true, weekNumber: true, scheduledAt: true } },
    },
    orderBy: { session: { scheduledAt: "desc" } },
  });

  if (results.length === 0) {
    return NextResponse.json({
      overview: {
        sessionsPlayed: 0,
        totalVotes: 0,
        correctVotes: 0,
        overallAccuracy: 0,
        totalEarnings: 0,
        totalClaimed: 0,
        pendingRewards: 0,
        nftsMinted: 0,
        currentStreak: 0,
        bestStreak: 0,
      },
      tierHistory: { gold: 0, base: 0, participation: 0 },
      recentTrend: [],
    });
  }

  const totalVotes = results.reduce((s, r) => s + r.totalVotes, 0);
  const correctVotes = results.reduce((s, r) => s + r.correctVotes, 0);
  const totalEarnings = results.reduce((s, r) => s + r.rewardAmount, 0);
  const totalClaimed = results
    .filter((r) => r.usdcClaimed)
    .reduce((s, r) => s + r.rewardAmount, 0);
  const nftsMinted = results.filter((r) => r.nftMinted).length;

  // Tier distribution
  const tierHistory = { gold: 0, base: 0, participation: 0 };
  for (const r of results) {
    if (r.tier === "gold") tierHistory.gold++;
    else if (r.tier === "base") tierHistory.base++;
    else tierHistory.participation++;
  }

  // Streak calculation (consecutive gold tiers, sorted by session date desc)
  let currentStreak = 0;
  let bestStreak = 0;
  let streak = 0;
  for (const r of results) {
    if (r.tier === "gold") {
      streak++;
      if (streak > bestStreak) bestStreak = streak;
    } else {
      if (streak > 0 && currentStreak === 0) currentStreak = streak;
      streak = 0;
    }
  }
  if (currentStreak === 0) currentStreak = streak;

  // Recent trend (last 10 sessions)
  const recentTrend = results.slice(0, 10).map((r) => {
    const matchupsForAccuracy = r.totalVotes || 1;
    return {
      sessionId: r.sessionId,
      sessionTitle: r.session.title,
      weekNumber: r.session.weekNumber,
      scheduledAt: r.session.scheduledAt,
      correctVotes: r.correctVotes,
      totalVotes: r.totalVotes,
      accuracy: Math.round((r.correctVotes / matchupsForAccuracy) * 1000) / 10,
      tier: r.tier,
      earnings: r.rewardAmount,
      nftMinted: r.nftMinted,
      usdcClaimed: r.usdcClaimed,
    };
  });

  return NextResponse.json({
    overview: {
      sessionsPlayed: results.length,
      totalVotes,
      correctVotes,
      overallAccuracy:
        totalVotes > 0 ? Math.round((correctVotes / totalVotes) * 1000) / 10 : 0,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalClaimed: Math.round(totalClaimed * 100) / 100,
      pendingRewards: Math.round((totalEarnings - totalClaimed) * 100) / 100,
      nftsMinted,
      currentStreak,
      bestStreak,
    },
    tierHistory,
    recentTrend,
  });
}
