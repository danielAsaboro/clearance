import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { canLateJoin, getCurrentRound } from "@/lib/session-engine";
import { campaignConfig } from "@/lib/campaign-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackAction } from "@/lib/torque";
import { buildFanDepositTx } from "@/lib/vault-claim";

// POST /api/sessions/:id/join — Fan joins a session
// Returns an unsigned fan_deposit transaction for the fan to sign.
// GameResult is created upfront so the results page can display it after the game ends.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`join:${user.id}`, 10);
  if (limited) return limited;

  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "live" && session.status !== "scheduled") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  // Check if already joined
  const existing = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (existing) {
    const isLateJoin = session.status === "live" && canLateJoin(session);
    const joinedAtRound = isLateJoin ? getCurrentRound(session) : 1;
    return NextResponse.json({ ...existing, joinedAtRound, alreadyJoined: true });
  }

  if (!user.walletAddress) {
    return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
  }

  const isLateJoin = session.status === "live" && canLateJoin(session);
  const joinedAtRound = isLateJoin ? getCurrentRound(session) : 1;

  // Create GameResult upfront so it exists for the results page
  const gameResult = await prisma.gameResult.create({
    data: {
      userId: user.id,
      sessionId: id,
      walletAddress: user.walletAddress,
      lateJoin: isLateJoin,
    },
  });

  // Build unsigned fan_deposit transaction for fan to sign
  try {
    const unsignedTx = await buildFanDepositTx({
      fanWalletAddress: user.walletAddress,
      sessionWeekNumber: session.weekNumber,
      amountUsdc: campaignConfig.entryFeeUsdc,
    });

    // Fire-and-forget: track loyalty action via Torque
    trackAction(user.walletAddress, "session_join");

    return NextResponse.json(
      {
        ...gameResult,
        unsignedTx,
        entryFeeUsdc: campaignConfig.entryFeeUsdc,
        joinedAtRound,
        requiresSignature: true,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[join] buildFanDepositTx failed:", err);
    return NextResponse.json({ ...gameResult, joinedAtRound }, { status: 201 });
  }
}
