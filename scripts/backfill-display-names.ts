import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import * as path from "path";
import * as dotenv from "dotenv";

// Load env directly, bypass app's env validation
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const ADJECTIVES = [
  "Bold", "Swift", "Keen", "Cool", "Chill", "Epic", "Wild", "Neon",
  "Sonic", "Vivid", "Lucky", "Brave", "Slick", "Rapid", "Stark",
  "Fierce", "Sharp", "Bright", "Prime", "Blaze",
];

const NOUNS = [
  "Tiger", "Falcon", "Panther", "Fox", "Eagle", "Lion", "Wolf",
  "Hawk", "Cobra", "Phoenix", "Viper", "Raven", "Storm", "Blitz",
  "Spark", "Drift", "Pulse", "Flash", "Nova", "Frost",
];

function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const digits = Math.floor(Math.random() * 100).toString().padStart(2, "0");
  return `${adj}${noun}${digits}`;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const usersWithoutName = await prisma.user.findMany({
    where: { displayName: null },
    select: { id: true, email: true, isGuest: true },
  });

  console.log(`\nFound ${usersWithoutName.length} users with no displayName.\n`);

  if (usersWithoutName.length === 0) {
    console.log("Nothing to backfill!");
    return;
  }

  const usedNames = new Set<string>();
  let updated = 0;

  for (const user of usersWithoutName) {
    // Generate a unique name
    let name: string;
    do {
      name = generateName();
    } while (usedNames.has(name));
    usedNames.add(name);

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName: name },
    });

    updated++;
    const label = user.email ?? (user.isGuest ? "guest" : "no-email");
    console.log(`  [${updated}/${usersWithoutName.length}] ${user.id} (${label}) → ${name}`);
  }

  console.log(`\nDone! Updated ${updated} users.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
