import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { findOrCreateProfile } from "@/lib/tapestry";
import { prisma } from "@/lib/db";

// GET /api/social/profile — Fetch current user's cumulative stats
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const aggregate = await prisma.gameResult.aggregate({
    where: { userId: user.id },
    _count: { id: true },
    _sum: { correctVotes: true },
  });

  return NextResponse.json({
    sessionsPlayed: aggregate._count.id,
    correctPredictions: aggregate._sum.correctVotes ?? 0,
    tasteScore: aggregate._sum.correctVotes ?? 0,
  });
}

// POST /api/social/profile — Create/fetch Tapestry on-chain profile
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.walletAddress) {
    return NextResponse.json(
      { error: "Wallet not connected" },
      { status: 400 }
    );
  }

  try {
    const profile = await findOrCreateProfile(
      user.walletAddress,
      user.displayName ?? user.walletAddress.slice(0, 8)
    );
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Tapestry profile error:", error);
    return NextResponse.json(
      { error: "Failed to create on-chain profile" },
      { status: 500 }
    );
  }
}
