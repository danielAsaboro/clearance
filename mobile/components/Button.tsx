import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from "react-native";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyle =
    "rounded-lg items-center justify-center flex-row";

  const variantStyles = {
    primary: "bg-[#F5E642]",
    secondary: "bg-[#1A1A1A] border border-[#2A2A2A]",
    outline: "border border-[#F5E642] bg-transparent",
    ghost: "bg-transparent",
  };

  const sizeStyles = {
    sm: "px-3 py-2",
    md: "px-5 py-3",
    lg: "px-6 py-4",
  };

  const textVariantStyles = {
    primary: "text-black font-bold",
    secondary: "text-white font-semibold",
    outline: "text-[#F5E642] font-semibold",
    ghost: "text-[#F5E642] font-semibold",
  };

  const textSizeStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <Pressable
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${
        isDisabled ? "opacity-50" : ""
      }`}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? "#000" : "#F5E642"}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        className={`${textVariantStyles[variant]} ${textSizeStyles[size]}`}
      >
        {title}
      </Text>
    </Pressable>
  );
}
