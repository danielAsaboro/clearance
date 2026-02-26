import {
  getSessionState,
  getCurrentRound,
  canLateJoin,
  calculateTier,
  generateCalendarICS,
} from "@/lib/session-engine";

// Type helper for minimal session mock
type MockSession = {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: Date;
  status: string;
  lateJoinCutoff: Date | null;
  collectionAddress: string | null;
  vaultAddress: string | null;
};

function makeSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    id: "test-session",
    weekNumber: 1,
    title: "Test Session",
    scheduledAt: new Date(),
    status: "scheduled",
    lateJoinCutoff: null,
    collectionAddress: null,
    vaultAddress: null,
    ...overrides,
  };
}

describe("Session Engine", () => {
  describe("getSessionState", () => {
    it('returns "ended" for ended sessions', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "ended" }) as any;
      expect(getSessionState(session)).toBe("ended");
    });

    it('returns "live" for live sessions', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "live" }) as any;
      expect(getSessionState(session)).toBe("live");
    });

    it('returns "today-waiting" for scheduled today', () => {
      const now = new Date();
      const later = new Date(now);
      later.setHours(now.getHours() + 2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ scheduledAt: later }) as any;
      expect(getSessionState(session)).toBe("today-waiting");
    });

    it('returns "future" for future date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ scheduledAt: tomorrow }) as any;
      expect(getSessionState(session)).toBe("future");
    });
  });

  describe("getCurrentRound", () => {
    it("returns 0 for non-live sessions", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "scheduled" }) as any;
      expect(getCurrentRound(session)).toBe(0);
    });

    it("returns correct round based on elapsed time", () => {
      const start = new Date(Date.now() - 60 * 1000); // 60 seconds ago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "live", scheduledAt: start }) as any;
      // 60 seconds / 30 second rounds = round 3
      expect(getCurrentRound(session)).toBe(3);
    });

    it("caps at 28 rounds", () => {
      const start = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "live", scheduledAt: start }) as any;
      expect(getCurrentRound(session)).toBe(28);
    });
  });

  describe("canLateJoin", () => {
    it("returns false for non-live sessions", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "scheduled" }) as any;
      expect(canLateJoin(session)).toBe(false);
    });

    it("returns true within default cutoff (1 hour)", () => {
      const start = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "live", scheduledAt: start }) as any;
      expect(canLateJoin(session)).toBe(true);
    });

    it("returns false after default cutoff", () => {
      const start = new Date(Date.now() - 2 * 3600 * 1000); // 2 hours ago
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = makeSession({ status: "live", scheduledAt: start }) as any;
      expect(canLateJoin(session)).toBe(false);
    });

    it("respects custom lateJoinCutoff", () => {
      const cutoff = new Date(Date.now() + 60 * 1000); // in 1 minute
      const session = makeSession({
        status: "live",
        scheduledAt: new Date(Date.now() - 2 * 3600 * 1000),
        lateJoinCutoff: cutoff,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;
      expect(canLateJoin(session)).toBe(true);
    });
  });

  describe("calculateTier", () => {
    it("returns gold for 21+ correct votes", () => {
      expect(calculateTier(21)).toEqual({ tier: "gold", reward: 3.5 });
      expect(calculateTier(28)).toEqual({ tier: "gold", reward: 3.5 });
    });

    it("returns base for 10-20 correct votes", () => {
      expect(calculateTier(10)).toEqual({ tier: "base", reward: 1.75 });
      expect(calculateTier(20)).toEqual({ tier: "base", reward: 1.75 });
    });

    it("returns participation for <10 correct votes", () => {
      expect(calculateTier(0)).toEqual({ tier: "participation", reward: 0 });
      expect(calculateTier(9)).toEqual({ tier: "participation", reward: 0 });
    });
  });

  describe("generateCalendarICS", () => {
    it("generates valid ICS format", () => {
      const ics = generateCalendarICS({
        title: "Week 1",
        scheduledAt: new Date("2025-06-01T18:00:00Z"),
      });

      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("SUMMARY:Week 1 - The Clearance");
      expect(ics).toContain("DTSTART:");
      expect(ics).toContain("DTEND:");
    });
  });
});
