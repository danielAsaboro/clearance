"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="flex gap-2 w-full">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${
            i < currentStep ? "bg-[#F5E642]" : "bg-[#333]"
          }`}
        />
      ))}
    </div>
  );
}
