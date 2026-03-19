/**
 * Seed videos to the DEV environment (R2 + dev Postgres).
 *
 * What it does:
 *   1. Reads .mp4 files from /chuks/videos/
 *   2. Uploads each to R2 under `videos/<safe_filename>`
 *   3. Upserts Video records in the dev DB with R2-backed URLs
 *   4. Upserts the seed system user (needed for uploadedById FK)
 *   5. Clears stale sample sessions (weekNumber: 0)
 *
 * Prerequisites:
 *   Create a `.env.dev` file in the project root with:
 *     DATABASE_URL=<dev postgres connection string>
 *     S3_ENDPOINT=<R2 endpoint>
 *     S3_ACCESS_KEY_ID=<R2 access key>
 *     S3_SECRET_ACCESS_KEY=<R2 secret key>
 *     S3_BUCKET=<R2 bucket name>
 *     S3_REGION=auto
 *
 * Usage:
 *   npm run seed:videos:dev
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

// Force R2 storage mode so URL generation is correct
process.env.STORAGE_MODE = "r2";

import path from "path";
import fs from "fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "../src/lib/db";
import { getStorageAssetPath } from "../src/lib/storage-url";

// ── R2 client ─────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.S3_BUCKET!;

async function uploadToR2(key: string, filePath: string, contentType: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: contentType,
    })
  );
}

// ── paths ─────────────────────────────────────────────────────────────────
const VIDEOS_SOURCE = path.resolve(__dirname, "../../videos"); // /chuks/videos/

// ── helpers ───────────────────────────────────────────────────────────────

/** spaces / special chars -> underscores, lowercase */
function safeName(filename: string): string {
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.\-]/g, "_");
}

/** Extract @handle from filename (without extension). Returns null if none found. */
function parseAccount(filename: string): string | null {
  const noExt = filename.replace(/\.mp4$/i, "");
  const tokens = noExt.replace(/[_\-]+/g, " ").trim().split(/\s+/);
  const atToken = tokens.find((t) => t.startsWith("@"));
  return atToken ? atToken.slice(1) : null;
}

/** Extract caption words (everything except the @handle token) */
function parseCaption(filename: string): string {
  const noExt = filename.replace(/\.mp4$/i, "");
  const tokens = noExt.replace(/[_\-]+/g, " ").trim().split(/\s+/);
  return tokens
    .filter((t) => !t.startsWith("@"))
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("Spotr TV — dev video seed (R2 + dev DB)\n");

  // Validate required env vars
  const required = [
    "DATABASE_URL",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_BUCKET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `Missing env vars in .env.dev: ${missing.join(", ")}\n` +
        "Create a .env.dev file with these values. See script header for details."
    );
    process.exit(1);
  }

  // 1. Scan source folder
  if (!fs.existsSync(VIDEOS_SOURCE)) {
    console.error(`Source folder not found: ${VIDEOS_SOURCE}`);
    process.exit(1);
  }

  const mp4Files = fs
    .readdirSync(VIDEOS_SOURCE)
    .filter((f) => f.toLowerCase().endsWith(".mp4"));

  if (mp4Files.length === 0) {
    console.error(`No .mp4 files found in ${VIDEOS_SOURCE}`);
    process.exit(1);
  }

  console.log(`Found ${mp4Files.length} video(s) in source folder\n`);

  // 2. Upsert seed system user
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
  console.log(`Seed user (fallback): ${seedUser.id}\n`);

  async function upsertAccountUser(handle: string): Promise<string> {
    const user = await prisma.user.upsert({
      where: { privyId: `seed_@${handle}` },
      update: { displayName: `@${handle}` },
      create: {
        privyId: `seed_@${handle}`,
        referralCode: `SEED_${handle.toUpperCase().slice(0, 8)}`,
        role: "player",
        displayName: `@${handle}`,
        consentAccepted: true,
      },
    });
    return user.id;
  }

  // 3. Upload to R2 + upsert DB records
  let created = 0;
  let updated = 0;
  let uploaded = 0;
  const seededIds: string[] = [];

  for (const originalFilename of mp4Files) {
    const safe = safeName(originalFilename);
    const srcPath = path.join(VIDEOS_SOURCE, originalFilename);
    const r2Key = `videos/${safe}`;
    const url = getStorageAssetPath(r2Key);
    const sourceKey = r2Key;
    const account = parseAccount(originalFilename);
    const caption = parseCaption(originalFilename);
    const uploadedById = account ? await upsertAccountUser(account) : seedUser.id;

    // Upload to R2 (PUT is idempotent — overwrites if exists)
    const fileSize = fs.statSync(srcPath).size;
    const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
    console.log(`  Uploading ${safe} (${sizeMB} MB)...`);

    await uploadToR2(r2Key, srcPath, "video/mp4");
    uploaded++;

    // Upsert DB record
    const existing = await prisma.video.findUnique({ where: { sourceKey } });

    if (existing) {
      await prisma.video.update({
        where: { sourceKey },
        data: { url, title: caption, status: "ready" },
      });
      updated++;
      seededIds.push(existing.id);
    } else {
      const v = await prisma.video.create({
        data: {
          url,
          title: caption,
          status: "ready",
          sourceKey,
          originalFilename,
          sourceContentType: "video/mp4",
          sourceBytes: fileSize,
          uploadedById,
        },
      });
      created++;
      seededIds.push(v.id);
    }
  }

  console.log(
    `\nR2 uploads: ${uploaded} | DB records: ${created} created, ${updated} updated\n`
  );

  // 4. Clear stale sample sessions
  const staleSessions = await prisma.weeklySession.findMany({
    where: { weekNumber: 0 },
    select: { id: true },
  });
  if (staleSessions.length > 0) {
    const ids = staleSessions.map((s) => s.id);
    await prisma.vote.deleteMany({
      where: { matchup: { sessionId: { in: ids } } },
    });
    await prisma.matchup.deleteMany({ where: { sessionId: { in: ids } } });
    await prisma.gameResult.deleteMany({ where: { sessionId: { in: ids } } });
  }
  const deleted = await prisma.weeklySession.deleteMany({
    where: { weekNumber: 0 },
  });
  if (deleted.count > 0) {
    console.log(
      `Cleared ${deleted.count} stale sample session(s) — will regenerate on next request\n`
    );
  }

  // 5. Summary
  console.log("────────────────────────────────────────");
  console.log(`Done! ${seededIds.length} videos seeded to dev environment.`);
  console.log(`  R2 bucket: ${bucket}`);
  console.log(`  DB: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ":***@")}`);
  console.log("────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
