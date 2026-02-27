import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { claimUsdcSchema } from "@/lib/validators";
import { buildClaimWithRaffleTx } from "@/lib/vault-claim";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/nft/claim — Build a partially-signed vault claim_with_raffle tx
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`claim:${user.id}`, 10);
  if (limited) return limited;

  const body = await req.json();
  const parsed = claimUsdcSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { gameResultId } = parsed.data;

  const gameResult = await prisma.gameResult.findUnique({
    where: { id: gameResultId },
    include: { session: true },
  });

  if (!gameResult || gameResult.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!gameResult.nftRevealed) {
    return NextResponse.json(
      { error: "Blind box must be revealed before claiming" },
      { status: 400 }
    );
  }

  if (gameResult.rewardAmount <= 0) {
    return NextResponse.json(
      { error: "No reward to claim" },
      { status: 400 }
    );
  }

  if (gameResult.usdcClaimed) {
    return NextResponse.json(
      { error: "Already claimed", claimTxHash: gameResult.claimTxHash },
      { status: 409 }
    );
  }

  const walletAddress = user.walletAddress ?? gameResult.walletAddress;
  if (!walletAddress) {
    return NextResponse.json(
      { error: "No wallet address. Connect a wallet first." },
      { status: 400 }
    );
  }

  if (!gameResult.nftTokenId) {
    return NextResponse.json(
      { error: "No NFT token associated with this result" },
      { status: 400 }
    );
  }

  try {
    const transaction = await buildClaimWithRaffleTx({
      userWalletAddress: walletAddress,
      nftAssetAddress: gameResult.nftTokenId,
      sessionWeekNumber: gameResult.session.weekNumber,
    });

    return NextResponse.json({
      transaction,
      message: "Sign the transaction to claim your USDC reward",
    });
  } catch (err) {
    console.error("Failed to build claim tx:", err);
    return NextResponse.json(
      { error: "Failed to build claim transaction. Please try again." },
      { status: 500 }
    );
  }
}
