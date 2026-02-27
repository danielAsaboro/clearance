import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const ROUND_DURATION_SECONDS = 30;
const TICK_INTERVAL_MS = 1000;

// GET /api/sessions/:id/stream — SSE endpoint for server-authoritative round state
// Clients receive { round, secondsRemaining, totalRounds, status } every second.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await prisma.weeklySession.findUnique({
    where: { id },
    include: {
      _count: { select: { rounds: true } },
    },
  });

  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  const totalRounds = session._count.rounds;

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
          });
          if (!refreshed) {
            sendEvent({ status: "ended", round: 0, secondsRemaining: 0, totalRounds });
            controller.close();
            clearInterval(intervalId);
            return;
          }
          currentSession = { ...refreshed, _count: { rounds: totalRounds } };
        } catch {
          return;
        }

        if (currentSession.status === "ended") {
          sendEvent({ status: "ended", round: 0, secondsRemaining: 0, totalRounds });
          controller.close();
          clearInterval(intervalId);
          return;
        }

        if (currentSession.status !== "live") {
          sendEvent({ status: currentSession.status, round: 0, secondsRemaining: 0, totalRounds });
          return;
        }

        const now = Date.now();
        const start = new Date(currentSession.scheduledAt).getTime();
        const elapsed = Math.max(0, Math.floor((now - start) / 1000));
        const currentRound = Math.min(
          Math.floor(elapsed / ROUND_DURATION_SECONDS) + 1,
          totalRounds
        );
        const secondsIntoRound = elapsed % ROUND_DURATION_SECONDS;
        const secondsRemaining = ROUND_DURATION_SECONDS - secondsIntoRound;

        if (currentRound > totalRounds) {
          sendEvent({ status: "ended", round: totalRounds, secondsRemaining: 0, totalRounds });
          controller.close();
          clearInterval(intervalId);
          return;
        }

        sendEvent({
          status: "live",
          round: currentRound,
          secondsRemaining,
          totalRounds,
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
