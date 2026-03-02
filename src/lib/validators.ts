import { z } from "zod";
import { campaignConfig } from "@/lib/campaign-config";

export const onboardSchema = z.object({
  role: z.enum(["creator", "fan"]),
  categories: z.array(z.string()).length(5, "Select exactly 5 categories"),
  email: z.string().email().optional().or(z.literal("")),
  displayName: z.string().min(1, "Display name is required").max(50),
  profilePhoto: z.string().url().optional().or(z.literal("")),
  consentAccepted: z.literal(true, {
    message: "You must accept the terms",
  }),
  // Creator-only fields (optional for fans)
  debtSources: z.array(z.string()).optional(),
  willingToDeclare: z.boolean().optional(),
  tiktokUsername: z
    .string()
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/, "Invalid TikTok username")
    .optional()
    .or(z.literal("")),
});

export const submitTaskSchema = z.object({
  tiktokUrl: z
    .string()
    .url("Must be a valid URL")
    .regex(
      /^https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)\/.+/,
      "Must be a TikTok URL"
    ),
});

export const createTaskSchema = z.object({
  creatorId: z.string(),
  weekNumber: z.number().int().positive(),
  taskNumber: z.number().int().min(1).max(campaignConfig.contentTasksPerWeekPerCreator),
  description: z.string().min(1),
  deadline: z.string().datetime(),
});

export const createSessionSchema = z.object({
  weekNumber: z.number().int().positive(),
  title: z.string().min(1),
  scheduledAt: z.string().datetime(),
  lateJoinCutoff: z.string().datetime().optional(),
});

export const submitVoteSchema = z.object({
  roundId: z.string(),
  decision: z.enum(["approve", "reject"]),
});

export const judgeRoundSchema = z.object({
  rounds: z.array(
    z.object({
      roundId: z.string(),
      verdict: z.enum(["approved", "rejected"]),
    })
  ),
});

export const assignTasksSchema = z.object({
  creatorIds: z.array(z.string()),
  weekNumber: z.number().int().positive(),
  descriptions: z.array(z.string()).length(3),
  deadline: z.string().datetime(),
});

export const claimUsdcSchema = z.object({
  gameResultId: z.string().min(1),
});

export type OnboardInput = z.infer<typeof onboardSchema>;
export type SubmitTaskInput = z.infer<typeof submitTaskSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;
