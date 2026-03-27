import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

const RESULTS_DURATION = 5; // seconds of results overlay between rounds

// Per-player start times for sample/async sessions
// Key: sessionId:clientStartParam → start timestamp
const playerStartTimes = new Map<string, number>();

// GET /api/sessions/sample/stream — Polling endpoint for sample/async replay sessions
// Per-player timing: each player's clock starts when they first poll.
// Client must pass ?sessionId=...&async=true&startedAt=<timestamp> to maintain timing.
export async function GET(req: NextRequest) {
  const isAsyncReplay = req.nextUrl.searchParams.get("async") === "true";

  if (!isAsyncReplay && !campaignConfig.sampleSessionEnabled) {
    return NextResponse.json({ error: "Sample session is disabled" }, { status: 404 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const clientStartedAt = req.nextUrl.searchParams.get("startedAt");

  // Determine total matchups from DB if sessionId provided
  let totalMatchups = campaignConfig.matchupsPerSession;
  if (sessionId) {
    const count = await prisma.matchup.count({ where: { sessionId } });
    if (count > 0) totalMatchups = count;
  }

  const roundDuration = campaignConfig.votingRoundDurationSeconds;

  // Track per-player start time using clientStartedAt as the key
  const cacheKey = `${sessionId ?? "sample"}:${clientStartedAt ?? "default"}`;
  let startTime = playerStartTimes.get(cacheKey);
  if (!startTime) {
    startTime = clientStartedAt ? parseInt(clientStartedAt, 10) : Date.now();
    playerStartTimes.set(cacheKey, startTime);
    // Evict old entries
    if (playerStartTimes.size > 1000) {
      const cutoff = Date.now() - 3600_000; // 1 hour
      for (const [key, val] of playerStartTimes) {
        if (val < cutoff) playerStartTimes.delete(key);
      }
    }
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  const slotDuration = roundDuration + RESULTS_DURATION;
  const totalDuration = totalMatchups * slotDuration;

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
    return NextResponse.json({
      status: "live",
      round: currentRound,
      secondsRemaining: roundDuration - secondsIntoSlot,
      totalRounds: totalMatchups,
      roundDuration,
    });
  }

  return NextResponse.json({
    status: "results",
    round: currentRound,
    secondsRemaining: 0,
    totalRounds: totalMatchups,
    roundDuration,
  });
}
