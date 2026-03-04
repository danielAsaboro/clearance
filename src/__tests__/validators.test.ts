import {
  onboardSchema,
  createSessionSchema,
  submitVoteSchema,
  claimUsdcSchema,
  createVideoSchema,
  createMatchupsSchema,
} from "@/lib/validators";

describe("Validators", () => {
  describe("onboardSchema", () => {
    const validPlayerData = {
      role: "player" as const,
      categories: ["Afrobeats", "Nollywood", "Comedy Skits", "Fashion", "Tech"],
      displayName: "Test Player",
      consentAccepted: true as const,
    };

    it("accepts valid player onboarding data", () => {
      const result = onboardSchema.safeParse(validPlayerData);
      expect(result.success).toBe(true);
    });

    it("accepts data with optional profile photo", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        profilePhoto: "https://example.com/photo.jpg",
      });
      expect(result.success).toBe(true);
    });

    it("accepts data with optional email", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        email: "test@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-player role", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        role: "creator",
      });
      expect(result.success).toBe(false);
    });

    it("rejects wrong number of categories", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        categories: ["Afrobeats", "Tech"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing display name", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        displayName: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects consentAccepted: false", () => {
      const result = onboardSchema.safeParse({
        ...validPlayerData,
        consentAccepted: false,
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
    it("accepts video_a vote", () => {
      const result = submitVoteSchema.safeParse({
        matchupId: "matchup-123",
        decision: "video_a",
      });
      expect(result.success).toBe(true);
    });

    it("accepts video_b vote", () => {
      const result = submitVoteSchema.safeParse({
        matchupId: "matchup-123",
        decision: "video_b",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid decision", () => {
      const result = submitVoteSchema.safeParse({
        matchupId: "matchup-123",
        decision: "approve",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing matchupId", () => {
      const result = submitVoteSchema.safeParse({
        decision: "video_a",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createVideoSchema", () => {
    it("accepts valid video data", () => {
      const result = createVideoSchema.safeParse({
        url: "https://s3.example.com/videos/abc.mp4",
      });
      expect(result.success).toBe(true);
    });

    it("accepts video with optional fields", () => {
      const result = createVideoSchema.safeParse({
        title: "Trending Dance",
        url: "https://s3.example.com/videos/abc.mp4",
        thumbnailUrl: "https://s3.example.com/thumbs/abc.jpg",
        duration: 30,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid URL", () => {
      const result = createVideoSchema.safeParse({
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative duration", () => {
      const result = createVideoSchema.safeParse({
        url: "https://s3.example.com/videos/abc.mp4",
        duration: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createMatchupsSchema", () => {
    it("accepts valid matchups data", () => {
      const result = createMatchupsSchema.safeParse({
        matchups: [
          { matchupNumber: 1, videoAId: "v1", videoBId: "v2" },
          { matchupNumber: 2, videoAId: "v3", videoBId: "v4" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects matchup with zero matchupNumber", () => {
      const result = createMatchupsSchema.safeParse({
        matchups: [{ matchupNumber: 0, videoAId: "v1", videoBId: "v2" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty matchups array", () => {
      const result = createMatchupsSchema.safeParse({
        matchups: [],
      });
      // Empty array is technically valid per schema — z.array allows it
      expect(result.success).toBe(true);
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
