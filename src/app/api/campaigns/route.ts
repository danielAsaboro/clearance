import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/campaigns — Public list of all campaigns (for season selector)
export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { cycleNumber: "desc" },
    select: {
      id: true,
      cycleNumber: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  return NextResponse.json({ campaigns });
}
