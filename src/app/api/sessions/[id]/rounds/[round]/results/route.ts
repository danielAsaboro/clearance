import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/sessions/:id/rounds/:round/results — Get vote results for a specific round
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; round: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, round } = await params;
  const roundNumber = parseInt(round, 10);

  if (isNaN(roundNumber) || roundNumber < 1) {
    return NextResponse.json({ error: "Invalid round number" }, { status: 400 });
  }

  // Find the matchup for this round
  const matchup = await prisma.matchup.findFirst({
    where: { sessionId: id, matchupNumber: roundNumber },
    include: {
      votes: { select: { userId: true, decision: true } },
    },
  });

  if (!matchup) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  const totalVotes = matchup.votes.length;
  const videoAVotes = matchup.votes.filter((v) => v.decision === "video_a").length;
  const videoBVotes = totalVotes - videoAVotes;

  const videoAPercent = totalVotes > 0 ? Math.round((videoAVotes / totalVotes) * 100) : 50;
  const videoBPercent = totalVotes > 0 ? 100 - videoAPercent : 50;

  // Determine majority winner
  const winner: "video_a" | "video_b" = videoAVotes >= videoBVotes ? "video_a" : "video_b";

  // Check if requesting user's vote matches the winner
  const userVote = matchup.votes.find((v) => v.userId === user.id);
  const userCorrect = userVote ? userVote.decision === winner : false;

  // Calculate cumulative correct count for this user across all completed rounds
  const allMatchups = await prisma.matchup.findMany({
    where: { sessionId: id, matchupNumber: { lte: roundNumber } },
    include: {
      votes: { select: { userId: true, decision: true } },
    },
    orderBy: { matchupNumber: "asc" },
  });

  let correctCount = 0;
  for (const m of allMatchups) {
    const mTotal = m.votes.length;
    if (mTotal === 0) continue;
    const mVideoA = m.votes.filter((v) => v.decision === "video_a").length;
    const mWinner = mVideoA >= mTotal - mVideoA ? "video_a" : "video_b";
    const uVote = m.votes.find((v) => v.userId === user.id);
    if (uVote && uVote.decision === mWinner) correctCount++;
  }

  return NextResponse.json({
    videoAPercent,
    videoBPercent,
    winner,
    userCorrect,
    correctCount,
  });
}
