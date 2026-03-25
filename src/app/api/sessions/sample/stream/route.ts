import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

const TICK_INTERVAL_MS = 1000;
const RESULTS_DURATION = 5; // seconds of results overlay between rounds

// GET /api/sessions/sample/stream — SSE endpoint for sample session
// Per-player timing: starts "now" when the client connects and runs through all rounds.
export async function GET(req: NextRequest) {
  const isAsyncReplay = req.nextUrl.searchParams.get("async") === "true";

  if (!isAsyncReplay && !campaignConfig.sampleSessionEnabled) {
    return new Response("Sample session is disabled", { status: 404 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");

  // Determine total matchups from DB if sessionId provided, otherwise fall back to config
  let totalMatchups = campaignConfig.matchupsPerSession;
  if (sessionId) {
    const count = await prisma.matchup.count({ where: { sessionId } });
    if (count > 0) totalMatchups = count;
  }

  const roundDuration = campaignConfig.votingRoundDurationSeconds;
  const startTime = Date.now();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const sendEvent = (data: object) => {
        if (closed) return;
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(payload));
        } catch {
          // client disconnected
          closed = true;
        }
      };

      const tick = () => {
        if (closed) { clearInterval(intervalId); return; }

        const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const slotDuration = roundDuration + RESULTS_DURATION;
        const totalDuration = totalMatchups * slotDuration;

        if (elapsed >= totalDuration) {
          sendEvent({ status: "ended", round: totalMatchups, secondsRemaining: 0, totalRounds: totalMatchups, roundDuration });
          clearInterval(intervalId);
          closed = true;
          controller.close();
          return;
        }

        const slotIndex = Math.floor(elapsed / slotDuration);
        const secondsIntoSlot = elapsed % slotDuration;
        const currentRound = slotIndex + 1;

        if (secondsIntoSlot < roundDuration) {
          // Voting phase
          const secondsRemaining = roundDuration - secondsIntoSlot;
          sendEvent({ status: "live", round: currentRound, secondsRemaining, totalRounds: totalMatchups, roundDuration });
        } else {
          // Results phase — hold at this round, timer frozen
          sendEvent({ status: "results", round: currentRound, secondsRemaining: 0, totalRounds: totalMatchups, roundDuration });
        }
      };

      tick();
      const intervalId = setInterval(tick, TICK_INTERVAL_MS);

      return () => clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
