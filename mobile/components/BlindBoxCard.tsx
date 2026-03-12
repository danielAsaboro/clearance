import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Linking } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { Gift, Sparkles, ExternalLink } from "lucide-react-native";

interface BlindBoxCardProps {
  gameResultId: string;
  tier: "base" | "gold";
  rewardAmount: number;
  revealed: boolean;
  tokenId: string | null;
  onReveal: (gameResultId: string) => Promise<void>;
  usdcClaimed?: boolean;
  claimTxHash?: string | null;
  onClaim?: (gameResultId: string) => Promise<void>;
}

const tierColors = {
  base: {
    border: "#F5E642",
    text: "#F5E642",
    label: "Base Tier",
  },
  gold: {
    border: "#FACC15",
    text: "#FACC15",
    label: "Gold Tier",
  },
};

export function BlindBoxCard({
  gameResultId,
  tier,
  rewardAmount,
  revealed,
  onReveal,
  usdcClaimed = false,
  claimTxHash,
  onClaim,
}: BlindBoxCardProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const rotation = useSharedValue(revealed ? 180 : 0);
  const colors = tierColors[tier];

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      {
        rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg`,
      },
    ],
    backfaceVisibility: "hidden",
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      {
        rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg`,
      },
    ],
    backfaceVisibility: "hidden",
  }));

  const handleReveal = async () => {
    await onReveal(gameResultId);
    rotation.value = withTiming(180, {
      duration: 700,
      easing: Easing.inOut(Easing.ease),
    });
  };

  const handleClaim = async () => {
    if (!onClaim) return;
    setIsClaiming(true);
    try {
      await onClaim(gameResultId);
    } finally {
      setIsClaiming(false);
    }
  };

  const explorerUrl = claimTxHash
    ? `https://explorer.solana.com/tx/${claimTxHash}`
    : null;

  return (
    <View className="w-full" style={{ aspectRatio: 3 / 4 }}>
      {/* Front - Unrevealed */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: "100%",
            height: "100%",
          },
          frontStyle,
        ]}
      >
        <View
          className="flex-1 rounded-2xl border items-center justify-center p-6"
          style={{ borderColor: colors.border, backgroundColor: "#1A1A1A" }}
        >
          <Gift size={64} color={colors.text} />
          <Text className="text-white font-bold text-lg mb-1 mt-4">
            Blind Box
          </Text>
          <Text style={{ color: colors.text }} className="text-sm font-medium">
            {colors.label}
          </Text>
        </View>
      </Animated.View>

      {/* Back - Revealed */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: "100%",
            height: "100%",
          },
          backStyle,
        ]}
      >
        <View
          className="flex-1 rounded-2xl border items-center justify-center p-6"
          style={{ borderColor: colors.border, backgroundColor: "#1A1A1A" }}
        >
          <Sparkles size={48} color={colors.text} />
          <Text className="text-white font-bold text-xl mb-1 mt-4">
            Revealed!
          </Text>
          <Text
            style={{ color: colors.text }}
            className="text-3xl font-bold my-4"
          >
            ${rewardAmount.toFixed(2)}
          </Text>
          <Text className="text-[#888] text-sm">USDC Reward</Text>
          <Text
            style={{ color: colors.text }}
            className="text-xs mt-2 uppercase tracking-wider mb-4"
          >
            {colors.label}
          </Text>

          {rewardAmount > 0 &&
            (usdcClaimed ? (
              <Pressable
                onPress={() => explorerUrl && Linking.openURL(explorerUrl)}
                className="flex-row items-center gap-2"
              >
                <Text className="text-green-400 text-sm font-medium">
                  Claimed -- View Transaction
                </Text>
                <ExternalLink size={14} color="#22C55E" />
              </Pressable>
            ) : onClaim ? (
              <Pressable
                onPress={handleClaim}
                disabled={isClaiming}
                className={`px-6 py-3 rounded-xl bg-[#F5E642] ${
                  isClaiming ? "opacity-70" : ""
                }`}
              >
                {isClaiming ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#000" />
                    <Text className="text-black font-bold text-sm">
                      Claiming...
                    </Text>
                  </View>
                ) : (
                  <Text className="text-black font-bold text-sm">
                    Claim ${rewardAmount.toFixed(2)} USDC
                  </Text>
                )}
              </Pressable>
            ) : null)}
        </View>
      </Animated.View>
    </View>
  );
}
