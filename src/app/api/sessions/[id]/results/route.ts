import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { calculateTier } from "@/lib/session-engine";

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

  // Get the game result
  let gameResult = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (!gameResult) {
    return NextResponse.json({ error: "No results found" }, { status: 404 });
  }

  // If results haven't been calculated yet, calculate them
  if (gameResult.tier === null) {
    // Count votes for this user in this session
    const votes = await prisma.vote.findMany({
      where: {
        userId: user.id,
        round: { sessionId: id },
      },
      include: { round: true },
    });

    const correctVotes = votes.filter((v) => {
      if (!v.round.adminVerdict) return false;
      return (
        (v.decision === "approve" && v.round.adminVerdict === "approved") ||
        (v.decision === "reject" && v.round.adminVerdict === "rejected")
      );
    }).length;

    const { tier, reward } = calculateTier(correctVotes);

    gameResult = await prisma.gameResult.update({
      where: { id: gameResult.id },
      data: {
        totalVotes: votes.length,
        correctVotes,
        tier,
        rewardAmount: reward,
      },
    });
  }

  return NextResponse.json(gameResult);
}
