import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { canLateJoin, getCurrentRound } from "@/lib/session-engine";
import { campaignConfig } from "@/lib/campaign-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildFanDepositTx } from "@/lib/vault-claim";

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
      ...(user.isGuest ? { isGuest: true, displayName: user.displayName } : { depositConfirmed: existing.depositConfirmed }),
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

  // Create GameResult upfront (depositConfirmed: false — user must sign)
  let gameResult;
  try {
    gameResult = await prisma.gameResult.create({
      data: {
        userId: user.id,
        sessionId: id,
        walletAddress: user.walletAddress,
        lateJoin: isLateJoin,
        depositConfirmed: false,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      gameResult = await prisma.gameResult.findUnique({
        where: { userId_sessionId: { userId: user.id, sessionId: id } },
      });
      if (!gameResult) throw err;
      return NextResponse.json({ ...gameResult, joinedAtRound, alreadyJoined: true, asyncReplay: isEnded });
    }
    throw err;
  }

  // Build unsigned fan_deposit tx for the user to sign
  let unsignedTx: string | undefined;
  try {
    unsignedTx = await buildFanDepositTx({
      fanWalletAddress: user.walletAddress,
      sessionWeekNumber: session.weekNumber,
      amountUsdc: campaignConfig.entryFeeUsdc,
    });
  } catch (err) {
    console.error("[join] buildFanDepositTx failed:", err);
    // Tx build failed — user plays for free but won't be in reward pool
  }

  return NextResponse.json({
    ...gameResult,
    joinedAtRound,
    asyncReplay: isEnded,
    entryFeeUsdc: campaignConfig.entryFeeUsdc,
    ...(unsignedTx
      ? { unsignedTx, requiresSignature: true }
      : { depositConfirmed: false }),
  });
}
