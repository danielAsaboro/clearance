import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { campaignConfig } from "@/lib/campaign-config";
import { z } from "zod";

const createCampaignSchema = z.object({
  cycleNumber: z.number().int().positive(),
  title: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  durationWeeks: z.number().int().positive().optional(),
  sessionsPerCycle: z.number().int().positive().optional(),
  videosPerSession: z.number().int().positive().optional(),
  votingRoundDurationSecs: z.number().int().positive().optional(),
  matchupsPerSession: z.number().int().positive().optional(),
});

// POST /api/admin/campaigns — Create a new campaign
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 401 });
  }

  const body = await req.json();
  const parsed = createCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      cycleNumber: data.cycleNumber,
      title: data.title,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      durationWeeks: data.durationWeeks ?? campaignConfig.cycleDurationWeeks,
      sessionsPerCycle: data.sessionsPerCycle ?? campaignConfig.liveSessionsPerCycle,
      videosPerSession: data.videosPerSession ?? campaignConfig.matchupsPerSession * 2,
      votingRoundDurationSecs: data.votingRoundDurationSecs ?? campaignConfig.votingRoundDurationSeconds,
      matchupsPerSession: data.matchupsPerSession ?? campaignConfig.matchupsPerSession,
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}

// GET /api/admin/campaigns — List all campaigns
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg === "Forbidden" ? 403 : 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    orderBy: { cycleNumber: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });

  return NextResponse.json(campaigns);
}
