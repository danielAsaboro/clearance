import { serverEnv } from "@/lib/env";

export const campaignConfig = {
  matchupsPerSession: serverEnv.NEXT_PUBLIC_ROUNDS_PER_SESSION,
  votingRoundDurationSeconds: serverEnv.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS,
  entryFeeUsdc: serverEnv.NEXT_PUBLIC_ENTRY_FEE_USDC,
  goldRewardUsdc: serverEnv.GOLD_REWARD_USDC,
  baseRewardUsdc: serverEnv.NEXT_PUBLIC_BASE_REWARD_USDC,
  sampleSessionEnabled: serverEnv.SAMPLE_SESSION_ENABLED,
} as const;
