import { View, Text, Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import { Copy } from "lucide-react-native";

interface ConnectWalletProps {
  address: string | null;
}

export function ConnectWallet({ address }: ConnectWalletProps) {
  if (!address) return null;

  const short = `${address.slice(0, 4)}...${address.slice(-4)}`;

  const copyAddress = async () => {
    await Clipboard.setStringAsync(address);
    Toast.show({
      type: "success",
      text1: "Copied!",
      text2: "Wallet address copied to clipboard",
      visibilityTime: 2000,
    });
  };

  return (
    <Pressable
      onPress={copyAddress}
      className="flex-row items-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 gap-2"
    >
      <View className="w-2 h-2 rounded-full bg-green-500" />
      <Text className="text-white text-sm font-mono">{short}</Text>
      <Copy size={14} color="#6B7280" />
    </Pressable>
  );
}
