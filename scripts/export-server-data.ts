import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env directly, bypass app's env validation
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const OUT_DIR = path.join(__dirname, "..", "exports");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

function toCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    console.log(`  ${filename}: 0 rows (skipped)`);
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => toCsvValue(row[h])).join(",")),
  ];
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  console.log(`  ${filename}: ${rows.length} rows`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\nExporting server data to ${OUT_DIR}\n`);

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("users.csv", users);

  const videos = await prisma.video.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("videos.csv", videos);

  const categories = await prisma.videoCategory.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("video_categories.csv", categories);

  const sessions = await prisma.weeklySession.findMany({ orderBy: { scheduledAt: "asc" } });
  writeCsv("weekly_sessions.csv", sessions);

  const matchups = await prisma.matchup.findMany({ orderBy: { id: "asc" } });
  writeCsv("matchups.csv", matchups);

  const votes = await prisma.vote.findMany({ orderBy: { submittedAt: "asc" } });
  writeCsv("votes.csv", votes);

  const gameResults = await prisma.gameResult.findMany({ orderBy: { joinedAt: "asc" } });
  writeCsv("game_results.csv", gameResults);

  const discountCodes = await prisma.discountCode.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("discount_codes.csv", discountCodes);

  const referrals = await prisma.referral.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("referrals.csv", referrals);

  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("campaigns.csv", campaigns);

  const enrollments = await prisma.campaignEnrollment.findMany({ orderBy: { enrolledAt: "asc" } });
  writeCsv("campaign_enrollments.csv", enrollments);

  const videoStats = await prisma.videoStats.findMany({ orderBy: { id: "asc" } });
  writeCsv("video_stats.csv", videoStats);

  const analyticsEvents = await prisma.analyticsEvent.findMany({ orderBy: { createdAt: "asc" } });
  writeCsv("analytics_events.csv", analyticsEvents);

  console.log("\nDone! All tables exported.");
}

main()
  .catch((e) => {
    console.error("Export failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
