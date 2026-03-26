import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // Get all videos that have appeared in matchups
  const matchups = await prisma.matchup.findMany({
    select: { videoAId: true, videoBId: true },
  });

  const videoIds = new Set<string>();
  for (const m of matchups) {
    videoIds.add(m.videoAId);
    videoIds.add(m.videoBId);
  }

  console.log(`Backfilling stats for ${videoIds.size} videos...`);

  let count = 0;
  for (const videoId of videoIds) {
    // Get all matchups where this video appeared
    const videoMatchups = await prisma.matchup.findMany({
      where: {
        OR: [{ videoAId: videoId }, { videoBId: videoId }],
      },
      include: {
        votes: { select: { decision: true } },
        session: { select: { id: true, scheduledAt: true } },
      },
    });

    if (videoMatchups.length === 0) continue;

    let timesUsed = 0;
    let timesWon = 0;
    let timesLost = 0;
    let totalVotesFor = 0;
    let totalVotesAgainst = 0;
    let voteShareSum = 0;
    let voteShareCount = 0;
    const sessionIds = new Set<string>();
    let lastUsedAt: Date | null = null;

    for (const m of videoMatchups) {
      timesUsed++;
      sessionIds.add(m.session.id);

      if (!lastUsedAt || m.session.scheduledAt > lastUsedAt) {
        lastUsedAt = m.session.scheduledAt;
      }

      const isVideoA = m.videoAId === videoId;
      const votesA = m.votes.filter((v) => v.decision === "video_a").length;
      const votesB = m.votes.filter((v) => v.decision === "video_b").length;
      const votesForThis = isVideoA ? votesA : votesB;
      const votesAgainst = isVideoA ? votesB : votesA;

      totalVotesFor += votesForThis;
      totalVotesAgainst += votesAgainst;

      const totalVotes = votesForThis + votesAgainst;
      if (totalVotes > 0) {
        voteShareSum += (votesForThis / totalVotes) * 100;
        voteShareCount++;
      }

      if (m.winningVideoId) {
        if (m.winningVideoId === videoId) timesWon++;
        else timesLost++;
      }
    }

    const winRate = timesUsed > 0 ? (timesWon / timesUsed) * 100 : 0;
    const avgVoteShare = voteShareCount > 0 ? voteShareSum / voteShareCount : 0;

    await prisma.videoStats.upsert({
      where: { videoId },
      update: {
        timesUsed,
        timesWon,
        timesLost,
        totalVotesFor,
        totalVotesAgainst,
        winRate: Math.round(winRate * 10) / 10,
        avgVoteShare: Math.round(avgVoteShare * 10) / 10,
        sessionsAppeared: sessionIds.size,
        lastUsedAt,
      },
      create: {
        videoId,
        timesUsed,
        timesWon,
        timesLost,
        totalVotesFor,
        totalVotesAgainst,
        winRate: Math.round(winRate * 10) / 10,
        avgVoteShare: Math.round(avgVoteShare * 10) / 10,
        sessionsAppeared: sessionIds.size,
        lastUsedAt,
      },
    });

    count++;
    if (count % 20 === 0) {
      console.log(`  ${count}/${videoIds.size} done`);
    }
  }

  console.log(`Backfill complete: ${count} videos processed.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
