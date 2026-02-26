"use client";

import { Trophy, Star, Award } from "lucide-react";

interface ResultsCardProps {
  correctVotes: number;
  totalRounds: number;
  tier: "participation" | "base" | "gold";
  reward: number;
}

const tierConfig = {
  participation: {
    label: "Participation",
    icon: <Award className="w-10 h-10" />,
    color: "text-[#888]",
    bg: "bg-[#888]/10",
    border: "border-[#888]/30",
  },
  base: {
    label: "Base Tier",
    icon: <Star className="w-10 h-10" />,
    color: "text-[#F5E642]",
    bg: "bg-[#F5E642]/10",
    border: "border-[#F5E642]/30",
  },
  gold: {
    label: "Gold Tier",
    icon: <Trophy className="w-10 h-10" />,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
  },
};

export default function ResultsCard({
  correctVotes,
  totalRounds,
  tier,
  reward,
}: ResultsCardProps) {
  const config = tierConfig[tier];
  const percentage = Math.round((correctVotes / totalRounds) * 100);

  return (
    <div
      className={`rounded-2xl p-6 border ${config.border} ${config.bg} text-center`}
    >
      <div className={`${config.color} mb-4 flex justify-center`}>
        {config.icon}
      </div>

      <h3 className="text-white text-xl font-bold mb-1">{config.label}</h3>

      <div className="text-5xl font-bold text-white my-4">
        {correctVotes}
        <span className="text-[#888] text-lg">/{totalRounds}</span>
      </div>

      <p className="text-[#888] text-sm mb-4">{percentage}% accuracy</p>

      {reward > 0 && (
        <div className={`${config.color} text-2xl font-bold`}>
          ${reward.toFixed(2)} USDC
        </div>
      )}

      {reward === 0 && (
        <p className="text-[#888] text-sm">
          Score 10+ to earn rewards next time!
        </p>
      )}
    </div>
  );
}
