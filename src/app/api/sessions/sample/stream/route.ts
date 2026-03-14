import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

const TICK_INTERVAL_MS = 1000;

// GET /api/sessions/sample/stream — SSE endpoint for sample session
// Per-player timing: starts "now" when the client connects and runs through all rounds.
export async function GET(req: NextRequest) {
  if (!campaignConfig.sampleSessionEnabled) {
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
      const sendEvent = (data: object) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(new TextEncoder().encode(payload));
        } catch {
          // client disconnected
        }
      };

      const tick = () => {
        const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        const totalDuration = totalMatchups * roundDuration;

        if (elapsed >= totalDuration) {
          sendEvent({ status: "ended", round: totalMatchups, secondsRemaining: 0, totalRounds: totalMatchups, roundDuration });
          controller.close();
          clearInterval(intervalId);
          return;
        }

        const currentRound = Math.floor(elapsed / roundDuration) + 1;
        const secondsIntoRound = elapsed % roundDuration;
        const secondsRemaining = roundDuration - secondsIntoRound;

        sendEvent({
          status: "live",
          round: currentRound,
          secondsRemaining,
          totalRounds: totalMatchups,
          roundDuration,
        });
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
