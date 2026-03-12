import { View, Text, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, Trophy, Gift } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/Button";

export default function HomeScreen() {
  const { authenticated, isReady, login, email } = useAuth();

  const handlePlay = () => {
    if (!authenticated) {
      login();
      return;
    }
    router.push("/(tabs)/arena");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-[#F5E642] items-center justify-center mb-4">
            <Eye size={40} color="#000" />
          </View>
          <Text className="text-white text-4xl font-bold">Spotr TV</Text>
          <Text className="text-[#6B7280] text-center mt-2 text-base">
            Predict trending content.{"\n"}Earn rewards. Own the moment.
          </Text>
        </View>

        {/* Season badge */}
        <View className="bg-[#1A1A1A] border border-[#F5E642] rounded-full px-4 py-1.5 mb-10">
          <Text className="text-[#F5E642] text-sm font-semibold">
            Season 1 is LIVE
          </Text>
        </View>

        {/* Action buttons */}
        <View className="w-full gap-3">
          <Button title="Play" size="lg" onPress={handlePlay} />

          <Button
            title="Leaderboard"
            variant="secondary"
            size="lg"
            onPress={() => router.push("/(tabs)/leaderboard")}
          />

          {authenticated && (
            <Button
              title="My Rewards"
              variant="outline"
              size="lg"
              onPress={() => router.push("/(tabs)/rewards")}
            />
          )}
        </View>

        {/* Auth status */}
        <View className="mt-8">
          {authenticated && email ? (
            <Text className="text-[#6B7280] text-sm">
              Signed in as {email}
            </Text>
          ) : (
            <Pressable onPress={login}>
              <Text className="text-[#F5E642] text-sm font-semibold">
                Sign in to get started
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
