import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

// GET /api/sessions/:id/rounds — Returns matchups for a session (backwards-compat endpoint name)
export async function GET(
  _req: NextRequest,
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
          select: { id: true, url: true, thumbnailUrl: true, title: true },
        },
        videoB: {
          select: { id: true, url: true, thumbnailUrl: true, title: true },
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

  return NextResponse.json({ matchups, roundDurationSeconds });
}
