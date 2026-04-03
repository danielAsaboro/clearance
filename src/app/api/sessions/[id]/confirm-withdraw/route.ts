import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { serverEnv } from "@/lib/env";

const connection = new Connection(
  serverEnv.NEXT_PUBLIC_SOLANA_RPC_URL,
  "confirmed"
);

// POST /api/sessions/:id/confirm-withdraw — Verify on-chain withdrawal and mark usdcClaimed
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const txSignature = body.txSignature as string | undefined;

  if (!txSignature) {
    return NextResponse.json({ error: "txSignature is required" }, { status: 400 });
  }

  const gameResult = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (!gameResult) {
    return NextResponse.json({ error: "Game result not found" }, { status: 404 });
  }

  if (gameResult.usdcClaimed) {
    return NextResponse.json({ confirmed: true, alreadyConfirmed: true });
  }

  try {
    const tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found on-chain" }, { status: 404 });
    }

    if (tx.meta?.err) {
      return NextResponse.json({ error: "Transaction failed on-chain", details: tx.meta.err }, { status: 400 });
    }

    await prisma.gameResult.update({
      where: { id: gameResult.id },
      data: {
        usdcClaimed: true,
        claimTxHash: txSignature,
      },
    });

    return NextResponse.json({ confirmed: true });
  } catch (err) {
    console.error("[confirm-withdraw] verification failed:", err);
    return NextResponse.json({ error: "Failed to verify transaction" }, { status: 500 });
  }
}
