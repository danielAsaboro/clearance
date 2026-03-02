import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/campaigns/active — Get the currently active campaign
export async function GET() {
  const campaign = await prisma.campaign.findFirst({
    where: { status: "active" },
    include: {
      _count: { select: { enrollments: true, sessions: true } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ campaign: null });
  }

  return NextResponse.json({ campaign });
}
