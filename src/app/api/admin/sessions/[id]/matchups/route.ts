import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createMatchupsSchema } from "@/lib/validators";

// GET /api/admin/sessions/:id/matchups — List matchups for a session
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const matchups = await prisma.matchup.findMany({
    where: { sessionId: id },
    orderBy: { matchupNumber: "asc" },
    include: {
      videoA: true,
      videoB: true,
      _count: { select: { votes: true } },
    },
  });

  return NextResponse.json(matchups);
}

// POST /api/admin/sessions/:id/matchups — Create matchups for a session
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
  const parsed = createMatchupsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const session = await prisma.weeklySession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "scheduled") {
    return NextResponse.json(
      { error: "Can only add matchups to scheduled sessions" },
      { status: 400 }
    );
  }

  // Delete existing matchups for this session first
  await prisma.matchup.deleteMany({ where: { sessionId: id } });

  const matchups = await prisma.matchup.createMany({
    data: parsed.data.matchups.map((m) => ({
      sessionId: id,
      matchupNumber: m.matchupNumber,
      videoAId: m.videoAId,
      videoBId: m.videoBId,
    })),
  });

  return NextResponse.json({ created: matchups.count }, { status: 201 });
}

// DELETE /api/admin/sessions/:id/matchups — Remove all matchups for a session
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({ where: { id } });
  if (!session || session.status !== "scheduled") {
    return NextResponse.json(
      { error: "Can only remove matchups from scheduled sessions" },
      { status: 400 }
    );
  }

  await prisma.matchup.deleteMany({ where: { sessionId: id } });

  return NextResponse.json({ success: true });
}
