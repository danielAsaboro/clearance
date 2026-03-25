import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [session, gameResults, discountCodes] = await Promise.all([
    prisma.weeklySession.findUnique({
      where: { id },
      include: {
        matchups: {
          orderBy: { matchupNumber: "asc" },
          include: {
            votes: { select: { decision: true } },
            videoA: { select: { id: true, title: true } },
            videoB: { select: { id: true, title: true } },
            winningVideo: { select: { id: true, title: true } },
          },
        },
      },
    }),
    prisma.gameResult.findMany({
      where: { sessionId: id },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            walletAddress: true,
          },
        },
      },
      orderBy: { correctVotes: "desc" },
    }),
    prisma.discountCode.findMany({
      where: { sessionId: id },
      include: { user: { select: { displayName: true } } },
    }),
  ]);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get referrals for players in this session
  const playerUserIds = gameResults.map((gr) => gr.userId);
  const referrals = await prisma.referral.findMany({
    where: { referredUserId: { in: playerUserIds } },
    include: {
      referrer: { select: { displayName: true } },
      referredUser: { select: { displayName: true } },
    },
  });

  // Compute matchup analytics
  const matchups = session.matchups.map((m) => {
    const videoAVotes = m.votes.filter((v) => v.decision === "video_a").length;
    const videoBVotes = m.votes.filter((v) => v.decision === "video_b").length;
    const totalVotes = videoAVotes + videoBVotes;
    const winningVotes = Math.max(videoAVotes, videoBVotes);

    return {
      matchupNumber: m.matchupNumber,
      videoA: m.videoA,
      videoB: m.videoB,
      winningVideo: m.winningVideo,
      totalVotes,
      videoAVotes,
      videoBVotes,
      consensusRate: totalVotes > 0 ? Math.round((winningVotes / totalVotes) * 100) : 0,
    };
  });

  // Compute overview
  const totalVotes = matchups.reduce((sum, m) => sum + m.totalVotes, 0);
  const totalParticipants = gameResults.length;
  const lateJoiners = gameResults.filter((gr) => gr.lateJoin).length;
  const nftsMinted = gameResults.filter((gr) => gr.nftMinted).length;
  const nftsRevealed = gameResults.filter((gr) => gr.nftRevealed).length;
  const usdcClaimed = gameResults.filter((gr) => gr.usdcClaimed).length;
  const depositsConfirmed = gameResults.filter((gr) => gr.depositConfirmed).length;
  const totalRewardsUsdc = gameResults.reduce((sum, gr) => sum + gr.rewardAmount, 0);

  const tierDistribution = {
    gold: gameResults.filter((gr) => gr.tier === "gold").length,
    base: gameResults.filter((gr) => gr.tier === "base").length,
    participation: gameResults.filter((gr) => gr.tier === "participation").length,
  };

  const totalMatchups = session.matchups.length;
  const accuracies = gameResults
    .filter((gr) => gr.totalVotes > 0)
    .map((gr) => gr.correctVotes / gr.totalVotes);
  const averageAccuracy =
    accuracies.length > 0
      ? Math.round((accuracies.reduce((a, b) => a + b, 0) / accuracies.length) * 100)
      : 0;

  // Players with drop-off info
  const players = gameResults.map((gr, index) => ({
    rank: index + 1,
    userId: gr.userId,
    displayName: gr.user.displayName,
    email: gr.user.email,
    walletAddress: gr.user.walletAddress,
    totalVotes: gr.totalVotes,
    correctVotes: gr.correctVotes,
    accuracy: gr.totalVotes > 0 ? Math.round((gr.correctVotes / gr.totalVotes) * 100) : 0,
    tier: gr.tier,
    rewardAmount: gr.rewardAmount,
    nftMinted: gr.nftMinted,
    nftRevealed: gr.nftRevealed,
    usdcClaimed: gr.usdcClaimed,
    claimedAt: gr.claimedAt,
    depositConfirmed: gr.depositConfirmed,
    lateJoin: gr.lateJoin,
    joinedAt: gr.joinedAt,
    votedAllMatchups: gr.totalVotes >= totalMatchups,
  }));

  const dropOffCount = players.filter((p) => !p.votedAllMatchups && p.totalVotes > 0).length;

  return NextResponse.json({
    session: {
      id: session.id,
      weekNumber: session.weekNumber,
      title: session.title,
      scheduledAt: session.scheduledAt,
      status: session.status,
      collectionAddress: session.collectionAddress,
      vaultAddress: session.vaultAddress,
    },
    overview: {
      totalParticipants,
      totalMatchups,
      totalVotes,
      tierDistribution,
      lateJoiners,
      averageAccuracy,
      nftsMinted,
      nftsRevealed,
      usdcClaimed,
      totalRewardsUsdc: Math.round(totalRewardsUsdc * 100) / 100,
      depositsConfirmed,
      dropOffCount,
    },
    matchups,
    players,
    referrals: referrals.map((r) => ({
      referrerName: r.referrer.displayName,
      referredName: r.referredUser.displayName,
      code: r.code,
      createdAt: r.createdAt,
    })),
    discountCodes: discountCodes.map((dc) => ({
      code: dc.code,
      userName: dc.user.displayName,
      usedAt: dc.usedAt,
    })),
  });
}
