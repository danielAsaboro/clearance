import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { sendSessionReminder } from "@/lib/email";
import { resolveVideoAssetUrls } from "@/lib/video-response";

// GET /api/sessions/:id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({
    where: { id },
    include: {
      matchups: {
        orderBy: { matchupNumber: "asc" },
        include: {
          videoA: true,
          videoB: true,
        },
      },
      _count: { select: { gameResults: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...session,
    matchups: session.matchups.map((matchup) => ({
      ...matchup,
      videoA: resolveVideoAssetUrls(matchup.videoA, req.nextUrl.origin),
      videoB: resolveVideoAssetUrls(matchup.videoB, req.nextUrl.origin),
    })),
  });
}

// PATCH /api/sessions/:id — Admin update session status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Get current session to check state transition
  const current = await prisma.weeklySession.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.status && ["scheduled", "live", "ended"].includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.title) updateData.title = body.title;

  const session = await prisma.weeklySession.update({
    where: { id },
    data: updateData,
  });

  // Send reminder emails when session goes live
  if (body.status === "live" && current.status !== "live") {
    // Fire-and-forget: send reminders to all players with emails
    const players = await prisma.user.findMany({
      where: { role: "player", email: { not: null } },
      select: { email: true },
    });

    Promise.allSettled(
      players
        .filter((p) => p.email)
        .map((p) =>
          sendSessionReminder(
            p.email!,
            session.title,
            session.scheduledAt,
            session.weekNumber
          )
        )
    ).then((results) => {
      const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
      console.log(`[Reminders] Sent ${sent}/${players.length} session reminder emails`);
    });
  }

  return NextResponse.json(session);
}
