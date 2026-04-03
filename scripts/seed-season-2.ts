/**
 * Season 2 Database Isolation
 *
 * 1. Creates Season 1 campaign (completed) — backfills all existing sessions
 * 2. Creates CampaignEnrollments for Season 1 players
 * 3. Creates Season 2 campaign (active)
 * 4. Safety check — only one active campaign
 *
 * Usage:
 *   npm run seed:season2
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { prisma } from "../src/lib/db";
import { campaignConfig } from "../src/lib/campaign-config";

async function main() {
  console.log("🌱 Starting Season 2 seed...\n");

  // ── 1. Create Season 1 Campaign ──────────────────────────────────

  const existingSeason1 = await prisma.campaign.findUnique({
    where: { cycleNumber: 1 },
  });

  let season1Id: string;

  if (existingSeason1) {
    console.log("✓ Season 1 campaign already exists:", existingSeason1.id);
    season1Id = existingSeason1.id;
  } else {
    // Derive startDate from earliest session
    const earliest = await prisma.weeklySession.findFirst({
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
    });

    const startDate = earliest?.scheduledAt ?? new Date("2026-01-01");
    const endDate = new Date("2026-06-30");

    const season1 = await prisma.campaign.create({
      data: {
        cycleNumber: 1,
        title: "Season 1",
        startDate,
        endDate,
        status: "completed",
        durationWeeks: 12,
        sessionsPerCycle: 12,
        videosPerSession: campaignConfig.matchupsPerSession * 2,
        votingRoundDurationSecs: campaignConfig.votingRoundDurationSeconds,
        matchupsPerSession: campaignConfig.matchupsPerSession,
      },
    });

    console.log("✓ Created Season 1 campaign:", season1.id);
    season1Id = season1.id;
  }

  // ── 2. Backfill existing WeeklySessions ──────────────────────────

  const backfillResult = await prisma.weeklySession.updateMany({
    where: { campaignId: null },
    data: { campaignId: season1Id },
  });

  console.log(`✓ Backfilled ${backfillResult.count} sessions → Season 1`);

  // ── 3. Backfill CampaignEnrollments for Season 1 ─────────────────

  // Find all users who have at least one GameResult (they played in Season 1)
  const playerIds = await prisma.gameResult.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  let enrollmentCount = 0;
  for (const { userId } of playerIds) {
    const exists = await prisma.campaignEnrollment.findUnique({
      where: { userId_campaignId: { userId, campaignId: season1Id } },
    });
    if (!exists) {
      await prisma.campaignEnrollment.create({
        data: {
          userId,
          campaignId: season1Id,
          role: "player",
        },
      });
      enrollmentCount++;
    }
  }

  console.log(`✓ Created ${enrollmentCount} Season 1 enrollments (${playerIds.length} total players)`);

  // ── 4. Create Season 2 Campaign ──────────────────────────────────

  const existingSeason2 = await prisma.campaign.findUnique({
    where: { cycleNumber: 2 },
  });

  if (existingSeason2) {
    console.log("✓ Season 2 campaign already exists:", existingSeason2.id);
  } else {
    const season2 = await prisma.campaign.create({
      data: {
        cycleNumber: 2,
        title: "Season 2",
        startDate: new Date(),
        endDate: new Date("2026-06-30"),
        status: "active",
        durationWeeks: 12,
        sessionsPerCycle: 12,
        videosPerSession: campaignConfig.matchupsPerSession * 2,
        votingRoundDurationSecs: campaignConfig.votingRoundDurationSeconds,
        matchupsPerSession: campaignConfig.matchupsPerSession,
      },
    });

    console.log("✓ Created Season 2 campaign:", season2.id);
  }

  // ── 5. Safety check — only one active campaign ───────────────────

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active" },
    select: { id: true, title: true },
  });

  if (activeCampaigns.length !== 1) {
    console.error(
      `\n❌ SAFETY CHECK FAILED: Expected 1 active campaign, found ${activeCampaigns.length}:`,
      activeCampaigns
    );
    process.exit(1);
  }

  console.log(`\n✅ Safety check passed — 1 active campaign: "${activeCampaigns[0].title}"`);

  // Verify no orphaned sessions
  const orphanedSessions = await prisma.weeklySession.count({
    where: { campaignId: null },
  });

  if (orphanedSessions > 0) {
    console.error(`\n❌ ${orphanedSessions} sessions still have no campaignId!`);
    process.exit(1);
  }

  console.log("✅ All sessions have a campaignId");
  console.log("\n🎉 Season 2 seed complete!");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
