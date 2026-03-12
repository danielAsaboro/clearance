import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  variant?: "default" | "bordered";
}

export function Card({
  children,
  variant = "default",
  className = "",
  ...props
}: CardProps) {
  const base = "bg-[#1A1A1A] rounded-xl p-4";
  const border = variant === "bordered" ? "border border-[#2A2A2A]" : "";

  return (
    <View className={`${base} ${border} ${className}`} {...props}>
      {children}
    </View>
  );
}
