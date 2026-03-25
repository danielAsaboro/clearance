/**
 * Clear all session/video data from DB + R2, then reseed videos in one shot.
 *
 * Clears (FK-safe order):
 *   Vote → Matchup → GameResult → WeeklySession → Video
 *   + ALL objects in the R2 bucket
 *
 * Keeps:
 *   User, Referral, VideoCategory, Campaign, CampaignEnrollment
 *
 * Usage:
 *   npm run clear:reseed
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

process.env.STORAGE_MODE = "r2";

import path from "path";
import fs from "fs";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { prisma } from "../src/lib/db";
import { getStorageAssetPath } from "../src/lib/storage-url";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});
const bucket = process.env.S3_BUCKET!;

const VIDEOS_SOURCE = path.resolve(__dirname, "../../videos");

function safeName(filename: string): string {
  return filename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.\-]/g, "_");
}

function parseAccount(filename: string): string | null {
  const noExt = filename.replace(/\.mp4$/i, "");
  const tokens = noExt.replace(/[_\-]+/g, " ").trim().split(/\s+/);
  const atToken = tokens.find((t) => t.startsWith("@"));
  return atToken ? atToken.slice(1) : null;
}

function parseCaption(filename: string): string {
  const noExt = filename.replace(/\.mp4$/i, "");
  const tokens = noExt.replace(/[_\-]+/g, " ").trim().split(/\s+/);
  return tokens
    .filter((t) => !t.startsWith("@"))
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function clearDB() {
  console.log("Clearing DB (FK-safe order)…");
  const votes = await prisma.vote.deleteMany();
  console.log(`  Vote: ${votes.count} deleted`);
  const matchups = await prisma.matchup.deleteMany();
  console.log(`  Matchup: ${matchups.count} deleted`);
  const gameResults = await prisma.gameResult.deleteMany();
  console.log(`  GameResult: ${gameResults.count} deleted`);
  const discountCodes = await prisma.discountCode.deleteMany();
  console.log(`  DiscountCode: ${discountCodes.count} deleted`);
  const sessions = await prisma.weeklySession.deleteMany();
  console.log(`  WeeklySession: ${sessions.count} deleted`);
  const videos = await prisma.video.deleteMany();
  console.log(`  Video: ${videos.count} deleted`);
  console.log("DB clear done.\n");
}

async function clearR2() {
  console.log("Clearing R2 bucket…");
  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    const listResp = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );
    const objects = listResp.Contents ?? [];
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: objects.map((o) => ({ Key: o.Key! })),
            Quiet: true,
          },
        })
      );
      totalDeleted += objects.length;
      console.log(`  Deleted batch of ${objects.length} objects…`);
    }
    continuationToken = listResp.IsTruncated
      ? listResp.NextContinuationToken
      : undefined;
  } while (continuationToken);

  console.log(`R2: ${totalDeleted} objects deleted.\n`);
}

async function seedVideos() {
  console.log("Seeding videos…\n");

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

  console.log(`Found ${mp4Files.length} video(s)\n`);

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

  let created = 0;

  for (const originalFilename of mp4Files) {
    const safe = safeName(originalFilename);
    const srcPath = path.join(VIDEOS_SOURCE, originalFilename);
    const r2Key = `videos/${safe}`;
    const url = getStorageAssetPath(r2Key);
    const account = parseAccount(originalFilename);
    const caption = parseCaption(originalFilename);
    const uploadedById = account
      ? await upsertAccountUser(account)
      : seedUser.id;
    const fileSize = fs.statSync(srcPath).size;
    const sizeMB = (fileSize / 1024 / 1024).toFixed(1);

    console.log(`  Uploading ${safe} (${sizeMB} MB)…`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: r2Key,
        Body: fs.createReadStream(srcPath),
        ContentType: "video/mp4",
      })
    );

    await prisma.video.create({
      data: {
        url,
        title: caption,
        status: "ready",
        sourceKey: r2Key,
        originalFilename,
        sourceContentType: "video/mp4",
        sourceBytes: fileSize,
        uploadedById,
      },
    });
    created++;
  }

  console.log(`\n${created} videos uploaded and seeded to DB.\n`);
}

async function main() {
  const required = [
    "DATABASE_URL",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_BUCKET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  console.log("=== Spotr TV — Clear & Reseed ===\n");

  await clearDB();
  await clearR2();
  await seedVideos();

  console.log("────────────────────────────────────────");
  console.log("All done. Videos are live in R2 + DB.");
  console.log("────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
