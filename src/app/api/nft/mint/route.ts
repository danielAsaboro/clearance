import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { getUmi, getMintAuthority } from "@/lib/solana";
import { mintBlindBox } from "@/lib/nft";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/nft/mint — Mint a Blind Box NFT for a game result
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`mint:${user.id}`, 10);
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

  if (gameResult.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (gameResult.nftMinted) {
    return NextResponse.json({ error: "NFT already minted" }, { status: 409 });
  }

  if (gameResult.tier === "participation") {
    return NextResponse.json(
      { error: "Participation tier does not receive NFT" },
      { status: 400 }
    );
  }

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: "Wallet address required. Please connect your wallet." },
      { status: 400 }
    );
  }

  try {
    const umi = getUmi();
    const signer = getMintAuthority();

    const tier = gameResult.tier as "base" | "gold";
    const sessionWeek = gameResult.session.weekNumber;
    const collectionAddress = gameResult.session.collectionAddress || undefined;

    const tokenId = await mintBlindBox(
      umi,
      signer,
      user.walletAddress,
      tier,
      gameResult.rewardAmount,
      sessionWeek,
      collectionAddress
    );

    await prisma.gameResult.update({
      where: { id: gameResultId },
      data: {
        nftMinted: true,
        nftTokenId: tokenId,
        walletAddress: user.walletAddress,
      },
    });

    return NextResponse.json({
      tokenId,
      tier: gameResult.tier,
      rewardAmount: gameResult.rewardAmount,
    });
  } catch (error) {
    console.error("Failed to mint NFT:", error);
    return NextResponse.json(
      { error: "Failed to mint NFT on Solana" },
      { status: 500 }
    );
  }
}
