"use client";

interface TimerBarProps {
  secondsLeft: number;
  roundDuration: number;
  currentStep?: never;
  totalSteps?: never;
}

interface StepBarProps {
  currentStep: number;
  totalSteps: number;
  secondsLeft?: never;
  roundDuration?: never;
}

type ProgressBarProps = TimerBarProps | StepBarProps;

export default function ProgressBar(props: ProgressBarProps) {
  if ("secondsLeft" in props && props.secondsLeft !== undefined) {
    const { secondsLeft, roundDuration } = props;
    const pct = roundDuration > 0 ? Math.max(0, Math.min(1, secondsLeft / roundDuration)) * 100 : 0;
    const isLow = secondsLeft <= 5;

    return (
      <div className="spotr-progress-track h-[5px]">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{
            width: `${pct}%`,
            backgroundColor: isLow ? "#eb5a52" : "#f5d63d",
          }}
        />
      </div>
    );
  }

  const { currentStep, totalSteps } = props as StepBarProps;
  const pct = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <div className="spotr-progress-track h-[5px]">
      <div
        className="spotr-progress-fill transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
