import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { z } from "zod";

const confirmSchema = z.object({
  gameResultId: z.string().min(1),
  txHash: z.string().min(1),
});

// POST /api/nft/claim/confirm — Confirm a claim after user signs + submits tx
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = confirmSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { gameResultId, txHash } = parsed.data;

  const gameResult = await prisma.gameResult.findUnique({
    where: { id: gameResultId },
  });

  if (!gameResult || gameResult.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (gameResult.usdcClaimed) {
    return NextResponse.json(
      { error: "Already claimed", claimTxHash: gameResult.claimTxHash },
      { status: 409 }
    );
  }

  await prisma.gameResult.update({
    where: { id: gameResultId },
    data: {
      usdcClaimed: true,
      claimTxHash: txHash,
      claimedAt: new Date(),
    },
  });

  return NextResponse.json({ claimTxHash: txHash });
}
