import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const eventSchema = z.object({
  events: z
    .array(
      z.object({
        type: z.enum(["video_impression", "page_view"]),
        videoId: z.string().optional(),
        sessionId: z.string().optional(),
        matchupId: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1)
    .max(50),
});

// POST /api/analytics/events — Batch insert analytics events
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  const userId = user?.id ?? null;

  // Rate limit: 30 requests per minute per user/IP
  const key = userId ?? req.headers.get("x-forwarded-for") ?? "anon";
  const limited = checkRateLimit(`analytics:${key}`, 30);
  if (limited) return limited;

  const body = await req.json();
  const parsed = eventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Fire-and-forget batch insert
  const records: Prisma.AnalyticsEventCreateManyInput[] = parsed.data.events.map((e) => ({
    type: e.type,
    userId,
    videoId: e.videoId ?? null,
    sessionId: e.sessionId ?? null,
    matchupId: e.matchupId ?? null,
    metadata: e.metadata ? (e.metadata as Prisma.InputJsonValue) : undefined,
  }));
  void prisma.analyticsEvent.createMany({ data: records });

  return NextResponse.json({ received: parsed.data.events.length }, { status: 202 });
}
