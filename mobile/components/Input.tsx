import { TextInput, View, Text, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  return (
    <View className="gap-1">
      {label && (
        <Text className="text-[#6B7280] text-sm mb-1">{label}</Text>
      )}
      <TextInput
        className={`bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-4 py-3 text-white text-base ${
          error ? "border-red-500" : ""
        } ${className}`}
        placeholderTextColor="#6B7280"
        {...props}
      />
      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
