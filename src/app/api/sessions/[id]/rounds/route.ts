import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { fetchTikTokOEmbed } from "@/lib/tiktok";

// GET /api/sessions/:id/rounds
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rounds = await prisma.sessionRound.findMany({
    where: { sessionId: id },
    orderBy: { roundNumber: "asc" },
    select: {
      id: true,
      roundNumber: true,
      tiktokUrl: true,
      tiktokEmbedData: true,
      duration: true,
    },
  });

  return NextResponse.json(rounds);
}

// POST /api/sessions/:id/rounds — Admin adds rounds
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // body.rounds: Array<{ taskId, roundNumber, tiktokUrl }>
  if (!Array.isArray(body.rounds)) {
    return NextResponse.json({ error: "rounds array required" }, { status: 400 });
  }

  // Fetch oEmbed data for each round's TikTok URL in parallel
  const roundsWithEmbed = await Promise.all(
    body.rounds.map(
      async (r: { taskId: string; roundNumber: number; tiktokUrl: string }) => {
        const embedData = await fetchTikTokOEmbed(r.tiktokUrl);
        return {
          sessionId: id,
          taskId: r.taskId,
          roundNumber: r.roundNumber,
          tiktokUrl: r.tiktokUrl,
          tiktokEmbedData: embedData ? JSON.parse(JSON.stringify(embedData)) : null,
        };
      }
    )
  );

  const created = await prisma.sessionRound.createMany({
    data: roundsWithEmbed,
  });

  return NextResponse.json({ count: created.count }, { status: 201 });
}
