export const campaignConfig = {
  cycleDurationWeeks: parseInt(process.env.CAMPAIGN_CYCLE_DURATION_WEEKS ?? "3"),
  liveSessionsPerCycle: parseInt(process.env.LIVE_SESSIONS_PER_CYCLE ?? "3"),
  matchupsPerSession: parseInt(process.env.VIDEOS_PER_LIVE_SESSION ?? "28"),
  votingRoundDurationSeconds: parseInt(process.env.VOTING_ROUND_DURATION_IN_SECONDS ?? "30"),
  entryFeeUsdc: parseFloat(process.env.ENTRY_FEE_USDC ?? "3.50"),
  goldRewardUsdc: parseFloat(process.env.GOLD_REWARD_USDC ?? "3.50"),
  baseRewardUsdc: parseFloat(process.env.BASE_REWARD_USDC ?? "1.75"),
} as const;
