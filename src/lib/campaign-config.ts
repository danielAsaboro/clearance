export const campaignConfig = {
  cycleDurationWeeks: parseInt(process.env.CAMPAIGN_CYCLE_DURATION_WEEKS ?? "3"),
  liveSessionsPerCycle: parseInt(process.env.LIVE_SESSIONS_PER_CYCLE ?? "3"),
  videosPerLiveSession: parseInt(process.env.VIDEOS_PER_LIVE_SESSION ?? "28"),
  votingRoundDurationSeconds: parseInt(process.env.VOTING_ROUND_DURATION_SECONDS ?? "30"),
  contentTasksPerWeekPerCreator: parseInt(process.env.CONTENT_TASKS_PER_WEEK_PER_CREATOR ?? "3"),
  submissionDeadlineHours: parseInt(process.env.SUBMISSION_DEADLINE_HOURS ?? "72"),
} as const;
