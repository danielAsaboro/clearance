import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/sessions/:id/rounds — Returns matchups for a session (backwards-compat endpoint name)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const matchups = await prisma.matchup.findMany({
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
  });

  return NextResponse.json(matchups);
}
