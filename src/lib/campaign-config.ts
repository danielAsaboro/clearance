import { serverEnv } from "@/lib/env";

export const campaignConfig = {
  matchupsPerSession: serverEnv.NEXT_PUBLIC_ROUNDS_PER_SESSION,
  votingRoundDurationSeconds: serverEnv.NEXT_PUBLIC_VOTING_ROUND_DURATION_IN_SECONDS,
  entryFeeUsdc: serverEnv.NEXT_PUBLIC_ENTRY_FEE_USDC,
  houseCut: serverEnv.HOUSE_CUT,
  sampleSessionEnabled: serverEnv.SAMPLE_SESSION_ENABLED,
} as const;
