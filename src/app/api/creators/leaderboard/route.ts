import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFollowers } from "@/lib/tapestry";

export interface CreatorRanking {
  rank: number;
  userId: string;
  displayName: string;
  tiktokUsername: string;
  profilePhoto: string | null;
  approvedVideos: number;
  totalVideos: number;
  approvalRate: number;
  fanVotesReceived: number;
  weekNumbers: number[];
  walletAddress: string | null;
  followerCount: number;
}

// GET /api/creators/leaderboard — Public creator rankings
export async function GET() {
  // Get all creators with their tasks that have been linked to session rounds
  const creators = await prisma.user.findMany({
    where: { role: "creator" },
    select: {
      id: true,
      displayName: true,
      tiktokUsername: true,
      profilePhoto: true,
      walletAddress: true,
      tasks: {
        where: { sessionRound: { isNot: null } },
        select: {
          weekNumber: true,
          sessionRound: {
            select: {
              id: true,
              adminVerdict: true,
              _count: { select: { votes: true } },
            },
          },
        },
      },
    },
  });

  const rankings: CreatorRanking[] = creators
    .map((creator) => {
      const rounds = creator.tasks
        .map((t) => t.sessionRound)
        .filter(Boolean);

      const approvedVideos = rounds.filter(
        (r) => r!.adminVerdict === "approved"
      ).length;

      const totalVideos = rounds.length;
      const fanVotesReceived = rounds.reduce(
        (sum, r) => sum + r!._count.votes,
        0
      );
      const approvalRate =
        totalVideos > 0 ? Math.round((approvedVideos / totalVideos) * 100) : 0;

      const weekNumbers = [
        ...new Set(creator.tasks.map((t) => t.weekNumber)),
      ].sort();

      return {
        rank: 0,
        userId: creator.id,
        displayName: creator.displayName ?? "Anonymous",
        tiktokUsername: creator.tiktokUsername ?? "",
        profilePhoto: creator.profilePhoto,
        approvedVideos,
        totalVideos,
        approvalRate,
        fanVotesReceived,
        weekNumbers,
        walletAddress: creator.walletAddress ?? null,
        followerCount: 0,
      };
    })
    // Sort: most approved first, then by fan votes as tiebreaker
    .sort(
      (a, b) =>
        b.approvedVideos - a.approvedVideos ||
        b.fanVotesReceived - a.fanVotesReceived
    )
    .map((c, i) => ({ ...c, rank: i + 1 }));

  // Enrich with Tapestry follower counts (best-effort, non-blocking)
  try {
    const followerResults = await Promise.allSettled(
      rankings.map(async (creator) => {
        if (!creator.walletAddress) return 0;
        const data = await getFollowers(creator.walletAddress);
        return data.count;
      })
    );
    followerResults.forEach((result, i) => {
      if (result.status === "fulfilled") {
        rankings[i].followerCount = result.value;
      }
    });
  } catch {
    // Non-fatal — return rankings without follower counts
  }

  return NextResponse.json(rankings);
}
