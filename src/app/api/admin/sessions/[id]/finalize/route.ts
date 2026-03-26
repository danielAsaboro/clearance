import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { calculateMajorityWinners, calculateTier, calculatePoolReward } from "@/lib/session-engine";
import { campaignConfig } from "@/lib/campaign-config";
import { updateVideoStatsForSession } from "@/lib/video-stats";

// POST /api/admin/sessions/:id/finalize — Calculate majority winners & assign tiers
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({
    where: { id },
    include: {
      matchups: {
        include: {
          votes: { select: { decision: true } },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "ended") {
    return NextResponse.json(
      { error: "Session must be ended before finalizing" },
      { status: 400 }
    );
  }

  if (session.matchups.length === 0) {
    return NextResponse.json(
      { error: "No matchups in this session" },
      { status: 400 }
    );
  }

  // Calculate majority winners
  const winnerMap = calculateMajorityWinners(
    session.matchups.map((m) => ({
      id: m.id,
      videoAId: m.videoAId,
      videoBId: m.videoBId,
      votes: m.votes.map((v) => ({ decision: v.decision as "video_a" | "video_b" })),
    }))
  );

  // Update each matchup with winning video
  await Promise.all(
    session.matchups.map((m) =>
      prisma.matchup.update({
        where: { id: m.id },
        data: { winningVideoId: winnerMap.get(m.id) },
      })
    )
  );

  // Get all game results for this session and calculate tiers
  const gameResults = await prisma.gameResult.findMany({
    where: { sessionId: id },
  });

  const totalMatchups = session.matchups.length;

  // First pass: calculate correctVotes for every player
  const playerScores: { resultId: string; totalVotes: number; correctVotes: number; tier: "participation" | "base" | "gold" }[] = [];

  for (const result of gameResults) {
    const votes = await prisma.vote.findMany({
      where: {
        userId: result.userId,
        matchup: { sessionId: id },
      },
      include: { matchup: true },
    });

    const correctVotes = votes.filter((v) => {
      const winner = winnerMap.get(v.matchupId);
      if (!winner) return false;
      return (
        (v.decision === "video_a" && winner === v.matchup.videoAId) ||
        (v.decision === "video_b" && winner === v.matchup.videoBId)
      );
    }).length;

    const { tier } = calculateTier(correctVotes, totalMatchups);
    playerScores.push({ resultId: result.id, totalVotes: votes.length, correctVotes, tier });
  }

  // Pool-based rewards: (userScore / totalScores) * 84% of total deposits
  const depositCount = gameResults.filter((r) => r.depositConfirmed).length;
  const totalDeposits = depositCount * campaignConfig.entryFeeUsdc;
  const totalTasteScores = playerScores.reduce((sum, p) => sum + p.correctVotes, 0);

  // Second pass: persist scores and pool-based reward amounts
  for (const player of playerScores) {
    const rewardAmount = calculatePoolReward(player.correctVotes, totalTasteScores, totalDeposits, campaignConfig.playerPoolPercent);
    await prisma.gameResult.update({
      where: { id: player.resultId },
      data: {
        totalVotes: player.totalVotes,
        correctVotes: player.correctVotes,
        tier: player.tier,
        rewardAmount: Math.round(rewardAmount * 100) / 100,
      },
    });
  }

  // Update video performance stats (fire-and-forget)
  void updateVideoStatsForSession(id);

  // Log dropout events for players who didn't vote all matchups
  const matchupCount = session.matchups.length;
  void (async () => {
    for (const result of gameResults) {
      const voteCount = await prisma.vote.count({
        where: { userId: result.userId, matchup: { sessionId: id } },
      });
      if (voteCount < matchupCount) {
        await prisma.analyticsEvent.create({
          data: {
            type: "round_dropout",
            userId: result.userId,
            sessionId: id,
            metadata: { lastVotedRound: voteCount, totalRounds: matchupCount },
          },
        });
      }
    }
  })();

  return NextResponse.json({
    matchupsFinalized: session.matchups.length,
    resultsUpdated: gameResults.length,
  });
}
