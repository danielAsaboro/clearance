import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/admin/analytics/export?type=videos|players|sessions — CSV export
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "videos";

  let csv = "";
  let filename = "";

  switch (type) {
    case "videos": {
      const videos = await prisma.video.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          category: { select: { name: true } },
          tags: true,
          createdAt: true,
          stats: true,
        },
        orderBy: { createdAt: "desc" },
      });

      csv = "ID,Title,Category,Status,Tags,Times Used,Times Won,Win Rate,Avg Vote Share,Sessions Appeared,Created\n";
      for (const v of videos) {
        const s = v.stats;
        csv += [
          v.id,
          csvEscape(v.title ?? "Untitled"),
          csvEscape(v.category?.name ?? ""),
          v.status,
          csvEscape(v.tags.join("; ")),
          s?.timesUsed ?? 0,
          s?.timesWon ?? 0,
          s?.winRate ?? 0,
          s?.avgVoteShare ?? 0,
          s?.sessionsAppeared ?? 0,
          v.createdAt.toISOString(),
        ].join(",") + "\n";
      }
      filename = "spotr-videos-export.csv";
      break;
    }

    case "players": {
      const results = await prisma.gameResult.groupBy({
        by: ["userId"],
        _sum: { correctVotes: true, totalVotes: true, rewardAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { correctVotes: "desc" } },
      });

      const userIds = results.map((r) => r.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, email: true, walletAddress: true, createdAt: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      csv = "User ID,Display Name,Email,Wallet,Sessions Played,Correct Votes,Total Votes,Accuracy %,Total Rewards,Joined\n";
      for (const r of results) {
        const u = userMap.get(r.userId);
        const total = r._sum.totalVotes ?? 0;
        const correct = r._sum.correctVotes ?? 0;
        const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
        csv += [
          r.userId,
          csvEscape(u?.displayName ?? ""),
          csvEscape(u?.email ?? ""),
          u?.walletAddress ?? "",
          r._count._all,
          correct,
          total,
          accuracy,
          Math.round((r._sum.rewardAmount ?? 0) * 100) / 100,
          u?.createdAt.toISOString() ?? "",
        ].join(",") + "\n";
      }
      filename = "spotr-players-export.csv";
      break;
    }

    case "sessions": {
      const sessions = await prisma.weeklySession.findMany({
        include: {
          _count: { select: { matchups: true, gameResults: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });

      csv = "ID,Title,Week,Status,Scheduled At,Matchups,Participants\n";
      for (const s of sessions) {
        csv += [
          s.id,
          csvEscape(s.title),
          s.weekNumber,
          s.status,
          s.scheduledAt.toISOString(),
          s._count.matchups,
          s._count.gameResults,
        ].join(",") + "\n";
      }
      filename = "spotr-sessions-export.csv";
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
