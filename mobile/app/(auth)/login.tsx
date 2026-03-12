import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, ArrowLeft } from "lucide-react-native";
import { usePrivy, useLoginWithOAuth, useLoginWithEmail } from "@privy-io/expo";
import { Button } from "@/components/Button";

export default function LoginScreen() {
  const { user } = usePrivy();
  const { login: oauthLogin } = useLoginWithOAuth();

  // Redirect if already authenticated
  if (user) {
    router.replace("/(tabs)/arena");
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="px-4 pt-2">
        <Pressable onPress={() => router.back()} className="p-2">
          <ArrowLeft size={24} color="#fff" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="w-16 h-16 rounded-full bg-[#F5E642] items-center justify-center mb-6">
          <Eye size={32} color="#000" />
        </View>

        <Text className="text-white text-2xl font-bold mb-2">
          Welcome to Spotr TV
        </Text>
        <Text className="text-[#6B7280] text-center mb-10">
          Sign in to predict trending content and earn rewards
        </Text>

        <View className="w-full gap-3">
          <Button
            title="Sign in with Google"
            size="lg"
            onPress={() => oauthLogin({ provider: "google" })}
          />
          <Button
            title="Sign in with Twitter"
            variant="secondary"
            size="lg"
            onPress={() => oauthLogin({ provider: "twitter" })}
          />
          <Button
            title="Sign in with Apple"
            variant="secondary"
            size="lg"
            onPress={() => oauthLogin({ provider: "apple" })}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
