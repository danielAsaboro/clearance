import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { submitVoteSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackAction } from "@/lib/torque";

// POST /api/votes — Submit a vote
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`votes:${user.id}`, 60);
  if (limited) return limited;

  const body = await req.json();
  const parsed = submitVoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { roundId, decision } = parsed.data;

  // Check round exists
  const round = await prisma.sessionRound.findUnique({
    where: { id: roundId },
    include: { session: true },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  // Check session is live
  if (round.session.status !== "live") {
    return NextResponse.json({ error: "Session is not live" }, { status: 400 });
  }

  // Check for duplicate vote
  const existingVote = await prisma.vote.findUnique({
    where: { userId_roundId: { userId: user.id, roundId } },
  });

  if (existingVote) {
    return NextResponse.json(
      { error: "Already voted on this round" },
      { status: 409 }
    );
  }

  const vote = await prisma.vote.create({
    data: {
      userId: user.id,
      roundId,
      decision,
    },
  });

  // Check if vote is correct (if admin has already judged)
  let correct = false;
  if (round.adminVerdict) {
    correct =
      (decision === "approve" && round.adminVerdict === "approved") ||
      (decision === "reject" && round.adminVerdict === "rejected");
  }

  // Fire-and-forget: track loyalty action via Torque
  if (user.walletAddress) {
    trackAction(user.walletAddress, "session_vote");
  }

  return NextResponse.json({ ...vote, correct }, { status: 201 });
}
