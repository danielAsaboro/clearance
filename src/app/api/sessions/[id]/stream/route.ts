import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { campaignConfig } from "@/lib/campaign-config";

const TICK_INTERVAL_MS = 1000;

// GET /api/sessions/:id/stream — SSE endpoint for server-authoritative matchup state
// Clients receive { matchup, secondsRemaining, totalMatchups, status } every second.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({
    where: { id },
    include: {
      _count: { select: { matchups: true } },
      campaign: { select: { votingRoundDurationSecs: true } },
    },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const totalMatchups = session._count.matchups;
  const roundDuration = session.campaign?.votingRoundDurationSecs ?? campaignConfig.votingRoundDurationSeconds;

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

      const tick = async () => {
        // Re-fetch session status on each tick so we reflect live→ended transitions
        let currentSession: typeof session;
        try {
          const refreshed = await prisma.weeklySession.findUnique({
            where: { id },
            include: {
              campaign: { select: { votingRoundDurationSecs: true } },
            },
          });
          if (!refreshed) {
            sendEvent({ status: "ended", round: 0, secondsRemaining: 0, totalRounds: totalMatchups });
            controller.close();
            clearInterval(intervalId);
            return;
          }
          currentSession = { ...refreshed, _count: { matchups: totalMatchups } };
        } catch {
          return;
        }

        if (currentSession.status === "ended") {
          sendEvent({ status: "ended", round: 0, secondsRemaining: 0, totalRounds: totalMatchups });
          controller.close();
          clearInterval(intervalId);
          return;
        }

        if (currentSession.status !== "live") {
          sendEvent({ status: currentSession.status, round: 0, secondsRemaining: 0, totalRounds: totalMatchups });
          return;
        }

        const now = Date.now();
        const start = new Date(currentSession.scheduledAt).getTime();
        const elapsed = Math.max(0, Math.floor((now - start) / 1000));

        // All rounds complete — session over
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

      // Send initial tick immediately
      tick();
      const intervalId = setInterval(tick, TICK_INTERVAL_MS);

      // Clean up when client disconnects
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
