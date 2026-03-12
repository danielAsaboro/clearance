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

export const submitVoteSchema = z.object({
  matchupId: z.string(),
  decision: z.enum(["video_a", "video_b"]),
});

export const claimUsdcSchema = z.object({
  gameResultId: z.string().min(1),
});

export type OnboardInput = z.infer<typeof onboardSchema>;
export type SubmitVoteInput = z.infer<typeof submitVoteSchema>;
