"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";

interface VoteButtonsProps {
  onVote: (decision: "approve" | "reject") => void;
  disabled?: boolean;
  voted?: "approve" | "reject" | null;
}

export default function VoteButtons({ onVote, disabled, voted }: VoteButtonsProps) {
  return (
    <div className="flex gap-4 w-full">
      <button
        onClick={() => onVote("approve")}
        disabled={disabled || voted !== null}
        className={`flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
          voted === "approve"
            ? "bg-green-500 text-white scale-105 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
            : voted !== null
              ? "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
              : "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 active:scale-95"
        }`}
      >
        <ThumbsUp className="w-5 h-5" />
        Approve
      </button>

      <button
        onClick={() => onVote("reject")}
        disabled={disabled || voted !== null}
        className={`flex-1 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
          voted === "reject"
            ? "bg-red-500 text-white scale-105 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            : voted !== null
              ? "bg-[#1A1A1A] text-[#555] cursor-not-allowed"
              : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-95"
        }`}
      >
        <ThumbsDown className="w-5 h-5" />
        Reject
      </button>
    </div>
  );
}
