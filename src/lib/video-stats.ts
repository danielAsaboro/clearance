import { prisma } from "@/lib/db";

/**
 * Re-aggregate VideoStats for every video that appeared in the given session's matchups.
 * Called after session finalization so stats reflect the latest winners.
 */
export async function updateVideoStatsForSession(sessionId: string) {
  // Get all matchups for this session to find which videos were involved
  const matchups = await prisma.matchup.findMany({
    where: { sessionId },
    select: { videoAId: true, videoBId: true },
  });

  const videoIds = new Set<string>();
  for (const m of matchups) {
    videoIds.add(m.videoAId);
    videoIds.add(m.videoBId);
  }

  // Re-aggregate stats for each touched video
  await Promise.all(
    Array.from(videoIds).map((videoId) => refreshVideoStats(videoId))
  );
}

/**
 * Recompute all-time stats for a single video from Matchup + Vote data and upsert into VideoStats.
 */
async function refreshVideoStats(videoId: string) {
  // Get all matchups where this video appeared (as A or B)
  const matchups = await prisma.matchup.findMany({
    where: {
      OR: [{ videoAId: videoId }, { videoBId: videoId }],
    },
    include: {
      votes: { select: { decision: true } },
      session: { select: { id: true, scheduledAt: true } },
    },
  });

  if (matchups.length === 0) {
    // No matchups — ensure no stale stats exist
    await prisma.videoStats.deleteMany({ where: { videoId } });
    return;
  }

  let timesUsed = 0;
  let timesWon = 0;
  let timesLost = 0;
  let totalVotesFor = 0;
  let totalVotesAgainst = 0;
  let voteShareSum = 0;
  let voteShareCount = 0;
  const sessionIds = new Set<string>();
  let lastUsedAt: Date | null = null;

  for (const m of matchups) {
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

    // Determine if this video won the matchup
    if (m.winningVideoId) {
      if (m.winningVideoId === videoId) {
        timesWon++;
      } else {
        timesLost++;
      }
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
}

/**
 * Backfill VideoStats for all videos that have ever appeared in matchups.
 */
export async function backfillAllVideoStats() {
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
    await refreshVideoStats(videoId);
    count++;
    if (count % 20 === 0) {
      console.log(`  ${count}/${videoIds.size} done`);
    }
  }

  console.log(`Backfill complete: ${count} videos processed.`);
}
