import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { canLateJoin, getCurrentRound } from "@/lib/session-engine";
import { checkRateLimit } from "@/lib/rate-limit";
import { trackAction } from "@/lib/torque";

// POST /api/sessions/:id/join — Fan joins a session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`join:${user.id}`, 10);
  if (limited) return limited;

  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "live" && session.status !== "scheduled") {
    return NextResponse.json({ error: "Session is not active" }, { status: 400 });
  }

  // Check if already joined
  const existing = await prisma.gameResult.findUnique({
    where: { userId_sessionId: { userId: user.id, sessionId: id } },
  });

  if (existing) {
    return NextResponse.json(existing);
  }

  const isLateJoin = session.status === "live" && canLateJoin(session);
  const joinedAtRound = isLateJoin ? getCurrentRound(session) : 1;

  const gameResult = await prisma.gameResult.create({
    data: {
      userId: user.id,
      sessionId: id,
      walletAddress: user.walletAddress,
      lateJoin: isLateJoin,
    },
  });

  // Fire-and-forget: track loyalty action via Torque
  if (user.walletAddress) {
    trackAction(user.walletAddress, "session_join");
  }

  return NextResponse.json({ ...gameResult, joinedAtRound }, { status: 201 });
}
