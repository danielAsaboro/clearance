export interface MatchupVideo {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
}

export interface Matchup {
  id: string;
  matchupNumber: number;
  duration: number;
  videoA: MatchupVideo;
  videoB: MatchupVideo;
}

export interface RoundState {
  status: string;
  round: number;
  secondsRemaining: number;
  totalRounds: number;
  roundDuration: number;
}

export interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: "scheduled" | "live" | "ended";
  lateJoinCutoff?: string | null;
  collectionAddress?: string | null;
  vaultAddress?: string | null;
  _count?: {
    gameResults: number;
  };
}

export interface UserProfile {
  id: string;
  privyId: string;
  displayName: string | null;
  email: string | null;
  profilePhoto: string | null;
  walletAddress: string | null;
  role: "player" | "admin";
  onboarded: boolean;
  categories: string[];
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string | null;
  profilePhoto: string | null;
  totalScore: number;
  sessionsPlayed: number;
}

export type GamePhase = "confirming" | "joining" | "playing" | "insufficient";

export interface InterstitialState {
  round: number;
  totalRounds: number;
  pick: "video_a" | "video_b" | null;
}
