import type { WeeklySession } from "@/generated/prisma/client";

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
  roundDuration: number = 30
): number {
  if (session.status !== "live") return 0;
  const now = new Date();
  const start = new Date(session.scheduledAt);
  const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
  return Math.min(Math.floor(elapsed / roundDuration) + 1, 28);
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

export function calculateTier(correctVotes: number): {
  tier: "participation" | "base" | "gold";
} {
  if (correctVotes >= 21) {
    return { tier: "gold" };
  }
  if (correctVotes >= 10) {
    return { tier: "base" };
  }
  return { tier: "participation" };
}

export function generateCalendarICS(session: {
  title: string;
  scheduledAt: Date;
}): string {
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + 28 * 30 * 1000); // 28 rounds * 30s

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
    `SUMMARY:${session.title} - The Clearance`,
    "DESCRIPTION:Live voting session on The Clearance. Join to vote and earn rewards!",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
