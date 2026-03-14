function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const campaignConfig = {
  matchupsPerSession: parseInt(requireEnv("ROUNDS_PER_SESSION")),
  votingRoundDurationSeconds: parseInt(requireEnv("VOTING_ROUND_DURATION_IN_SECONDS")),
  entryFeeUsdc: parseFloat(requireEnv("ENTRY_FEE_USDC")),
  goldRewardUsdc: parseFloat(requireEnv("GOLD_REWARD_USDC")),
  baseRewardUsdc: parseFloat(requireEnv("BASE_REWARD_USDC")),
  sampleSessionEnabled: process.env.SAMPLE_SESSION_ENABLED === "true",
} as const;
