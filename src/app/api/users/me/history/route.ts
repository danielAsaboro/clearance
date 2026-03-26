import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { campaignConfig } from "@/lib/campaign-config";

// GET /api/users/me/history — Paginated game history
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10")));
  const skip = (page - 1) * limit;

  const [games, total] = await Promise.all([
    prisma.gameResult.findMany({
      where: { userId: user.id },
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
    prisma.gameResult.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    games: games.map((g) => {
      const totalMatchups = g.session._count.matchups;
      return {
        sessionId: g.sessionId,
        sessionTitle: g.session.title,
        weekNumber: g.session.weekNumber,
        scheduledAt: g.session.scheduledAt,
        sessionStatus: g.session.status,
        totalVotes: g.totalVotes,
        correctVotes: g.correctVotes,
        totalMatchups,
        accuracy:
          totalMatchups > 0
            ? Math.round((g.correctVotes / totalMatchups) * 1000) / 10
            : 0,
        tier: g.tier,
        rewardAmount: totalMatchups > 0
          ? Math.round((campaignConfig.entryFeeUsdc / totalMatchups) * g.correctVotes * 100) / 100
          : 0,
        nftMinted: g.nftMinted,
        nftRevealed: g.nftRevealed,
        usdcClaimed: g.usdcClaimed,
        claimedAt: g.claimedAt,
        lateJoin: g.lateJoin,
        joinedAt: g.joinedAt,
      };
    }),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
