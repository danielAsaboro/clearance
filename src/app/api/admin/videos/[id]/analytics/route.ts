import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

// GET /api/admin/videos/:id/analytics — Per-video performance stats + matchup history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const video = await prisma.video.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      category: { select: { name: true } },
      tags: true,
      status: true,
      createdAt: true,
      stats: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // Get matchup history for this video
  const matchups = await prisma.matchup.findMany({
    where: {
      OR: [{ videoAId: id }, { videoBId: id }],
    },
    include: {
      session: { select: { id: true, title: true, weekNumber: true, scheduledAt: true } },
      videoA: { select: { id: true, title: true } },
      videoB: { select: { id: true, title: true } },
      votes: { select: { decision: true } },
    },
    orderBy: { session: { scheduledAt: "desc" } },
  });

  const matchupHistory = matchups.map((m) => {
    const isVideoA = m.videoAId === id;
    const opponent = isVideoA ? m.videoB : m.videoA;
    const votesA = m.votes.filter((v) => v.decision === "video_a").length;
    const votesB = m.votes.filter((v) => v.decision === "video_b").length;
    const votesFor = isVideoA ? votesA : votesB;
    const votesAgainst = isVideoA ? votesB : votesA;
    const totalVotes = votesFor + votesAgainst;

    return {
      sessionId: m.session.id,
      sessionTitle: m.session.title,
      weekNumber: m.session.weekNumber,
      scheduledAt: m.session.scheduledAt,
      matchupNumber: m.matchupNumber,
      opponent: { id: opponent.id, title: opponent.title },
      won: m.winningVideoId === id,
      lost: m.winningVideoId !== null && m.winningVideoId !== id,
      votesFor,
      votesAgainst,
      voteShare: totalVotes > 0 ? Math.round((votesFor / totalVotes) * 1000) / 10 : 0,
    };
  });

  return NextResponse.json({
    video: {
      id: video.id,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      category: video.category?.name ?? null,
      tags: video.tags,
      status: video.status,
      createdAt: video.createdAt,
    },
    stats: video.stats ?? {
      timesUsed: 0,
      timesWon: 0,
      timesLost: 0,
      totalVotesFor: 0,
      totalVotesAgainst: 0,
      winRate: 0,
      avgVoteShare: 0,
      sessionsAppeared: 0,
      lastUsedAt: null,
    },
    matchupHistory,
  });
}
