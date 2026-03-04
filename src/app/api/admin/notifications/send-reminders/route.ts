import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { sendSessionReminder } from "@/lib/email";

// POST /api/admin/notifications/send-reminders
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Find sessions scheduled within the next 24 hours
  const sessions = await prisma.weeklySession.findMany({
    where: {
      scheduledAt: { gte: now, lte: in24h },
      status: "scheduled",
    },
  });

  if (sessions.length === 0) {
    return NextResponse.json({ sent: 0, sessions: 0, players: 0 });
  }

  // Get all players with email addresses
  const players = await prisma.user.findMany({
    where: {
      email: { not: null },
      role: "player",
    },
    select: { email: true },
  });

  let sent = 0;

  for (const session of sessions) {
    for (const player of players) {
      if (!player.email) continue;
      const ok = await sendSessionReminder(
        player.email,
        session.title,
        session.scheduledAt,
        session.weekNumber
      );
      if (ok) sent++;
    }
  }

  return NextResponse.json({
    sent,
    sessions: sessions.length,
    players: players.length,
  });
}
