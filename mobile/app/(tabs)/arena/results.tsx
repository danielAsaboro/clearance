import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Eye, Share2, Gift } from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { CAMPAIGN, COLORS } from "@shared/constants";

interface GameResults {
  correctVotes: number;
  totalVotes: number;
  tier: "participation" | "base" | "gold";
  rewardAmount: number;
  nftMinted: boolean;
}

const tierLabels = {
  gold: "Gold Tier",
  base: "Base Tier",
  participation: "Participation",
};

const tierColors = {
  gold: "#FACC15",
  base: "#C0C0C0",
  participation: "#CD7F32",
};

export default function ResultsScreen() {
  const { session: sessionId } = useLocalSearchParams<{ session: string }>();
  const { getAccessToken } = useAuth();
  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    apiFetch<GameResults>(`/api/sessions/${sessionId}/results`)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleShare = async () => {
    if (!results) return;
    try {
      await Share.share({
        message: `I predicted ${results.correctVotes} matchups correctly on Spotr TV! ${
          results.tier === "gold" ? "Gold Tier!" : ""
        } #SpotrTV`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#F5E642" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-8">
          <Pressable
            onPress={() => router.push("/(tabs)/arena")}
            className="w-10 h-10 rounded-full border border-[#333] items-center justify-center"
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View className="w-8 h-8 bg-[#F5E642] rounded-full items-center justify-center">
            <Eye size={16} color="#000" />
          </View>
          <View>
            <Text className="text-white font-bold text-lg">
              Session Results
            </Text>
            <Text className="text-[#888] text-xs">Your predictions</Text>
          </View>
        </View>

        {results ? (
          <View className="flex-1">
            {/* Results Card */}
            <View className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] items-center">
              <Text className="text-[#888] text-sm mb-2">
                You got
              </Text>
              <Text className="text-white text-4xl font-bold">
                {results.correctVotes}/{results.totalVotes || CAMPAIGN.matchupsPerSession}
              </Text>
              <Text className="text-[#888] text-sm mt-1 mb-4">
                correct predictions
              </Text>

              <View
                className="px-4 py-2 rounded-full"
                style={{ backgroundColor: tierColors[results.tier] + "20" }}
              >
                <Text
                  style={{ color: tierColors[results.tier] }}
                  className="font-bold text-sm"
                >
                  {tierLabels[results.tier]}
                </Text>
              </View>

              {results.rewardAmount > 0 && (
                <Text className="text-[#F5E642] text-2xl font-bold mt-4">
                  ${results.rewardAmount.toFixed(2)} USDC
                </Text>
              )}
            </View>

            {/* NFT Preview */}
            <View className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] mt-6 items-center">
              <Text className="text-white font-bold mb-2">
                {results.tier === "participation"
                  ? "Your NFT"
                  : "Blind Box NFT"}
              </Text>
              {results.nftMinted ? (
                <Pressable onPress={() => router.push("/(tabs)/rewards")}>
                  <Text className="text-[#F5E642] text-sm underline">
                    View in your collection
                  </Text>
                </Pressable>
              ) : (
                <Text className="text-[#888] text-sm">
                  Your Blind Box will be minted soon!
                </Text>
              )}
            </View>

            {/* DRiP Collectible */}
            <View className="bg-[#1A1A1A] rounded-2xl p-5 border border-purple-500/20 mt-4 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center">
                <Gift size={20} color="#A855F6" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-bold">
                  You earned a DRiP collectible!
                </Text>
                <Text className="text-[#888] text-xs">
                  A participation collectible will be distributed via DRiP.
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View className="mt-auto pt-6 gap-3 pb-6">
              <Button
                title="Share Results"
                variant="secondary"
                size="lg"
                onPress={handleShare}
              />
              <Button
                title="Back to Arena"
                size="lg"
                onPress={() => router.push("/(tabs)/arena")}
              />
            </View>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[#888] text-sm">
              No results found for this session.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
