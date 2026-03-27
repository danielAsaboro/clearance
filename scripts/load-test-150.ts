/**
 * Load Test: 150 Concurrent Users on a Single Session
 *
 * Simulates the full user journey:
 *   0. Clean up leftover data from previous runs
 *   1. Create 150 guest accounts (batched)
 *   2. Fetch the active session
 *   3. All 150 join the session concurrently
 *   4. Fetch matchups
 *   5. All 150 vote on each matchup concurrently (simulating live rounds)
 *   6. Clean up guest users created by this run
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/load-test-150.ts [BASE_URL] [NUM_USERS]
 *
 * Defaults: http://localhost:3000, 150 users
 */

import { prisma } from "../src/lib/db";

const BASE_URL = process.argv[2] || "http://localhost:3000";
const NUM_USERS = parseInt(process.argv[3] || "150", 10);
const CONCURRENCY_BATCH = 50; // how many requests to fire at once within a phase

// ── Helpers ────────────────────────────────────────────────────────────────

interface GuestUser {
  guestToken: string;
  displayName: string;
  userId: string;
}

interface Matchup {
  id: string;
  matchupNumber: number;
}

interface TimedResult<T> {
  data: T | null;
  ms: number;
  error?: string;
}

const stats = {
  guestCreate: { ok: 0, fail: 0, times: [] as number[] },
  join: { ok: 0, fail: 0, times: [] as number[] },
  matchups: { ok: 0, fail: 0, times: [] as number[] },
  vote: { ok: 0, fail: 0, times: [] as number[] },
  sse: { ok: 0, fail: 0, times: [] as number[] },
};

async function timedFetch<T>(
  url: string,
  opts: RequestInit = {}
): Promise<TimedResult<T>> {
  const start = performance.now();
  try {
    const res = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(30_000),
    });
    const ms = Math.round(performance.now() - start);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, ms, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as T;
    return { data, ms };
  } catch (err: any) {
    const ms = Math.round(performance.now() - start);
    return { data: null, ms, error: err.message };
  }
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printStats(label: string, s: { ok: number; fail: number; times: number[] }) {
  const total = s.ok + s.fail;
  if (total === 0) return;
  const avg = Math.round(s.times.reduce((a, b) => a + b, 0) / s.times.length);
  console.log(
    `  ${label.padEnd(14)} | ` +
      `${String(total).padStart(5)} reqs | ` +
      `${s.ok} ok, ${s.fail} fail | ` +
      `avg ${avg}ms | ` +
      `p50 ${percentile(s.times, 50)}ms | ` +
      `p95 ${percentile(s.times, 95)}ms | ` +
      `p99 ${percentile(s.times, 99)}ms | ` +
      `max ${percentile(s.times, 100)}ms`
  );
}

/** Run tasks in batches to avoid overwhelming OS sockets */
async function batchRun<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(batch.map(fn));
  }
}

// ── Phase 1: Create Guest Users ────────────────────────────────────────────

async function createGuests(): Promise<GuestUser[]> {
  console.log(`\n[Phase 1] Creating ${NUM_USERS} guest users...`);
  const users: GuestUser[] = [];

  await batchRun(
    Array.from({ length: NUM_USERS }),
    CONCURRENCY_BATCH,
    async () => {
      const result = await timedFetch<GuestUser>(`${BASE_URL}/api/auth/guest`, {
        method: "POST",
      });
      stats.guestCreate.times.push(result.ms);
      if (result.data) {
        stats.guestCreate.ok++;
        users.push(result.data);
      } else {
        stats.guestCreate.fail++;
        if (stats.guestCreate.fail <= 3) console.error(`    Guest create failed: ${result.error}`);
      }
    }
  );

  console.log(`  Created ${users.length}/${NUM_USERS} guests`);
  return users;
}

// ── Phase 2: Get Session ────────────────────────────────────────────────────

async function getSession(): Promise<{ id: string; status: string } | null> {
  console.log(`\n[Phase 2] Fetching active session...`);
  const result = await timedFetch<{ current: any }>(`${BASE_URL}/api/sessions`);
  if (!result.data?.current) {
    console.error("  No active session found! Make sure a live session exists.");
    console.error("  The app auto-creates a sample session if videos exist in the DB.");
    return null;
  }
  const session = result.data.current;
  console.log(`  Session: ${session.id} (status: ${session.status}, matchups: ${session.totalMatchups})`);
  return session;
}

// ── Phase 3: Join Session ───────────────────────────────────────────────────

async function joinSession(users: GuestUser[], sessionId: string): Promise<void> {
  console.log(`\n[Phase 3] ${users.length} users joining session concurrently...`);
  const start = performance.now();

  await batchRun(users, CONCURRENCY_BATCH, async (user) => {
    const result = await timedFetch(`${BASE_URL}/api/sessions/${sessionId}/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Guest-Token": user.guestToken,
      },
    });
    stats.join.times.push(result.ms);
    if (result.data) {
      stats.join.ok++;
    } else {
      stats.join.fail++;
      if (stats.join.fail <= 3) console.error(`    Join failed: ${result.error}`);
    }
  });

  const totalMs = Math.round(performance.now() - start);
  console.log(`  All joins completed in ${totalMs}ms`);
}

// ── Phase 4: Fetch Matchups ─────────────────────────────────────────────────

async function fetchMatchups(sessionId: string): Promise<Matchup[]> {
  console.log(`\n[Phase 4] Fetching matchups...`);
  const result = await timedFetch<{ matchups: Matchup[] }>(
    `${BASE_URL}/api/sessions/${sessionId}/rounds`
  );
  if (!result.data) {
    console.error(`  Failed to fetch matchups: ${result.error}`);
    return [];
  }
  console.log(`  Got ${result.data.matchups.length} matchups`);
  return result.data.matchups;
}

// ── Phase 5: Polling Connections ─────────────────────────────────────────────

async function testPollingConnections(
  users: GuestUser[],
  sessionId: string
): Promise<void> {
  console.log(`\n[Phase 5] ${users.length} users polling round state concurrently...`);
  const start = performance.now();

  await batchRun(users, CONCURRENCY_BATCH, async () => {
    const result = await timedFetch(
      `${BASE_URL}/api/sessions/${sessionId}/stream`
    );
    stats.sse.times.push(result.ms);
    if (result.data) {
      stats.sse.ok++;
    } else {
      stats.sse.fail++;
    }
  });

  const totalMs = Math.round(performance.now() - start);
  console.log(`  Polling test completed in ${totalMs}ms`);
}

// ── Phase 6: Vote on All Matchups ───────────────────────────────────────────

async function voteOnMatchups(
  users: GuestUser[],
  matchups: Matchup[]
): Promise<void> {
  console.log(`\n[Phase 6] ${users.length} users voting on ${matchups.length} matchups...`);
  console.log(`  Total votes to cast: ${users.length * matchups.length}`);
  const start = performance.now();

  for (const matchup of matchups) {
    const roundStart = performance.now();

    await batchRun(users, CONCURRENCY_BATCH, async (user) => {
      const decision = Math.random() > 0.5 ? "video_a" : "video_b";
      const timeToVoteMs = Math.floor(Math.random() * 15000) + 1000;

      const result = await timedFetch(`${BASE_URL}/api/votes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Token": user.guestToken,
        },
        body: JSON.stringify({
          matchupId: matchup.id,
          decision,
          timeToVoteMs,
        }),
      });
      stats.vote.times.push(result.ms);
      if (result.data) {
        stats.vote.ok++;
      } else {
        stats.vote.fail++;
        if (stats.vote.fail <= 5)
          console.error(`    Vote failed (matchup ${matchup.matchupNumber}): ${result.error}`);
      }
    });

    const roundMs = Math.round(performance.now() - roundStart);
    process.stdout.write(
      `  Round ${String(matchup.matchupNumber).padStart(2)}: ${users.length} votes in ${roundMs}ms` +
        ` (${stats.vote.fail} cumulative failures)\r`
    );
  }

  const totalMs = Math.round(performance.now() - start);
  console.log(
    `\n  All voting completed in ${(totalMs / 1000).toFixed(1)}s ` +
      `(${stats.vote.ok} ok, ${stats.vote.fail} fail)`
  );
}

// ── Phase 7: Concurrent Results Fetch ───────────────────────────────────────

async function fetchResultsConcurrently(
  users: GuestUser[],
  sessionId: string
): Promise<void> {
  console.log(`\n[Phase 7] ${users.length} users fetching results concurrently...`);
  const resultStats = { ok: 0, fail: 0, times: [] as number[] };
  const start = performance.now();

  await batchRun(users, CONCURRENCY_BATCH, async (user) => {
    const result = await timedFetch(
      `${BASE_URL}/api/sessions/${sessionId}/results`,
      {
        headers: { "X-Guest-Token": user.guestToken },
      }
    );
    resultStats.times.push(result.ms);
    if (result.data) resultStats.ok++;
    else resultStats.fail++;
  });

  const totalMs = Math.round(performance.now() - start);
  console.log(`  Results fetch completed in ${totalMs}ms`);
  printStats("Results", resultStats);
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanupPreviousRuns(): Promise<void> {
  console.log(`\n[Phase 0] Cleaning up previous load test data...`);

  // Delete votes, game results, and discount codes for guest users (FK-safe order)
  const guestIds = await prisma.user
    .findMany({ where: { isGuest: true }, select: { id: true } })
    .then((users) => users.map((u) => u.id));

  if (guestIds.length === 0) {
    console.log("  No previous guest users found");
    return;
  }

  const votes = await prisma.vote.deleteMany({ where: { userId: { in: guestIds } } });
  const gameResults = await prisma.gameResult.deleteMany({ where: { userId: { in: guestIds } } });
  const discountCodes = await prisma.discountCode.deleteMany({ where: { userId: { in: guestIds } } });
  const analytics = await prisma.analyticsEvent.deleteMany({ where: { userId: { in: guestIds } } });
  const guests = await prisma.user.deleteMany({ where: { isGuest: true } });

  console.log(
    `  Deleted: ${guests.count} guests, ${votes.count} votes, ` +
    `${gameResults.count} game results, ${discountCodes.count} discount codes, ` +
    `${analytics.count} analytics events`
  );
}

async function cleanupThisRun(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  console.log(`\n[Cleanup] Removing ${userIds.length} guest users from this run...`);

  await prisma.vote.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.gameResult.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.discountCode.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.analyticsEvent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log("  Done");
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(70));
  console.log(`  SPOTR TV LOAD TEST — ${NUM_USERS} concurrent users`);
  console.log(`  Target: ${BASE_URL}`);
  console.log("=".repeat(70));

  const overallStart = performance.now();

  // Phase 0: Clean up previous runs
  await cleanupPreviousRuns();

  // Phase 1: Create guests
  const users = await createGuests();
  if (users.length === 0) {
    console.error("\nFailed to create any guest users. Is the server running?");
    process.exit(1);
  }

  // Phase 2: Get session
  const session = await getSession();
  if (!session) process.exit(1);

  // Phase 3: Join
  await joinSession(users, session.id);

  // Phase 4: Matchups
  const matchups = await fetchMatchups(session.id);
  if (matchups.length === 0) {
    console.error("\nNo matchups found. Cannot proceed with voting.");
    process.exit(1);
  }

  // Phase 5: Polling
  await testPollingConnections(users, session.id);

  // Phase 6: Vote
  await voteOnMatchups(users, matchups);

  // Phase 7: Results
  await fetchResultsConcurrently(users, session.id);

  // ── Summary ───────────────────────────────────────────────────────────────

  const totalMs = Math.round(performance.now() - overallStart);
  console.log("\n" + "=".repeat(70));
  console.log("  RESULTS SUMMARY");
  console.log("=".repeat(70));
  console.log(`  Total time: ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Matchups: ${matchups.length}`);
  console.log(`  Total votes attempted: ${stats.vote.ok + stats.vote.fail}`);
  console.log("");

  printStats("Guest Create", stats.guestCreate);
  printStats("Join Session", stats.join);
  printStats("Poll State", stats.sse);
  printStats("Vote", stats.vote);

  console.log("");

  const totalFails =
    stats.guestCreate.fail + stats.join.fail + stats.vote.fail + stats.sse.fail;
  if (totalFails === 0) {
    console.log("  ✓ ALL REQUESTS SUCCEEDED — system handled 150 concurrent users!");
  } else {
    console.log(`  ✗ ${totalFails} total failures detected`);
  }
  console.log("=".repeat(70));

  // Clean up guest users created by this run
  await cleanupThisRun(users.map((u) => u.userId));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Load test crashed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
