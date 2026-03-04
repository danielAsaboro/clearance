import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface PlayerRanking {
  rank: number;
  userId: string;
  displayName: string;
  profilePhoto: string | null;
  correctPredictions: number;
  totalVotes: number;
  sessionsPlayed: number;
  winRate: number;
  walletAddress: string | null;
}

// GET /api/leaderboard — Public player rankings by correct predictions
export async function GET() {
  // Get all players with game results
  const players = await prisma.user.findMany({
    where: {
      role: "player",
      gameResults: { some: {} },
    },
    select: {
      id: true,
      displayName: true,
      profilePhoto: true,
      walletAddress: true,
      gameResults: {
        select: {
          correctVotes: true,
          totalVotes: true,
        },
      },
    },
  });

  const rankings: PlayerRanking[] = players
    .map((player) => {
      const correctPredictions = player.gameResults.reduce(
        (sum, r) => sum + r.correctVotes,
        0
      );
      const totalVotes = player.gameResults.reduce(
        (sum, r) => sum + r.totalVotes,
        0
      );
      const sessionsPlayed = player.gameResults.length;
      const winRate =
        totalVotes > 0
          ? Math.round((correctPredictions / totalVotes) * 100)
          : 0;

      return {
        rank: 0,
        userId: player.id,
        displayName: player.displayName ?? "Anonymous",
        profilePhoto: player.profilePhoto,
        correctPredictions,
        totalVotes,
        sessionsPlayed,
        winRate,
        walletAddress: player.walletAddress ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.correctPredictions - a.correctPredictions ||
        b.winRate - a.winRate ||
        b.sessionsPlayed - a.sessionsPlayed
    )
    .map((p, i) => ({ ...p, rank: i + 1 }));

  return NextResponse.json(rankings);
}
