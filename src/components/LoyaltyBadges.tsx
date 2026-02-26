"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Flame, Star, Trophy, Zap } from "lucide-react";

interface LoyaltyProgress {
  campaigns: Array<{
    name: string;
    current: number;
    target: number;
  }>;
  streaks: number;
  totalActions: number;
}

const BADGE_THRESHOLDS = [
  { threshold: 5, label: "Newcomer", icon: Star, color: "text-blue-400" },
  { threshold: 15, label: "Regular", icon: Zap, color: "text-purple-400" },
  { threshold: 30, label: "Dedicated", icon: Flame, color: "text-orange-400" },
  { threshold: 50, label: "Legend", icon: Trophy, color: "text-[#F5E642]" },
];

export default function LoyaltyBadges() {
  const { getAccessToken } = usePrivy();
  const [progress, setProgress] = useState<LoyaltyProgress | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/loyalty/track", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setProgress(await res.json());
        }
      } catch {
        // Non-fatal
      }
    };
    fetchProgress();
  }, [getAccessToken]);

  const totalActions = progress?.totalActions ?? 0;
  const streaks = progress?.streaks ?? 0;
  const currentBadge =
    BADGE_THRESHOLDS.filter((b) => totalActions >= b.threshold).pop() ??
    BADGE_THRESHOLDS[0];
  const nextBadge = BADGE_THRESHOLDS.find((b) => totalActions < b.threshold);

  return (
    <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-[#F5E642]" />
        <h3 className="text-white font-bold text-sm">Loyalty Progress</h3>
        <span className="ml-auto text-xs text-[#888] bg-[#2A2A2A] px-2 py-0.5 rounded-full">
          Powered by Torque
        </span>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-[#F5E642] font-bold text-lg">{totalActions}</p>
          <p className="text-[#888] text-xs">Actions</p>
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">{streaks}</p>
          <p className="text-[#888] text-xs">Streak</p>
        </div>
        <div className="text-center">
          <div className={`${currentBadge.color} font-bold text-lg flex items-center justify-center gap-1`}>
            <currentBadge.icon className="w-4 h-4" />
          </div>
          <p className="text-[#888] text-xs">{currentBadge.label}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {nextBadge && (
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#888]">
              Next: {nextBadge.label}
            </span>
            <span className="text-[#888]">
              {totalActions}/{nextBadge.threshold}
            </span>
          </div>
          <div className="w-full bg-[#2A2A2A] rounded-full h-2">
            <div
              className="bg-[#F5E642] h-2 rounded-full transition-all"
              style={{
                width: `${Math.min((totalActions / nextBadge.threshold) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Campaign Progress */}
      {progress?.campaigns && progress.campaigns.length > 0 && (
        <div className="mt-4 space-y-2">
          {progress.campaigns.map((campaign, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white">{campaign.name}</span>
                <span className="text-[#888]">
                  {campaign.current}/{campaign.target}
                </span>
              </div>
              <div className="w-full bg-[#2A2A2A] rounded-full h-1.5">
                <div
                  className="bg-purple-500 h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((campaign.current / campaign.target) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
