import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { buildClaimRewardTx, buildWithdrawTx } from "@/lib/vault-claim";

// POST /api/sessions/:id/withdraw — Build a partially-signed claim_reward tx
// that moves USDC from vault → user's PDA ATA (admin co-signs the amount).
// User signs and submits. RewardRecord PDA prevents double-claims on-chain.
//
// Optionally pass { includeWithdraw: true } to also build a withdraw tx
// that moves USDC from PDA ATA → user's wallet (returned as a second tx).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.walletAddress) {
    return NextResponse.json({ error: "Wallet not connected" }, { status: 400 });
  }

  const { id } = await params;

  const gameResult = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
    include: { session: { select: { weekNumber: true, status: true } } },
  });

  if (!gameResult) {
    return NextResponse.json({ error: "Game result not found" }, { status: 404 });
  }

  if (!gameResult.depositConfirmed) {
    return NextResponse.json({ error: "Deposit not confirmed — not eligible for rewards" }, { status: 400 });
  }

  if (gameResult.session.status !== "ended") {
    return NextResponse.json({ error: "Session has not ended yet" }, { status: 400 });
  }

  if (!gameResult.rewardAmount || gameResult.rewardAmount <= 0) {
    return NextResponse.json({ error: "No reward to claim" }, { status: 400 });
  }

  if (gameResult.usdcClaimed) {
    return NextResponse.json(
      { error: "Already claimed", claimTxHash: gameResult.claimTxHash },
      { status: 409 }
    );
  }

  try {
    // Build the claim_reward tx (admin partially signed, user must co-sign)
    // This moves USDC: vault → user's PDA ATA
    const claimTx = await buildClaimRewardTx({
      userWalletAddress: user.walletAddress,
      sessionWeekNumber: gameResult.session.weekNumber,
      amountUsdc: gameResult.rewardAmount,
    });

    // Also build a withdraw tx so user can pull to wallet in same flow
    // This moves USDC: user's PDA ATA → user's wallet
    const withdrawTx = await buildWithdrawTx({
      userWalletAddress: user.walletAddress,
      amountUsdc: gameResult.rewardAmount,
    });

    return NextResponse.json({
      claimTransaction: claimTx,
      withdrawTransaction: withdrawTx,
      rewardAmount: gameResult.rewardAmount,
    });
  } catch (err) {
    console.error("[withdraw] build tx failed:", err);
    return NextResponse.json({ error: "Failed to build transaction" }, { status: 500 });
  }
}
