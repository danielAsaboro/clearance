export const campaignConfig = {
  cycleDurationWeeks: parseInt(process.env.CAMPAIGN_CYCLE_DURATION_WEEKS ?? "3"),
  liveSessionsPerCycle: parseInt(process.env.LIVE_SESSIONS_PER_CYCLE ?? "3"),
  matchupsPerSession: parseInt(process.env.MATCHUPS_PER_SESSION ?? "28"),
  votingRoundDurationSeconds: parseInt(process.env.VOTING_ROUND_DURATION_SECONDS ?? "30"),
} as const;
