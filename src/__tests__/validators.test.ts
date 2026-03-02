import {
  onboardSchema,
  submitTaskSchema,
  createSessionSchema,
  submitVoteSchema,
  judgeRoundSchema,
  assignTasksSchema,
  claimUsdcSchema,
} from "@/lib/validators";

describe("Validators", () => {
  describe("onboardSchema", () => {
    const validCreatorData = {
      role: "creator" as const,
      categories: ["Afrobeats", "Nollywood", "Comedy Skits", "Fashion", "Tech"],
      displayName: "Test Creator",
      consentAccepted: true as const,
      debtSources: ["student-loan"],
      willingToDeclare: true,
      tiktokUsername: "testcreator",
    };

    const validFanData = {
      role: "fan" as const,
      categories: ["Afrobeats", "Nollywood", "Comedy Skits", "Fashion", "Tech"],
      displayName: "Test Fan",
      consentAccepted: true as const,
    };

    it("accepts valid creator onboarding data", () => {
      const result = onboardSchema.safeParse(validCreatorData);
      expect(result.success).toBe(true);
    });

    it("accepts valid fan onboarding data", () => {
      const result = onboardSchema.safeParse(validFanData);
      expect(result.success).toBe(true);
    });

    it("accepts data with optional profile photo", () => {
      const result = onboardSchema.safeParse({
        ...validCreatorData,
        profilePhoto: "https://example.com/photo.jpg",
      });
      expect(result.success).toBe(true);
    });

    it("accepts data with optional email", () => {
      const result = onboardSchema.safeParse({
        ...validFanData,
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects wrong number of categories", () => {
      const result = onboardSchema.safeParse({
        ...validFanData,
        categories: ["Afrobeats", "Tech"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing display name", () => {
      const result = onboardSchema.safeParse({
        ...validCreatorData,
        displayName: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid TikTok username", () => {
      const result = onboardSchema.safeParse({
        ...validCreatorData,
        tiktokUsername: "invalid username!",
      });
      expect(result.success).toBe(false);
    });

    it("rejects consentAccepted: false", () => {
      const result = onboardSchema.safeParse({
        ...validCreatorData,
        consentAccepted: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("submitTaskSchema", () => {
    it("accepts valid TikTok URL", () => {
      const result = submitTaskSchema.safeParse({
        tiktokUrl: "https://www.tiktok.com/@user/video/1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("accepts vm.tiktok.com short URL", () => {
      const result = submitTaskSchema.safeParse({
        tiktokUrl: "https://vm.tiktok.com/abc123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-TikTok URL", () => {
      const result = submitTaskSchema.safeParse({
        tiktokUrl: "https://youtube.com/watch?v=abc",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-URL string", () => {
      const result = submitTaskSchema.safeParse({
        tiktokUrl: "not a url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createSessionSchema", () => {
    it("accepts valid session data", () => {
      const result = createSessionSchema.safeParse({
        weekNumber: 1,
        title: "Week 1 Session",
        scheduledAt: "2025-01-01T12:00:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional lateJoinCutoff", () => {
      const result = createSessionSchema.safeParse({
        weekNumber: 1,
        title: "Week 1 Session",
        scheduledAt: "2025-01-01T12:00:00.000Z",
        lateJoinCutoff: "2025-01-01T12:30:00.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative week number", () => {
      const result = createSessionSchema.safeParse({
        weekNumber: -1,
        title: "Week 1",
        scheduledAt: "2025-01-01T12:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty title", () => {
      const result = createSessionSchema.safeParse({
        weekNumber: 1,
        title: "",
        scheduledAt: "2025-01-01T12:00:00.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("submitVoteSchema", () => {
    it("accepts approve vote", () => {
      const result = submitVoteSchema.safeParse({
        roundId: "round-123",
        decision: "approve",
      });
      expect(result.success).toBe(true);
    });

    it("accepts reject vote", () => {
      const result = submitVoteSchema.safeParse({
        roundId: "round-123",
        decision: "reject",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid decision", () => {
      const result = submitVoteSchema.safeParse({
        roundId: "round-123",
        decision: "skip",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("judgeRoundSchema", () => {
    it("accepts valid judging data", () => {
      const result = judgeRoundSchema.safeParse({
        rounds: [
          { roundId: "r1", verdict: "approved" },
          { roundId: "r2", verdict: "rejected" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid verdict", () => {
      const result = judgeRoundSchema.safeParse({
        rounds: [{ roundId: "r1", verdict: "maybe" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("assignTasksSchema", () => {
    it("accepts valid task assignment", () => {
      const result = assignTasksSchema.safeParse({
        creatorIds: ["user-1", "user-2"],
        weekNumber: 1,
        descriptions: ["Task 1", "Task 2", "Task 3"],
        deadline: "2025-01-07T23:59:59.000Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects wrong number of descriptions", () => {
      const result = assignTasksSchema.safeParse({
        creatorIds: ["user-1"],
        weekNumber: 1,
        descriptions: ["Task 1", "Task 2"],
        deadline: "2025-01-07T23:59:59.000Z",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("claimUsdcSchema", () => {
    it("accepts valid game result ID", () => {
      const result = claimUsdcSchema.safeParse({
        gameResultId: "result-123",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty game result ID", () => {
      const result = claimUsdcSchema.safeParse({
        gameResultId: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
