/**
 * Seed a playable demo session using local sample videos.
 *
 * Usage:  npx tsx scripts/seed-demo.ts
 *
 * - No Solana validator needed — DB only
 * - Idempotent: deletes previous weekNumber=99 data before re-seeding
 * - Creates 9 videos, 1 live session, 4 matchups (2 min of gameplay)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const WEEK = 99;
const ROUND_DURATION = parseInt(process.env.VOTING_ROUND_DURATION_IN_SECONDS ?? "30");

const VIDEO_FILES = [
  // Original 9
  "Angry_Trader_Loses_Trade_Again.mp4",
  "Satirical_Luxury_Anti_Theft_Bag_Ad.mp4",
  "The_Crowd_s_Honest_Product_Review.mp4",
  "humane pin.mp4",
  "let love lead.mp4",
  "rabbit r1.mp4",
  "ridge wallet.mp4",
  "soapy.mp4",
  "yeezys.mp4",
  // Fashion & lifestyle
  "fashion_model_black_dress.mp4",
  "fashion_model_mirrors.mp4",
  "stylish_woman_sports_car.mp4",
  "woman_camaro_pose.mp4",
  "urban_fashion_concept.mp4",
  "colorful_dancer.mp4",
  "mall_shopping.mp4",
  // Technology
  "futuristic_devices.mp4",
  "vr_glasses_woman.mp4",
  "circuit_board_processor.mp4",
  "screen_reflection_glasses.mp4",
  "data_center_hallway.mp4",
  "digital_world_map.mp4",
  // Food & urban
  "vegetables_slow_motion.mp4",
  "pepperoni_pizza_closeup.mp4",
  "yogurt_bowl_prep.mp4",
  "tokyo_subway.mp4",
  "tokyo_night_street.mp4",
  "city_night_traffic.mp4",
  "wagon_in_motion.mp4",
  // Sport
  "boxer_dark_ring.mp4",
  "soccer_one_on_one.mp4",
  "basketball_training.mp4",
  "desert_motorcycle.mp4",
  "kickbox_fighter_ring.mp4",
  // Nature
  "mountain_highway.mp4",
  "waterfall_forest.mp4",
  "beach_sunset_skyline.mp4",
  "rocky_coast_waves.mp4",
  "countryside_meadow.mp4",
];

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.mp4$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  console.log("\n  Seed Demo — Spotr TV\n");

  // ── Cleanup previous demo data ──
  const existing = await prisma.weeklySession.findUnique({
    where: { weekNumber: WEEK },
    include: { matchups: { include: { votes: true } }, gameResults: true },
  });

  if (existing) {
    // Delete in FK order: votes → gameResults → matchups → session
    const matchupIds = existing.matchups.map((m) => m.id);
    if (matchupIds.length > 0) {
      await prisma.vote.deleteMany({ where: { matchupId: { in: matchupIds } } });
    }
    await prisma.gameResult.deleteMany({ where: { sessionId: existing.id } });
    await prisma.matchup.deleteMany({ where: { sessionId: existing.id } });
    await prisma.weeklySession.delete({ where: { id: existing.id } });
    console.log("  Cleaned up previous demo session (week 99).");
  }

  // Delete previous demo videos (uploaded by demo-seed user)
  const seedUser = await prisma.user.findUnique({
    where: { privyId: "demo-seed-user" },
  });
  if (seedUser) {
    await prisma.video.deleteMany({ where: { uploadedById: seedUser.id } });
  }

  // ── Upsert a dummy user to own the videos ──
  const user = await prisma.user.upsert({
    where: { privyId: "demo-seed-user" },
    update: {},
    create: {
      privyId: "demo-seed-user",
      displayName: "Demo Uploader",
      role: "admin",
      referralCode: "DEMOSEED99",
      consentAccepted: true,
    },
  });
  console.log(`  Seed user: ${user.id}`);

  // ── Create 9 videos ──
  const videos = [];
  for (const file of VIDEO_FILES) {
    const video = await prisma.video.create({
      data: {
        title: titleFromFilename(file),
        url: `/sample_videos/${file}`,
        uploadedById: user.id,
      },
    });
    videos.push(video);
  }
  console.log(`  Created ${videos.length} videos.`);

  // ── Create live session ──
  const session = await prisma.weeklySession.create({
    data: {
      weekNumber: WEEK,
      title: "Demo Session",
      scheduledAt: new Date(),
      status: "live",
    },
  });
  console.log(`  Session: ${session.id} (week ${WEEK}, status=live)`);

  // ── Create matchups (pair videos sequentially, drop last if odd) ──
  const numMatchups = Math.floor(videos.length / 2);
  for (let i = 0; i < numMatchups; i++) {
    await prisma.matchup.create({
      data: {
        sessionId: session.id,
        matchupNumber: i + 1,
        videoAId: videos[i * 2].id,
        videoBId: videos[i * 2 + 1].id,
        duration: ROUND_DURATION,
      },
    });
  }
  const mins = ((numMatchups * ROUND_DURATION) / 60).toFixed(1);
  console.log(`  Created ${numMatchups} matchups (${ROUND_DURATION}s each = ${mins} min total).`);

  // ── Done ──
  console.log("\n  ════════════════════════════════════════");
  console.log("  Demo seeded!");
  console.log("  ════════════════════════════════════════\n");
  console.log(`  Session ID: ${session.id}`);
  console.log("  Next steps:");
  console.log("    1. npm run dev");
  console.log("    2. Open http://localhost:3000/arena");
  console.log('    3. Should see "LIVE" badge → Join → Play\n');
}

main()
  .catch((err) => {
    console.error("\n  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
