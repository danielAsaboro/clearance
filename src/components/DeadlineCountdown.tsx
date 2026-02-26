"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface DeadlineCountdownProps {
  deadline: string;
  label?: string;
}

export default function DeadlineCountdown({
  deadline,
  label = "Deadline",
}: DeadlineCountdownProps) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const target = new Date(deadline);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <div className="flex items-center gap-2 text-[#888]">
      <Clock className="w-4 h-4" />
      <span className="text-xs">
        {label}: <span className="text-[#F5E642] font-medium">{timeLeft}</span>
      </span>
    </div>
  );
}
