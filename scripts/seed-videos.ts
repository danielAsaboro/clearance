/**
 * Seed videos from /Users/cartel/development/projects/chuks/videos into the DB.
 *
 * What it does:
 *   1. Copies every .mp4 from the source folder → public/uploads/videos/
 *   2. Upserts a Video record per file (url = /uploads/videos/<name>)
 *   3. Upserts a system seed user (needed for uploadedById)
 *   4. Deletes any stale sample session (weekNumber: 0) so it regenerates
 *      fresh with the new videos next time /api/sessions is called
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-videos.ts
 *   — or —
 *   npm run seed:videos
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import path from "path";
import fs from "fs";
import { prisma } from "../src/lib/db";

// ── paths ──────────────────────────────────────────────────────────────────
const VIDEOS_SOURCE = path.resolve(__dirname, "../../videos"); // /chuks/videos/
const UPLOADS_DIR = path.resolve(__dirname, "../public/uploads/videos");
const PUBLIC_PATH_PREFIX = "/uploads/videos";

// ── helpers ────────────────────────────────────────────────────────────────

/** spaces / special chars → underscores, lowercase */
function safeName(filename: string): string {
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.\-]/g, "_");
}

/** "ridge_wallet.mp4" → "Ridge Wallet" */
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.mp4$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🎬  Spotr TV — video seed\n");

  // 1. Scan source folder
  if (!fs.existsSync(VIDEOS_SOURCE)) {
    console.error(`Source folder not found: ${VIDEOS_SOURCE}`);
    process.exit(1);
  }

  const allFiles = fs.readdirSync(VIDEOS_SOURCE);
  const mp4Files = allFiles.filter((f) => f.toLowerCase().endsWith(".mp4"));

  if (mp4Files.length === 0) {
    console.error(`No .mp4 files found in ${VIDEOS_SOURCE}`);
    process.exit(1);
  }

  console.log(`Found ${mp4Files.length} video(s) in source folder:`);
  mp4Files.forEach((f) => console.log(`  ${f}`));
  console.log();

  // 2. Ensure uploads directory exists
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // 3. Upsert seed system user (required for uploadedById FK)
  const seedUser = await prisma.user.upsert({
    where: { privyId: "seed_system_user_v1" },
    update: {},
    create: {
      privyId: "seed_system_user_v1",
      referralCode: "SEED01",
      role: "admin",
      displayName: "Seed System",
      consentAccepted: true,
    },
  });
  console.log(`👤  Seed user: ${seedUser.id}\n`);

  // 4. Copy + upsert each video
  let created = 0;
  let updated = 0;
  const seededIds: string[] = [];

  for (const originalFilename of mp4Files) {
    const safe = safeName(originalFilename);
    const srcPath = path.join(VIDEOS_SOURCE, originalFilename);
    const destPath = path.join(UPLOADS_DIR, safe);
    const publicUrl = `${PUBLIC_PATH_PREFIX}/${safe}`;
    const sourceKey = `local:videos/${safe}`;
    const title = titleFromFilename(safe);

    // Copy to public/uploads/videos/ if not already there
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  📂  Copied  ${safe}`);
    } else {
      console.log(`  ✓   Exists  ${safe}`);
    }

    // Upsert DB record
    const existing = await prisma.video.findUnique({ where: { sourceKey } });

    if (existing) {
      await prisma.video.update({
        where: { sourceKey },
        data: { url: publicUrl, title, status: "ready" },
      });
      updated++;
      seededIds.push(existing.id);
    } else {
      const v = await prisma.video.create({
        data: {
          url: publicUrl,
          title,
          status: "ready",
          sourceKey,
          originalFilename: originalFilename,
          sourceContentType: "video/mp4",
          uploadedById: seedUser.id,
        },
      });
      created++;
      seededIds.push(v.id);
    }
  }

  console.log(`\n📼  Videos: ${created} created, ${updated} updated\n`);

  // 5. Delete stale sample session so /api/sessions regenerates it cleanly
  //    Must delete child matchups first (FK is RESTRICT)
  const staleSessions = await prisma.weeklySession.findMany({
    where: { weekNumber: 0 },
    select: { id: true },
  });
  if (staleSessions.length > 0) {
    const ids = staleSessions.map((s) => s.id);
    await prisma.vote.deleteMany({ where: { matchup: { sessionId: { in: ids } } } });
    await prisma.matchup.deleteMany({ where: { sessionId: { in: ids } } });
    await prisma.gameResult.deleteMany({ where: { sessionId: { in: ids } } });
  }
  const deleted = await prisma.weeklySession.deleteMany({
    where: { weekNumber: 0 },
  });
  if (deleted.count > 0) {
    console.log(`🗑   Cleared ${deleted.count} stale sample session(s) — will regenerate on next request\n`);
  }

  // 6. Summary
  console.log("────────────────────────────────────────");
  console.log(`✅  Done! ${seededIds.length} videos ready in DB.`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Make sure SAMPLE_SESSION_ENABLED=true in .env.local");
  console.log("  2. Run: npm run dev");
  console.log("  3. Visit /arena — a live session auto-creates with random video pairings");
  console.log("────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
