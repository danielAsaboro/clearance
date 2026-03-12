import { View } from "react-native";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <View className="flex-row gap-2 w-full">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          className={`h-1 flex-1 rounded-full ${
            i < currentStep ? "bg-[#F5E642]" : "bg-[#333]"
          }`}
        />
      ))}
    </View>
  );
}
