import { NextRequest, NextResponse } from "next/server";
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
  tribeName: string | null;
}

export interface TribeRanking {
  rank: number;
  leaderId: string;
  leaderName: string;
  leaderPhoto: string | null;
  memberCount: number;
  tribeScore: number;
}

// GET /api/leaderboard — Public player rankings by correct predictions
// ?tab=tribes — Tribe rankings by collective score
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab");

  if (tab === "tribes") {
    return getTribeRankings();
  }

  return getPlayerRankings();
}

async function getPlayerRankings() {
  const players = await prisma.user.findMany({
    where: {
      role: "player",
      isGuest: false,
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
      referralReceived: {
        select: {
          referrer: {
            select: { displayName: true },
          },
        },
      },
      referralsMade: {
        select: { id: true },
        take: 1,
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

      // Determine tribe affiliation
      const referrerName = player.referralReceived?.referrer?.displayName;
      const isLeader = player.referralsMade.length > 0;
      const tribeName = referrerName
        ? `${referrerName}'s Tribe`
        : isLeader
          ? `${player.displayName ?? "Anonymous"}'s Tribe`
          : null;

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
        tribeName,
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

async function getTribeRankings() {
  // Find all users who have referred at least one person (tribe leaders)
  const leaders = await prisma.user.findMany({
    where: {
      referralsMade: { some: {} },
    },
    select: {
      id: true,
      displayName: true,
      profilePhoto: true,
      gameResults: {
        select: { correctVotes: true },
      },
      referralsMade: {
        select: {
          referredUser: {
            select: {
              id: true,
              gameResults: {
                select: { correctVotes: true },
              },
            },
          },
        },
      },
    },
  });

  const tribes: TribeRanking[] = leaders
    .map((leader) => {
      const leaderScore = leader.gameResults.reduce(
        (sum, r) => sum + r.correctVotes,
        0
      );
      const membersScore = leader.referralsMade.reduce(
        (sum, ref) =>
          sum +
          ref.referredUser.gameResults.reduce(
            (s, r) => s + r.correctVotes,
            0
          ),
        0
      );

      return {
        rank: 0,
        leaderId: leader.id,
        leaderName: leader.displayName ?? "Anonymous",
        leaderPhoto: leader.profilePhoto,
        memberCount: leader.referralsMade.length,
        tribeScore: leaderScore + membersScore,
      };
    })
    .sort((a, b) => b.tribeScore - a.tribeScore)
    .map((t, i) => ({ ...t, rank: i + 1 }));

  return NextResponse.json(tribes);
}
