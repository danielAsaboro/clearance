import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { calculateMajorityWinners, calculateTier } from "@/lib/session-engine";

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

  for (const result of gameResults) {
    // Count correct votes for this player
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

    await prisma.gameResult.update({
      where: { id: result.id },
      data: {
        totalVotes: votes.length,
        correctVotes,
        tier,
        rewardAmount: tier === "gold" ? 3.5 : tier === "base" ? 1.75 : 0,
      },
    });
  }

  return NextResponse.json({
    matchupsFinalized: session.matchups.length,
    resultsUpdated: gameResults.length,
  });
}
