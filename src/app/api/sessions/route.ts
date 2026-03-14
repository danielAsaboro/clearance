import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createSessionSchema } from "@/lib/validators";
import { campaignConfig } from "@/lib/campaign-config";

const sessionInclude = {
  _count: { select: { gameResults: true, matchups: true } },
  campaign: { select: { votingRoundDurationSecs: true } },
} as const;

function formatSession(
  session: {
    campaign?: { votingRoundDurationSecs: number } | null;
    _count: { gameResults: number; matchups: number };
    [key: string]: unknown;
  },
  extra?: Record<string, unknown>,
) {
  const { campaign, _count, ...rest } = session;
  return {
    ...rest,
    _count,
    totalMatchups: _count.matchups,
    roundDurationSeconds: campaign?.votingRoundDurationSecs ?? campaignConfig.votingRoundDurationSeconds,
    ...extra,
  };
}

// GET /api/sessions — Get current/next session
export async function GET() {
  const now = new Date();

  // Find live session
  const live = await prisma.weeklySession.findFirst({
    where: { status: "live" },
    include: sessionInclude,
  });

  // Find next scheduled session
  const next = await prisma.weeklySession.findFirst({
    where: { status: "scheduled", scheduledAt: { gte: now } },
    orderBy: { scheduledAt: "asc" },
    include: sessionInclude,
  });

  // Find last ended session
  const lastEnded = await prisma.weeklySession.findFirst({
    where: { status: "ended" },
    orderBy: { scheduledAt: "desc" },
    include: sessionInclude,
  });

  const current = live
    ? formatSession(live, live.weekNumber === 0 && campaignConfig.sampleSessionEnabled ? { isSample: true } : undefined)
    : null;
  const nextSession = next ? formatSession(next) : null;

  // If no real session exists and sample mode is enabled, auto-create a real sample session
  if (!current && !nextSession && campaignConfig.sampleSessionEnabled) {
    // Check for existing live sample session (weekNumber: 0)
    const existingSample = await prisma.weeklySession.findFirst({
      where: { weekNumber: 0, status: "live" },
      include: sessionInclude,
    });

    if (existingSample) {
      return NextResponse.json({
        current: formatSession(existingSample, { isSample: true }),
        next: null,
        lastEnded: lastEnded ? formatSession(lastEnded) : null,
      });
    }

    // Create a new sample session with real matchups
    const numMatchups = campaignConfig.matchupsPerSession;
    const needed = numMatchups * 2;

    const videos = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Video" WHERE status = 'ready' ORDER BY RANDOM() LIMIT $1`,
      needed,
    );

    if (videos.length >= 2) {
      // Delete any old ended sample sessions (weekNumber: 0) to free the unique constraint
      await prisma.weeklySession.deleteMany({ where: { weekNumber: 0, status: "ended" } });

      // Cycle through available videos to always fill all numMatchups rounds
      const sampleSession = await prisma.weeklySession.create({
        data: {
          weekNumber: 0,
          title: "Sample Session",
          scheduledAt: new Date(),
          status: "live",
          matchups: {
            create: Array.from({ length: numMatchups }, (_, i) => ({
              matchupNumber: i + 1,
              videoAId: videos[(i * 2) % videos.length].id,
              videoBId: videos[(i * 2 + 1) % videos.length].id,
              duration: campaignConfig.votingRoundDurationSeconds,
            })),
          },
        },
        include: sessionInclude,
      });

      return NextResponse.json({
        current: formatSession(sampleSession, { isSample: true }),
        next: null,
        lastEnded: lastEnded ? formatSession(lastEnded) : null,
      });
    }
  }

  return NextResponse.json({
    current,
    next: nextSession,
    lastEnded: lastEnded ? formatSession(lastEnded) : null,
  });
}

// POST /api/sessions — Admin creates a session
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const session = await prisma.weeklySession.create({
    data: {
      weekNumber: parsed.data.weekNumber,
      title: parsed.data.title,
      scheduledAt: new Date(parsed.data.scheduledAt),
      lateJoinCutoff: parsed.data.lateJoinCutoff
        ? new Date(parsed.data.lateJoinCutoff)
        : null,
    },
  });

  return NextResponse.json(session, { status: 201 });
}
