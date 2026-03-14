import type { WeeklySession } from "@/generated/prisma/client";

// Use NEXT_PUBLIC_ vars so this module works in both server and client bundles
const DEFAULT_MATCHUPS = parseInt(process.env.NEXT_PUBLIC_ROUNDS_PER_SESSION!);
const DEFAULT_ROUND_DURATION = parseInt(process.env.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS!);

export type SessionState = "future" | "today-waiting" | "live" | "ended";

export function getSessionState(session: WeeklySession): SessionState {
  const now = new Date();
  const scheduled = new Date(session.scheduledAt);

  if (session.status === "ended") return "ended";
  if (session.status === "live") return "live";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(
    scheduled.getFullYear(),
    scheduled.getMonth(),
    scheduled.getDate()
  );

  if (sessionDay.getTime() === today.getTime()) return "today-waiting";
  return "future";
}

export function getCurrentRound(
  session: WeeklySession,
  roundDuration: number = DEFAULT_ROUND_DURATION
): number {
  if (session.status !== "live") return 0;
  const now = new Date();
  const start = new Date(session.scheduledAt);
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
  return Math.min(
    Math.floor(elapsed / roundDuration) + 1,
    DEFAULT_MATCHUPS
  );
}

export function canLateJoin(session: WeeklySession): boolean {
  if (session.status !== "live") return false;
  const now = new Date();
  if (session.lateJoinCutoff) {
    return now < new Date(session.lateJoinCutoff);
  }
  // Default: allow late join for first hour
  const start = new Date(session.scheduledAt);
  const elapsed = (now.getTime() - start.getTime()) / 1000;
  return elapsed < 3600;
}

export function calculateTier(
  correctVotes: number,
  totalMatchups: number = DEFAULT_MATCHUPS
): {
  tier: "participation" | "base" | "gold";
} {
  const goldThreshold = Math.ceil(totalMatchups * 0.75);
  const baseThreshold = Math.ceil(totalMatchups * 0.36);

  if (correctVotes >= goldThreshold) {
    return { tier: "gold" };
  }
  if (correctVotes >= baseThreshold) {
    return { tier: "base" };
  }
  return { tier: "participation" };
}

/**
 * Calculate majority winners for all matchups in a session.
 * Counts video_a vs video_b votes per matchup.
 * video_a wins ties.
 */
export function calculateMajorityWinners(
  matchups: {
    id: string;
    videoAId: string;
    videoBId: string;
    votes: { decision: "video_a" | "video_b" }[];
  }[]
): Map<string, string> {
  const winnerMap = new Map<string, string>();

  for (const matchup of matchups) {
    let videoAVotes = 0;
    let videoBVotes = 0;

    for (const vote of matchup.votes) {
      if (vote.decision === "video_a") videoAVotes++;
      else videoBVotes++;
    }

    // video_a wins ties
    const winningVideoId =
      videoBVotes > videoAVotes ? matchup.videoBId : matchup.videoAId;
    winnerMap.set(matchup.id, winningVideoId);
  }

  return winnerMap;
}

export function generateCalendarICS(session: {
  title: string;
  scheduledAt: Date;
}): string {
  const start = new Date(session.scheduledAt);
  const end = new Date(
    start.getTime() +
      DEFAULT_MATCHUPS *
        DEFAULT_ROUND_DURATION *
        1000
  );

  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${session.title} - Spotr TV`,
    "DESCRIPTION:Live voting session on Spotr TV. Join to vote and earn rewards!",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
