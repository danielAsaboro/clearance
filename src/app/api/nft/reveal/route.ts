import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { getUmi, getMintAuthority } from "@/lib/solana";
import { revealBlindBox } from "@/lib/nft";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackAction } from "@/lib/torque";

// POST /api/nft/reveal — Reveal a Blind Box NFT
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`reveal:${user.id}`, 10);
  if (limited) return limited;

  const body = await req.json();
  const { gameResultId } = body;

  const gameResult = await prisma.gameResult.findUnique({
    where: { id: gameResultId },
    include: { session: true },
  });

  if (!gameResult) {
    return NextResponse.json({ error: "Game result not found" }, { status: 404 });
  }

  if (gameResult.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!gameResult.nftMinted || !gameResult.nftTokenId) {
    return NextResponse.json({ error: "NFT not yet minted" }, { status: 400 });
  }

  if (gameResult.nftRevealed) {
    return NextResponse.json({ error: "NFT already revealed" }, { status: 409 });
  }

  try {
    const umi = getUmi();
    getMintAuthority(); // ensure signer is initialized

    const collectionAddress = gameResult.session.collectionAddress || undefined;

    await revealBlindBox(
      umi,
      getMintAuthority(),
      gameResult.nftTokenId,
      collectionAddress
    );

    await prisma.gameResult.update({
      where: { id: gameResultId },
      data: { nftRevealed: true },
    });

    // Fire-and-forget: track loyalty action via Torque
    if (user.walletAddress) {
      trackAction(user.walletAddress, "nft_reveal");
    }

    return NextResponse.json({
      revealed: true,
      tier: gameResult.tier,
      rewardAmount: gameResult.rewardAmount,
      tokenId: gameResult.nftTokenId,
    });
  } catch (error) {
    console.error("Failed to reveal NFT:", error);
    return NextResponse.json(
      { error: "Failed to reveal NFT on Solana" },
      { status: 500 }
    );
  }
}
