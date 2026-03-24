// Campaign configuration (matches src/lib/campaign-config.ts defaults)
export const CAMPAIGN = {
  cycleDurationWeeks: 3,
  liveSessionsPerCycle: 3,
  matchupsPerSession: 28,
  votingRoundDurationSeconds: 30,
  entryFeeUsdc: 10,
  goldRewardUsdc: 3.5,
  baseRewardUsdc: 1.75,
} as const;

// Tier thresholds
export const TIER_THRESHOLDS = {
  gold: 0.75,   // ≥75% accuracy
  base: 0.36,   // ≥36% accuracy
} as const;

// Colors
export const COLORS = {
  accent: "#F5E642",
  background: "#000000",
  card: "#1A1A1A",
  border: "#2A2A2A",
  muted: "#6B7280",
  white: "#FFFFFF",
  red: "#EF4444",
  green: "#22C55E",
  tierGold: "#F5E642",
  tierBase: "#C0C0C0",
  tierParticipation: "#CD7F32",
} as const;

// Categories for onboarding
export const CATEGORIES = [
  "Music",
  "Comedy",
  "Dance",
  "Fashion",
  "Sports",
  "Food",
  "Travel",
  "Tech",
  "Art",
  "Gaming",
  "Fitness",
  "Beauty",
  "Education",
  "News",
  "Lifestyle",
] as const;

// Branding
export const APP_NAME = "Spotr TV";
export const HASHTAG = "#SpotrTV";
