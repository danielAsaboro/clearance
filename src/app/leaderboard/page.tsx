"use client";

import { useEffect, useState } from "react";
import { Crown, Trophy, Users, X } from "lucide-react";
import Link from "next/link";

interface PlayerRanking {
  rank: number;
  userId: string;
  displayName: string;
  profilePhoto: string | null;
  correctPredictions: number;
  totalVotes: number;
  sessionsPlayed: number;
  winRate: number;
}

interface TribeRanking {
  rank: number;
  leaderId: string;
  leaderName: string;
  leaderPhoto: string | null;
  memberCount: number;
  tribeScore: number;
}

type Tab = "players" | "tribes";

const PODIUM_STYLES = [
  {
    ring: "border-[#69728b]",
    icon: <Trophy className="h-5 w-5 text-[#838ca2]" />,
    bar: "bg-[#4f5a75]",
    height: 70,
  },
  {
    ring: "border-[#f5d63d]",
    icon: <Crown className="h-6 w-6 text-[#f5d63d]" />,
    bar: "bg-[#74651d]",
    height: 92,
  },
  {
    ring: "border-[#9f631e]",
    icon: <Trophy className="h-5 w-5 text-[#9f631e]" />,
    bar: "bg-[#5a3417]",
    height: 50,
  },
];

function truncateWallet(name: string) {
  return name.length > 10 ? `${name.slice(0, 4)}...${name.slice(-4)}` : name;
}

function PlayerLeaderboard({ rankings }: { rankings: PlayerRanking[] }) {
  const top3 = rankings.slice(0, 3);
  const podium = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const rest = rankings.slice(3);

  return (
    <>
      {podium.length >= 3 ? (
        <div className="mb-6 mt-2 flex items-end justify-center gap-6 px-4">
          {podium.map((player, index) => {
            const style = PODIUM_STYLES[index];
            return (
              <div key={player.userId} className="flex w-[120px] flex-col items-center">
                <div className="mb-2 flex h-10 items-end justify-center">{style.icon}</div>
                <div
                  className={`mb-2 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-[#171717] ${style.ring}`}
                >
                  {player.profilePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={player.profilePhoto}
                      alt={player.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-[#d9d9d9]">
                      {player.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="max-w-full truncate text-[11px] text-[#8e8e8e]">
                  {truncateWallet(player.displayName)}
                </p>
                <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.05em] text-[#f5d63d]">
                  {player.correctPredictions}
                </p>
                <div
                  className={`mt-1 flex w-full items-end justify-center rounded-t-[8px] ${style.bar}`}
                  style={{ height: style.height }}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#121212]">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_74px_74px_74px] gap-2 border-b border-white/8 px-4 py-3 text-[11px] font-medium text-[#646464]">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Acc%</span>
          <span className="text-right">Games</span>
        </div>

        {rest.map((player) => (
          <div
            key={player.userId}
            className="grid grid-cols-[44px_minmax(0,1fr)_74px_74px_74px] gap-2 border-b border-white/6 px-4 py-[14px] text-[14px] last:border-b-0"
          >
            <span className="text-[#8d8d8d]">{player.rank}</span>
            <span className="truncate text-[#e4e4e4]">{truncateWallet(player.displayName)}</span>
            <span className="text-right font-semibold text-[#e4e4e4]">{player.correctPredictions}</span>
            <span className="text-right text-[#9b9b9b]">{player.winRate}%</span>
            <span className="text-right text-[#9b9b9b]">{player.sessionsPlayed}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[12px] text-[#646464]">
        Top Taste Tribe at 7,000 collective points unlocks group NFT eligibility
      </p>
    </>
  );
}

function TribeLeaderboard({ tribes }: { tribes: TribeRanking[] }) {
  const top3 = tribes.slice(0, 3);
  const podium = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const rest = tribes.slice(3);

  return (
    <>
      {podium.length >= 3 ? (
        <div className="mb-6 mt-2 flex items-end justify-center gap-6 px-4">
          {podium.map((tribe, index) => {
            const style = PODIUM_STYLES[index];
            return (
              <div key={tribe.leaderId} className="flex w-[120px] flex-col items-center">
                <div className="mb-2 flex h-10 items-end justify-center">{style.icon}</div>
                <div
                  className={`mb-2 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border bg-[#171717] ${style.ring}`}
                >
                  {tribe.leaderPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tribe.leaderPhoto}
                      alt={tribe.leaderName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[12px] font-semibold text-[#d9d9d9]">
                      {tribe.leaderName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="max-w-full truncate text-[11px] text-[#8e8e8e]">
                  {tribe.leaderName}&apos;s Tribe
                </p>
                <p className="mt-1 text-[30px] font-semibold leading-none tracking-[-0.05em] text-[#f5d63d]">
                  {tribe.tribeScore}
                </p>
                <div
                  className={`mt-1 flex w-full items-end justify-center rounded-t-[8px] ${style.bar}`}
                  style={{ height: style.height }}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[14px] border border-white/8 bg-[#121212]">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_74px_74px] gap-2 border-b border-white/8 px-4 py-3 text-[11px] font-medium text-[#646464]">
          <span>#</span>
          <span>Tribe</span>
          <span className="text-right">Members</span>
          <span className="text-right">Score</span>
        </div>

        {rest.map((tribe) => (
          <div
            key={tribe.leaderId}
            className="grid grid-cols-[44px_minmax(0,1fr)_74px_74px] gap-2 border-b border-white/6 px-4 py-[14px] text-[14px] last:border-b-0"
          >
            <span className="text-[#8d8d8d]">{tribe.rank}</span>
            <div className="flex items-center gap-2 truncate">
              <Users className="h-3.5 w-3.5 shrink-0 text-[#6b6b6b]" />
              <span className="truncate text-[#e4e4e4]">{tribe.leaderName}&apos;s Tribe</span>
            </div>
            <span className="text-right text-[#9b9b9b]">{tribe.memberCount + 1}</span>
            <span className="text-right font-semibold text-[#f5d63d]">{tribe.tribeScore}</span>
          </div>
        ))}
      </div>

      {tribes.length === 0 && (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3">
          <Users className="h-10 w-10 text-[#545454]" />
          <p className="text-[15px] text-[#8e8e8e]">No tribes yet. Share your referral link to start one!</p>
        </div>
      )}

      <p className="mt-5 text-center text-[12px] text-[#646464]">
        Tribes are ranked by the combined score of the leader and all referred members
      </p>
    </>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("players");
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [tribeRankings, setTribeRankings] = useState<TribeRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab === "tribes" ? "/api/leaderboard?tab=tribes" : "/api/leaderboard";
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (tab === "tribes") {
          setTribeRankings(data);
        } else {
          setPlayerRankings(data);
        }
      })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="spotr-page min-h-dvh px-4 py-3 md:px-6">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col">
        <div className="mb-5 flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-none tracking-[-0.05em] text-white">LEADERBOARD</h1>
            <p className="mt-1 text-[13px] text-[#6e6e6e]">Season 1 — March 2026</p>
          </div>

          <Link href="/" className="text-[#9b9b9b] transition-colors hover:text-white">
            <X className="h-4 w-4" />
          </Link>
        </div>

        {/* Tab bar */}
        <div className="mb-5 flex gap-1 rounded-[12px] bg-[#161616] p-1">
          <button
            onClick={() => setTab("players")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              tab === "players"
                ? "bg-[#f5d63d] text-black"
                : "text-[#8e8e8e] hover:text-white"
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            PLAYERS
          </button>
          <button
            onClick={() => setTab("tribes")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              tab === "tribes"
                ? "bg-[#f5d63d] text-black"
                : "text-[#8e8e8e] hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            TRIBES
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#f5d63d] border-t-transparent" />
          </div>
        ) : tab === "players" ? (
          playerRankings.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
              <Trophy className="h-10 w-10 text-[#545454]" />
              <p className="text-[15px] text-[#8e8e8e]">No rankings yet.</p>
            </div>
          ) : (
            <PlayerLeaderboard rankings={playerRankings} />
          )
        ) : (
          <TribeLeaderboard tribes={tribeRankings} />
        )}
      </div>
    </div>
  );
}
