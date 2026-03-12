import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-helpers";
import { createSessionSchema } from "@/lib/validators";
import { campaignConfig } from "@/lib/campaign-config";

const sessionInclude = {
  _count: { select: { gameResults: true, matchups: true } },
  campaign: { select: { votingRoundDurationSecs: true } },
} as const;

function formatSession(session: {
  campaign?: { votingRoundDurationSecs: number } | null;
  _count: { gameResults: number; matchups: number };
  [key: string]: unknown;
}) {
  const { campaign, _count, ...rest } = session;
  return {
    ...rest,
    _count,
    totalMatchups: _count.matchups,
    roundDurationSeconds: campaign?.votingRoundDurationSecs ?? campaignConfig.votingRoundDurationSeconds,
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

  return NextResponse.json({
    current: live ? formatSession(live) : null,
    next: next ? formatSession(next) : null,
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
