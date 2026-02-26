"use client";

import { CheckCircle } from "lucide-react";

interface ScoreTrackerProps {
  correct: number;
  total: number;
}

export default function ScoreTracker({ correct, total }: ScoreTrackerProps) {
  return (
    <div className="flex items-center gap-1.5 bg-[#1A1A1A] rounded-full px-3 py-1.5 border border-[#2A2A2A]">
      <CheckCircle className="w-4 h-4 text-green-400" />
      <span className="text-white text-sm font-bold">{correct}</span>
      <span className="text-[#555] text-sm">/ {total}</span>
    </div>
  );
}
