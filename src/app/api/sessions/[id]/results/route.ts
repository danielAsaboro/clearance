import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { calculateTier, calculateMajorityWinners } from "@/lib/session-engine";
import { campaignConfig } from "@/lib/campaign-config";

// GET /api/sessions/:id/results — Get user's results for a session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get the game result — lazily create if the user has votes but no record
  let gameResult = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (!gameResult) {
    // Check if user actually participated (has votes for this session)
    const voteCount = await prisma.vote.count({
      where: { userId: user.id, matchup: { sessionId: id } },
    });

    if (voteCount === 0) {
      return NextResponse.json({ error: "No results found" }, { status: 404 });
    }

    // User voted but GameResult was never created (e.g. join endpoint error)
    gameResult = await prisma.gameResult.create({
      data: {
        userId: user.id,
        sessionId: id,
        walletAddress: user.walletAddress,
      },
    });
  }

  // If results haven't been calculated yet, calculate them via majority vote
  if (gameResult.tier === null) {
    // Get all matchups with their votes for this session
    const matchups = await prisma.matchup.findMany({
      where: { sessionId: id },
      include: {
        votes: { select: { decision: true } },
      },
    });

    // Calculate majority winners
    const winnerMap = calculateMajorityWinners(
      matchups.map((m) => ({
        id: m.id,
        videoAId: m.videoAId,
        videoBId: m.videoBId,
        votes: m.votes.map((v) => ({ decision: v.decision as "video_a" | "video_b" })),
      }))
    );

    // Get this user's votes
    const userVotes = await prisma.vote.findMany({
      where: {
        userId: user.id,
        matchup: { sessionId: id },
      },
      include: { matchup: true },
    });

    const correctVotes = userVotes.filter((v) => {
      const winner = winnerMap.get(v.matchupId);
      if (!winner) return false;
      return (
        (v.decision === "video_a" && winner === v.matchup.videoAId) ||
        (v.decision === "video_b" && winner === v.matchup.videoBId)
      );
    }).length;

    const { tier } = calculateTier(correctVotes, matchups.length);

    gameResult = await prisma.gameResult.update({
      where: { id: gameResult.id },
      data: {
        totalVotes: userVotes.length,
        correctVotes,
        tier,
        rewardAmount: tier === "gold" ? campaignConfig.goldRewardUsdc : tier === "base" ? campaignConfig.baseRewardUsdc : 0,
      },
    });
  }

  return NextResponse.json(gameResult);
}
