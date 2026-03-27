import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateMajorityWinners } from "@/lib/session-engine";

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

  // Pre-compute majority winners for all matchups (shared by both tabs)
  const allMatchups = await prisma.matchup.findMany({
    select: {
      id: true,
      videoAId: true,
      videoBId: true,
      votes: { select: { decision: true } },
    },
  });

  const winnerMap = calculateMajorityWinners(
    allMatchups.map((m) => ({
      id: m.id,
      videoAId: m.videoAId,
      videoBId: m.videoBId,
      votes: m.votes.map((v) => ({ decision: v.decision as "video_a" | "video_b" })),
    }))
  );

  if (tab === "tribes") {
    return getTribeRankings(winnerMap);
  }

  return getPlayerRankings(winnerMap);
}

function countCorrectVotes(
  votes: { decision: string; matchup: { id: string; videoAId: string; videoBId: string } }[],
  winnerMap: Map<string, string>
) {
  return votes.filter((v) => {
    const winner = winnerMap.get(v.matchup.id);
    if (!winner) return false;
    return (
      (v.decision === "video_a" && winner === v.matchup.videoAId) ||
      (v.decision === "video_b" && winner === v.matchup.videoBId)
    );
  }).length;
}

async function getPlayerRankings(winnerMap: Map<string, string>) {
  const players = await prisma.user.findMany({
    where: {
      gameResults: { some: {} },
    },
    select: {
      id: true,
      displayName: true,
      profilePhoto: true,
      walletAddress: true,
      gameResults: {
        select: { sessionId: true },
      },
      votes: {
        select: {
          decision: true,
          matchup: {
            select: { id: true, videoAId: true, videoBId: true },
          },
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
      const correctPredictions = countCorrectVotes(player.votes, winnerMap);
      const totalVotes = player.votes.length;
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

async function getTribeRankings(winnerMap: Map<string, string>) {
  // Find all users who have referred at least one person (tribe leaders)
  const leaders = await prisma.user.findMany({
    where: {
      referralsMade: { some: {} },
    },
    select: {
      id: true,
      displayName: true,
      profilePhoto: true,
      votes: {
        select: {
          decision: true,
          matchup: {
            select: { id: true, videoAId: true, videoBId: true },
          },
        },
      },
      referralsMade: {
        select: {
          referredUser: {
            select: {
              id: true,
              votes: {
                select: {
                  decision: true,
                  matchup: {
                    select: { id: true, videoAId: true, videoBId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const tribes: TribeRanking[] = leaders
    .map((leader) => {
      const leaderScore = countCorrectVotes(leader.votes, winnerMap);
      const membersScore = leader.referralsMade.reduce(
        (sum, ref) => sum + countCorrectVotes(ref.referredUser.votes, winnerMap),
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
