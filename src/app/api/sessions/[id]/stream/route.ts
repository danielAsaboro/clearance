import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

const RESULTS_DURATION = 5; // seconds of results overlay between rounds
const CACHE_TTL_MS = 800; // share one DB fetch across all concurrent polls

// Per-session cache: avoids 150 identical DB queries within the same second
const sessionCache = new Map<string, { data: any; fetchedAt: number }>();

async function getCachedSession(id: string) {
  const cached = sessionCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }
  const refreshed = await prisma.weeklySession.findUnique({
    where: { id },
    include: {
      _count: { select: { matchups: true } },
      campaign: { select: { votingRoundDurationSecs: true } },
    },
  });
  sessionCache.set(id, { data: refreshed, fetchedAt: Date.now() });
  // Evict stale entries
  if (sessionCache.size > 100) {
    const now = Date.now();
    for (const [key, val] of sessionCache) {
      if (now - val.fetchedAt > 10_000) sessionCache.delete(key);
    }
  }
  return refreshed;
}

// GET /api/sessions/:id/stream — Polling endpoint for server-authoritative round state
// Returns { status, round, secondsRemaining, totalRounds, roundDuration }
// Clients poll every 1-2 seconds.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getCachedSession(id);

  if (!session) {
    return NextResponse.json(
      { status: "ended", round: 0, secondsRemaining: 0, totalRounds: 0 },
      { status: 404 }
    );
  }

  const totalMatchups = session._count.matchups;
  const roundDuration =
    session.campaign?.votingRoundDurationSecs ??
    campaignConfig.votingRoundDurationSeconds;

  if (session.status === "ended") {
    return NextResponse.json({
      status: "ended",
      round: 0,
      secondsRemaining: 0,
      totalRounds: totalMatchups,
      roundDuration,
    });
  }

  if (session.status !== "live") {
    return NextResponse.json({
      status: session.status,
      round: 0,
      secondsRemaining: 0,
      totalRounds: totalMatchups,
      roundDuration,
    });
  }

  const now = Date.now();
  const start = new Date(session.scheduledAt).getTime();
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));

  const slotDuration = roundDuration + RESULTS_DURATION;
  const totalDuration = totalMatchups * slotDuration;

  // All rounds complete
  if (elapsed >= totalDuration) {
    return NextResponse.json({
      status: "ended",
      round: totalMatchups,
      secondsRemaining: 0,
      totalRounds: totalMatchups,
      roundDuration,
    });
  }

  const slotIndex = Math.floor(elapsed / slotDuration);
  const secondsIntoSlot = elapsed % slotDuration;
  const currentRound = slotIndex + 1;

  if (secondsIntoSlot < roundDuration) {
    // Voting phase
    return NextResponse.json({
      status: "live",
      round: currentRound,
      secondsRemaining: roundDuration - secondsIntoSlot,
      totalRounds: totalMatchups,
      roundDuration,
    });
  }

  // Results phase
  return NextResponse.json({
    status: "results",
    round: currentRound,
    secondsRemaining: 0,
    totalRounds: totalMatchups,
    roundDuration,
  });
}
