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
});

export const claimUsdcSchema = z.object({
  gameResultId: z.string().min(1),
});

export const createVideoSchema = z.object({
  title: z.string().max(200).optional(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().int().positive().optional(),
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
