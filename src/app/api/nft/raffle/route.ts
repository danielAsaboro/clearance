import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { buildRequestRaffleTx } from "@/lib/vault-claim";
import { checkRateLimit } from "@/lib/rate-limit";

const TIER_MAP: Record<string, number> = {
  participation: 0,
  base: 1,
  gold: 2,
};

// POST /api/nft/raffle — Build a partially-signed request_raffle tx
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`raffle:${user.id}`, 10);
  if (limited) return limited;

  const body = await req.json();
  const { gameResultId } = body;

  if (!gameResultId) {
    return NextResponse.json(
      { error: "gameResultId is required" },
      { status: 400 }
    );
  }

  const gameResult = await prisma.gameResult.findUnique({
    where: { id: gameResultId },
    include: { session: true },
  });

  if (!gameResult || gameResult.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!gameResult.nftMinted || !gameResult.nftTokenId) {
    return NextResponse.json(
      { error: "NFT not yet minted" },
      { status: 400 }
    );
  }

  const walletAddress = user.walletAddress ?? gameResult.walletAddress;
  if (!walletAddress) {
    return NextResponse.json(
      { error: "No wallet address. Connect a wallet first." },
      { status: 400 }
    );
  }

  const tier = TIER_MAP[gameResult.tier ?? "participation"] ?? 0;

  try {
    const unsignedTx = await buildRequestRaffleTx({
      fanWalletAddress: walletAddress,
      sessionWeekNumber: gameResult.session.weekNumber,
      tier,
    });

    return NextResponse.json({
      unsignedTx,
      requiresSignature: true,
      tier: gameResult.tier,
      entryFeeUsdc: 0,
    });
  } catch (err) {
    console.error("Failed to build raffle tx:", err);
    return NextResponse.json(
      { error: "Failed to build raffle transaction. Please try again." },
      { status: 500 }
    );
  }
}
