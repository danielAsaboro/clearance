import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { judgeRoundSchema } from "@/lib/validators";
import { calculateTier } from "@/lib/session-engine";
import { sendResultsReady } from "@/lib/email";
import { submitScore } from "@/lib/soar";

// POST /api/admin/sessions/:id/judge — Submit verdicts and calculate results
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = await req.json();
  const parsed = judgeRoundSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Update all round verdicts
  for (const { roundId, verdict } of parsed.data.rounds) {
    await prisma.sessionRound.update({
      where: { id: roundId },
      data: { adminVerdict: verdict },
    });
  }

  // Recalculate all game results for this session
  const gameResults = await prisma.gameResult.findMany({
    where: { sessionId },
  });

  for (const gr of gameResults) {
    const votes = await prisma.vote.findMany({
      where: {
        userId: gr.userId,
        round: { sessionId },
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

    await prisma.gameResult.update({
      where: { id: gr.id },
      data: {
        totalVotes: votes.length,
        correctVotes,
        tier,
        rewardAmount: reward,
      },
    });
  }

  // Fire-and-forget: send result emails to all participants
  const session = await prisma.weeklySession.findUnique({
    where: { id: sessionId },
  });
  if (session) {
    const updatedResults = await prisma.gameResult.findMany({
      where: { sessionId },
      include: { user: { select: { email: true } } },
    });
    Promise.allSettled(
      updatedResults
        .filter((r) => r.user.email)
        .map((r) =>
          sendResultsReady(
            r.user.email!,
            session.title,
            session.weekNumber,
            r.correctVotes,
            r.tier ?? "participation",
            r.rewardAmount
          )
        )
    ).catch(console.error);
  }

  // Fire-and-forget: submit top creator scores to SOAR on-chain leaderboard
  try {
    const topResults = await prisma.gameResult.findMany({
      where: { sessionId },
      orderBy: { correctVotes: "desc" },
      take: 10,
      include: { user: { select: { walletAddress: true } } },
    });

    Promise.all(
      topResults
        .filter((r) => r.user.walletAddress && r.correctVotes > 0)
        .map((r) =>
          submitScore(r.user.walletAddress!, r.correctVotes)
        )
    ).catch(console.error);
  } catch {
    // SOAR submission is best-effort
  }

  return NextResponse.json({
    judgedRounds: parsed.data.rounds.length,
    updatedResults: gameResults.length,
  });
}
