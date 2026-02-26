import { NextRequest, NextResponse } from "next/server";
import {
  ACTIONS_CORS_HEADERS,
  createPostResponse,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { buildClaimWithNftTx } from "@/lib/vault-claim";

const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com"
);

// GET /api/actions/claim — Blink metadata for claiming USDC reward
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resultId = searchParams.get("result");

  let rewardAmount = 0;
  let tier = "base";

  if (resultId) {
    const result = await prisma.gameResult.findUnique({
      where: { id: resultId },
    });
    if (result) {
      rewardAmount = result.rewardAmount;
      tier = result.tier ?? "base";
    }
  }

  const payload = {
    type: "action" as const,
    icon: `${new URL(req.url).origin}/icon-512x512.png`,
    title: "Claim USDC Reward",
    description: rewardAmount > 0
      ? `You earned $${rewardAmount.toFixed(2)} USDC (${tier.toUpperCase()} Tier) on The Clearance! Claim your reward now.`
      : "Claim your USDC reward from The Clearance.",
    label: rewardAmount > 0 ? `Claim $${rewardAmount.toFixed(2)}` : "Claim Reward",
    links: {
      actions: [
        {
          type: "transaction" as const,
          label: rewardAmount > 0 ? `Claim $${rewardAmount.toFixed(2)} USDC` : "Claim USDC",
          href: `${new URL(req.url).origin}/api/actions/claim${resultId ? `?result=${resultId}` : ""}`,
        },
      ],
    },
  };

  return NextResponse.json(payload, { headers: ACTIONS_CORS_HEADERS });
}

// OPTIONS — CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });
}

// POST /api/actions/claim — Build real vault claim_with_nft transaction via Blink
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resultId = searchParams.get("result");

    const body = await req.json();
    const accountPubkey = new PublicKey(body.account);
    const walletAddress = accountPubkey.toBase58();

    if (!resultId) {
      return NextResponse.json(
        { message: "Missing result parameter. Visit The Clearance app to claim." },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Look up the game result and validate eligibility
    const gameResult = await prisma.gameResult.findUnique({
      where: { id: resultId },
      include: { session: true },
    });

    if (!gameResult) {
      return NextResponse.json(
        { message: "Result not found" },
        { status: 404, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Verify the wallet matches the result owner
    if (gameResult.walletAddress && gameResult.walletAddress !== walletAddress) {
      return NextResponse.json(
        { message: "Wallet does not match the result owner" },
        { status: 403, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (gameResult.usdcClaimed) {
      return NextResponse.json(
        { message: "Reward already claimed" },
        { status: 409, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (!gameResult.nftRevealed) {
      return NextResponse.json(
        { message: "Blind box must be revealed first. Visit The Clearance app." },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (gameResult.rewardAmount <= 0) {
      return NextResponse.json(
        { message: "No USDC reward for this tier" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    if (!gameResult.nftTokenId) {
      return NextResponse.json(
        { message: "No NFT associated with this result" },
        { status: 400, headers: ACTIONS_CORS_HEADERS }
      );
    }

    // Build the real vault claim_with_nft transaction
    const txBase64 = await buildClaimWithNftTx({
      userWalletAddress: walletAddress,
      nftAssetAddress: gameResult.nftTokenId,
      sessionWeekNumber: gameResult.session.weekNumber,
      amountUsdc: gameResult.rewardAmount,
    });

    // Deserialize the partially-signed transaction
    const tx = Transaction.from(Buffer.from(txBase64, "base64"));

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        transaction: tx,
        message: `Claiming $${gameResult.rewardAmount.toFixed(2)} USDC from The Clearance vault!`,
      },
    });

    return NextResponse.json(response, { headers: ACTIONS_CORS_HEADERS });
  } catch (error) {
    console.error("Claim action error:", error);
    return NextResponse.json(
      { message: "Failed to build claim transaction. Try claiming from the app instead." },
      { status: 500, headers: ACTIONS_CORS_HEADERS }
    );
  }
}
