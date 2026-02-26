"use client";

import { useState } from "react";
import { Gift, Sparkles, ExternalLink, Loader2 } from "lucide-react";

interface BlindBoxCardProps {
  gameResultId: string;
  tier: "base" | "gold";
  rewardAmount: number;
  revealed: boolean;
  tokenId: string | null;
  onReveal: (gameResultId: string) => Promise<void>;
  usdcClaimed?: boolean;
  claimTxHash?: string | null;
  onClaim?: (gameResultId: string) => Promise<void>;
}

const tierColors = {
  base: {
    bg: "from-[#F5E642]/20 to-[#F5E642]/5",
    border: "border-[#F5E642]/30",
    text: "text-[#F5E642]",
    glow: "shadow-[0_0_30px_rgba(245,230,66,0.2)]",
  },
  gold: {
    bg: "from-yellow-400/20 to-yellow-400/5",
    border: "border-yellow-400/30",
    text: "text-yellow-400",
    glow: "shadow-[0_0_30px_rgba(250,204,21,0.3)]",
  },
};

export default function BlindBoxCard({
  gameResultId,
  tier,
  rewardAmount,
  revealed,
  onReveal,
  usdcClaimed = false,
  claimTxHash,
  onClaim,
}: BlindBoxCardProps) {
  const [isRevealing, setIsRevealing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [flipped, setFlipped] = useState(revealed);
  const colors = tierColors[tier];

  const handleReveal = async () => {
    setIsRevealing(true);
    try {
      await onReveal(gameResultId);
      setTimeout(() => setFlipped(true), 300);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleClaim = async () => {
    if (!onClaim) return;
    setIsClaiming(true);
    try {
      await onClaim(gameResultId);
    } finally {
      setIsClaiming(false);
    }
  };

  const explorerUrl = claimTxHash
    ? `https://explorer.solana.com/tx/${claimTxHash}`
    : null;

  return (
    <div className="perspective-1000">
      <div
        className={`relative w-full aspect-[3/4] transition-transform duration-700 transform-style-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.7s ease-in-out",
        }}
      >
        {/* Front — Unrevealed */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${colors.bg} ${colors.border} border ${colors.glow} flex flex-col items-center justify-center p-6`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <Gift className={`w-16 h-16 ${colors.text} mb-4`} />
          <p className="text-white font-bold text-lg mb-1">Blind Box</p>
          <p className={`${colors.text} text-sm font-medium mb-6`}>
            {tier === "gold" ? "Gold Tier" : "Base Tier"}
          </p>

          {!revealed && (
            <button
              onClick={handleReveal}
              disabled={isRevealing}
              className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
                tier === "gold"
                  ? "bg-yellow-400 text-black hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
                  : "btn-yellow"
              } ${isRevealing ? "animate-pulse" : ""}`}
            >
              {isRevealing ? "Revealing..." : "Tap to Reveal"}
            </button>
          )}
        </div>

        {/* Back — Revealed */}
        <div
          className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${colors.bg} ${colors.border} border ${colors.glow} flex flex-col items-center justify-center p-6`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <Sparkles className={`w-12 h-12 ${colors.text} mb-4`} />
          <p className="text-white font-bold text-xl mb-1">Revealed!</p>
          <p className={`${colors.text} text-3xl font-bold my-4`}>
            ${rewardAmount.toFixed(2)}
          </p>
          <p className="text-[#888] text-sm">USDC Reward</p>
          <p className={`${colors.text} text-xs mt-2 uppercase tracking-wider mb-4`}>
            {tier === "gold" ? "Gold Tier" : "Base Tier"}
          </p>

          {rewardAmount > 0 && (
            usdcClaimed ? (
              <a
                href={explorerUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-green-400 text-sm font-medium hover:underline"
              >
                Claimed — View Transaction <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : onClaim ? (
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className={`px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  tier === "gold"
                    ? "bg-yellow-400 text-black hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
                    : "btn-yellow"
                } ${isClaiming ? "opacity-70" : ""}`}
              >
                {isClaiming ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Claiming...
                  </span>
                ) : (
                  `Claim $${rewardAmount.toFixed(2)} USDC`
                )}
              </button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
