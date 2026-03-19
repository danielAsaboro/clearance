import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";
import { resolveVideoAssetUrls } from "@/lib/video-response";

// GET /api/sessions/:id/rounds — Returns matchups for a session (backwards-compat endpoint name)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [matchups, session] = await Promise.all([
    prisma.matchup.findMany({
      where: { sessionId: id },
      orderBy: { matchupNumber: "asc" },
      select: {
        id: true,
        matchupNumber: true,
        duration: true,
        videoA: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            title: true,
            sourceKey: true,
            playbackKey: true,
            thumbnailKey: true,
            uploadedBy: { select: { displayName: true } },
          },
        },
        videoB: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            title: true,
            sourceKey: true,
            playbackKey: true,
            thumbnailKey: true,
            uploadedBy: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.weeklySession.findUnique({
      where: { id },
      select: { campaign: { select: { votingRoundDurationSecs: true } } },
    }),
  ]);

  const roundDurationSeconds =
    session?.campaign?.votingRoundDurationSecs ?? campaignConfig.votingRoundDurationSeconds;

  return NextResponse.json({
    matchups: matchups.map((matchup) => ({
      ...matchup,
      videoA: resolveVideoAssetUrls(matchup.videoA, req.nextUrl.origin),
      videoB: resolveVideoAssetUrls(matchup.videoB, req.nextUrl.origin),
    })),
    roundDurationSeconds,
  });
}
