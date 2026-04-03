import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getActiveCampaign } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

// GET /api/social/profile — Fetch current user's cumulative stats (scoped to active campaign)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeCampaign = await getActiveCampaign();
  const sessionFilter = activeCampaign
    ? { session: { campaignId: activeCampaign.id } }
    : {};

  const aggregate = await prisma.gameResult.aggregate({
    where: { userId: user.id, ...sessionFilter },
    _count: { id: true },
    _sum: { correctVotes: true },
  });

  return NextResponse.json({
    sessionsPlayed: aggregate._count.id,
    correctPredictions: aggregate._sum.correctVotes ?? 0,
    tasteScore: aggregate._sum.correctVotes ?? 0,
  });
}
