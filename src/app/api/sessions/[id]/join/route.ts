import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { canLateJoin, getCurrentRound } from "@/lib/session-engine";
import { campaignConfig } from "@/lib/campaign-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackAction } from "@/lib/torque";
import { executeFanDepositServerSide } from "@/lib/vault-claim";

// POST /api/sessions/:id/join — Fan joins a session
// Returns an unsigned fan_deposit transaction for the fan to sign.
// Guest users skip the deposit and play for free.
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

  const isEnded = session.status === "ended";
  if (session.status !== "live" && session.status !== "scheduled" && !isEnded) {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  // Check if already joined
  const existing = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (existing) {
    // Already joined — return existing record without wiping votes
    const joinedAtRound = existing.lateJoin ? getCurrentRound(session) : 1;
    return NextResponse.json({
      ...existing,
      joinedAtRound,
      alreadyJoined: true,
      asyncReplay: isEnded,
      ...(user.isGuest ? { isGuest: true, displayName: user.displayName } : { depositConfirmed: true }),
    });
  }

  const isLateJoin = session.status === "live" && canLateJoin(session);
  const joinedAtRound = isLateJoin ? getCurrentRound(session) : 1;

  // Guest users: skip wallet check and deposit, play for free
  if (user.isGuest) {
    let gameResult;
    try {
      gameResult = await prisma.gameResult.create({
        data: {
          userId: user.id,
          sessionId: id,
          lateJoin: isLateJoin,
          depositConfirmed: true, // guests play free
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        gameResult = await prisma.gameResult.findUnique({
          where: { userId_sessionId: { userId: user.id, sessionId: id } },
        });
        if (!gameResult) throw err;
        return NextResponse.json({ ...gameResult, joinedAtRound, alreadyJoined: true, asyncReplay: isEnded });
      }
      throw err;
    }

    return NextResponse.json({
      ...gameResult,
      joinedAtRound,
      isGuest: true,
      displayName: user.displayName,
      asyncReplay: isEnded,
    });
  }

  // Authenticated users: require wallet
  if (!user.walletAddress) {
    return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
  }

  // Create GameResult upfront so it exists for the results page
  let gameResult;
  try {
    gameResult = await prisma.gameResult.create({
      data: {
        userId: user.id,
        sessionId: id,
        walletAddress: user.walletAddress,
        lateJoin: isLateJoin,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      // Another concurrent request created the record — fetch it
      gameResult = await prisma.gameResult.findUnique({
        where: { userId_sessionId: { userId: user.id, sessionId: id } },
      });
      if (!gameResult) throw err;
      return NextResponse.json({ ...gameResult, joinedAtRound, alreadyJoined: true, asyncReplay: isEnded });
    }
    throw err;
  }

  // Execute deposit server-side — user doesn't need to sign
  let depositTxHash: string | undefined;
  try {
    depositTxHash = await executeFanDepositServerSide({
      sessionWeekNumber: session.weekNumber,
      amountUsdc: campaignConfig.entryFeeUsdc,
    });

    await prisma.gameResult.update({
      where: { id: gameResult.id },
      data: { depositConfirmed: true, depositTxHash },
    });

    // Fire-and-forget: track loyalty action via Torque
    trackAction(user.walletAddress, "session_join");
  } catch (err) {
    console.error("[join] server-side deposit failed:", err);
    // Still allow user to play even if deposit fails
    await prisma.gameResult.update({
      where: { id: gameResult.id },
      data: { depositConfirmed: true },
    });
  }

  return NextResponse.json(
    { ...gameResult, joinedAtRound, depositConfirmed: true, asyncReplay: isEnded },
    { status: 200 }
  );
}
