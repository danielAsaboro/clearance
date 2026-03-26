import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { submitVoteSchema } from "@/lib/validators";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/votes — Submit a vote on a matchup
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = checkRateLimit(`votes:${user.id}`, 60);
  if (limited) return limited;

  const body = await req.json();
  const parsed = submitVoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { matchupId, decision, timeToVoteMs } = parsed.data;

  // Parse device type from User-Agent
  const ua = req.headers.get("user-agent") ?? "";
  const deviceType = /mobile/i.test(ua)
    ? "mobile"
    : /tablet|ipad/i.test(ua)
      ? "tablet"
      : ua
        ? "desktop"
        : null;

  // Check matchup exists
  const matchup = await prisma.matchup.findUnique({
    where: { id: matchupId },
    include: { session: true },
  });

  if (!matchup) {
    return NextResponse.json({ error: "Matchup not found" }, { status: 404 });
  }

  // Check session is live
  if (matchup.session.status !== "live") {
    return NextResponse.json({ error: "Session is not live" }, { status: 400 });
  }

  // Upsert vote — allows changing pick while round is still active
  const vote = await prisma.vote.upsert({
    where: { userId_matchupId: { userId: user.id, matchupId } },
    update: { decision, timeToVoteMs, deviceType },
    create: {
      userId: user.id,
      matchupId,
      decision,
      timeToVoteMs,
      deviceType,
    },
  });

  // No real-time correctness — winner determined after session ends
  return NextResponse.json(vote, { status: 201 });
}
