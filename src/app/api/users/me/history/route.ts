import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser, resolveCampaignId } from "@/lib/auth-helpers";

// GET /api/users/me/history — Paginated game history
// ?campaignId=xxx — Filter by campaign (default: active, "all" for cumulative)
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));
  const skip = (page - 1) * limit;

  const campaignId = await resolveCampaignId(searchParams.get("campaignId"));
  const sessionFilter = campaignId ? { session: { campaignId } } : {};

  const [games, total] = await Promise.all([
    prisma.gameResult.findMany({
      where: { userId: user.id, ...sessionFilter },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            weekNumber: true,
            scheduledAt: true,
            status: true,
            _count: { select: { matchups: true } },
          },
        },
      },
      orderBy: { session: { scheduledAt: "desc" } },
      skip,
      take: limit,
    }),
    prisma.gameResult.count({ where: { userId: user.id, ...sessionFilter } }),
  ]);

  return NextResponse.json({
    games: games.map((g) => {
      const totalMatchups = g.session._count.matchups;
      return {
        id: g.id,
        sessionId: g.sessionId,
        sessionTitle: g.session.title,
        weekNumber: g.session.weekNumber,
        scheduledAt: g.session.scheduledAt,
        sessionStatus: g.session.status,
        session: {
          title: g.session.title,
          weekNumber: g.session.weekNumber,
          status: g.session.status,
        },
        tier: g.tier,
        totalVotes: g.totalVotes,
        correctVotes: g.correctVotes,
        totalMatchups,
        accuracy:
          totalMatchups > 0
            ? Math.round((g.correctVotes / totalMatchups) * 1000) / 10
            : 0,
        rewardAmount: Math.round((g.rewardAmount ?? 0) * 100) / 100,
        nftMinted: g.nftMinted,
        nftRevealed: g.nftRevealed,
        usdcClaimed: g.usdcClaimed,
        claimedAt: g.claimedAt,
        claimTxHash: g.claimTxHash,
        depositConfirmed: g.depositConfirmed,
        lateJoin: g.lateJoin,
        joinedAt: g.joinedAt,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
