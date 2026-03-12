import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  Eye,
  Trophy,
  TrendingUp,
  Target,
} from "lucide-react-native";
import { apiFetch } from "@/lib/api";

interface PlayerRanking {
  rank: number;
  userId: string;
  displayName: string;
  profilePhoto: string | null;
  correctPredictions: number;
  totalVotes: number;
  sessionsPlayed: number;
  winRate: number;
}

const rankBadge = (rank: number) => {
  if (rank === 1)
    return { bg: "#FACC15", text: "#000", label: "1st" };
  if (rank === 2)
    return { bg: "#D1D5DB", text: "#000", label: "2nd" };
  if (rank === 3)
    return { bg: "#B45309", text: "#FFF", label: "3rd" };
  return { bg: "#2A2A2A", text: "#888", label: `${rank}` };
};

export default function LeaderboardScreen() {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PlayerRanking[]>("/api/leaderboard")
      .then(setRankings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item: player }: { item: PlayerRanking }) => {
    const badge = rankBadge(player.rank);
    return (
      <View
        className={`bg-[#1A1A1A] rounded-xl p-4 mb-2 flex-row items-center gap-3 border ${
          player.rank <= 3 ? "border-[#F5E642]/20" : "border-[#2A2A2A]"
        }`}
      >
        {/* Rank */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: badge.bg }}
        >
          <Text style={{ color: badge.text }} className="text-xs font-bold">
            {badge.label}
          </Text>
        </View>

        {/* Avatar */}
        <View className="w-10 h-10 rounded-full bg-[#2A2A2A] overflow-hidden items-center justify-center">
          {player.profilePhoto ? (
            <Image
              source={{ uri: player.profilePhoto }}
              className="w-10 h-10"
            />
          ) : (
            <Text className="text-[#555] font-bold">
              {player.displayName.charAt(0)}
            </Text>
          )}
        </View>

        {/* Info */}
        <View className="flex-1">
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {player.displayName}
          </Text>
          <Text className="text-[#888] text-xs">
            {player.sessionsPlayed} session
            {player.sessionsPlayed !== 1 ? "s" : ""} played
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row items-center gap-3">
          <View className="items-center">
            <View className="flex-row items-center gap-1">
              <TrendingUp size={12} color="#F5E642" />
              <Text className="text-white text-sm font-bold">
                {player.correctPredictions}
              </Text>
            </View>
            <Text className="text-[#555] text-[10px]">correct</Text>
          </View>
          <View className="items-center">
            <View className="flex-row items-center gap-1">
              <Target size={12} color="#22C55E" />
              <Text className="text-white text-sm font-bold">
                {player.winRate}%
              </Text>
            </View>
            <Text className="text-[#555] text-[10px]">win rate</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row items-center gap-3 mb-6">
          <Pressable
            onPress={() => router.push("/")}
            className="w-10 h-10 rounded-full border border-[#333] items-center justify-center"
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View className="w-8 h-8 bg-[#F5E642] rounded-full items-center justify-center">
            <Eye size={16} color="#000" />
          </View>
          <View>
            <Text className="text-white font-bold text-lg">
              Player Leaderboard
            </Text>
            <Text className="text-[#888] text-xs">
              Top predictors this season
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F5E642" />
          </View>
        ) : rankings.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Trophy size={64} color="#555" />
            <Text className="text-white font-bold text-lg mb-2 mt-4">
              No Rankings Yet
            </Text>
            <Text className="text-[#888] text-sm text-center">
              Rankings appear after the first session is finalized.
            </Text>
          </View>
        ) : (
          <>
            {/* Top 3 Podium */}
            {rankings.length >= 3 && (
              <View className="flex-row gap-2 mb-8 items-end justify-center">
                {[rankings[1], rankings[0], rankings[2]].map((player, i) => {
                  const isCenter = i === 1;
                  const badge = rankBadge(player.rank);
                  return (
                    <View
                      key={player.userId}
                      className="items-center flex-1"
                      style={{ marginTop: isCenter ? 0 : 16 }}
                    >
                      <View
                        className="w-14 h-14 rounded-full overflow-hidden items-center justify-center mb-2"
                        style={{
                          borderWidth: 2,
                          borderColor: badge.bg,
                          backgroundColor: "#1A1A1A",
                          width: isCenter ? 64 : 56,
                          height: isCenter ? 64 : 56,
                        }}
                      >
                        {player.profilePhoto ? (
                          <Image
                            source={{ uri: player.profilePhoto }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        ) : (
                          <Text className="text-[#888] font-bold text-lg">
                            {player.displayName.charAt(0)}
                          </Text>
                        )}
                      </View>
                      <Text
                        className="text-white text-xs font-bold text-center"
                        numberOfLines={1}
                      >
                        {player.displayName}
                      </Text>
                      <Text className="text-[#F5E642] text-xs font-bold">
                        {player.correctPredictions} correct
                      </Text>
                      <View
                        className="mt-1 px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: badge.bg }}
                      >
                        <Text
                          style={{ color: badge.text }}
                          className="text-xs font-bold"
                        >
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Full List */}
            <FlatList
              data={rankings}
              renderItem={renderItem}
              keyExtractor={(item) => item.userId}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
