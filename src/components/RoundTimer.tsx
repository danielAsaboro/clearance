"use client";

import { useEffect, useState } from "react";

interface RoundTimerProps {
  duration: number; // seconds
  onExpire: () => void;
  active: boolean;
}

export default function RoundTimer({ duration, onExpire, active }: RoundTimerProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    setTimeLeft(duration);
  }, [duration]);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [active, onExpire]);

  const percentage = (timeLeft / duration) * 100;
  const isUrgent = timeLeft <= 5;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[#888] text-xs">Time Remaining</span>
        <span
          className={`text-sm font-bold font-mono ${
            isUrgent ? "text-red-400 animate-pulse" : "text-white"
          }`}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isUrgent ? "bg-red-400" : "bg-[#F5E642]"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
