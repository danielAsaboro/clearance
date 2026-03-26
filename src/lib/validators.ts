import { z } from "zod";

export const onboardSchema = z.object({
  role: z.literal("player"),
  categories: z.array(z.string()).length(5, "Select exactly 5 categories"),
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().min(1, "Display name is required").max(50),
  profilePhoto: z.string().url().optional().or(z.literal("")),
  consentAccepted: z.literal(true, {
    message: "You must accept the terms",
  }),
});

export const createSessionSchema = z.object({
  weekNumber: z.number().int().positive(),
  title: z.string().min(1),
  scheduledAt: z.string().datetime(),
  lateJoinCutoff: z.string().datetime().optional(),
});

export const submitVoteSchema = z.object({
  matchupId: z.string(),
  decision: z.enum(["video_a", "video_b"]),
  timeToVoteMs: z.number().int().min(0).max(120000).optional(),
});

export const claimUsdcSchema = z.object({
  gameResultId: z.string().min(1),
});

export const createVideoSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(12).default([]),
  originalFilename: z.string().trim().min(1).max(255),
  sourceContentType: z.string().trim().min(1).max(100),
  sourceBytes: z.number().int().positive().max(1024 * 1024 * 1024).optional(),
  sourceKey: z.string().trim().min(1).max(500),
});

export const createVideoUploadIntentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(["video/mp4", "video/webm", "video/quicktime"]),
  size: z.number().int().positive().max(1024 * 1024 * 1024),
});

export const updateVideoSchema = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(12).optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
});

export const createVideoCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateVideoCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const createMatchupsSchema = z.object({
  matchups: z.array(
    z.object({
      matchupNumber: z.number().int().min(1),
      videoAId: z.string(),
      videoBId: z.string(),
    })
  ),
});

export type OnboardInput = z.infer<typeof onboardSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;
