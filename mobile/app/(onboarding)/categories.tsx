import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Eye } from "lucide-react-native";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/Button";
import { useOnboarding } from "@/lib/onboarding-context";

const CATEGORIES = [
  "Afrobeats",
  "Nollywood",
  "Comedy Skits",
  "Fashion",
  "Food/Cooking",
  "Dance",
  "Tech",
  "Sports",
  "Education",
  "Lifestyle",
  "Beauty",
  "Motivation",
  "Music",
  "Gaming",
  "Fitness",
];

const TOTAL_STEPS = 4;

export default function CategoriesStep() {
  const { data, updateData } = useOnboarding();

  const toggleCategory = (category: string) => {
    if (data.categories.includes(category)) {
      updateData({
        categories: data.categories.filter((c) => c !== category),
      });
    } else if (data.categories.length < 5) {
      updateData({ categories: [...data.categories, category] });
    }
  };

  const canContinue = data.categories.length === 5;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 px-6 pt-6">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full border border-[#333] items-center justify-center"
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View className="w-8 h-8 bg-[#F5E642] rounded-full items-center justify-center">
            <Eye size={16} color="#000" />
          </View>
          <Text className="text-[#888] text-xs tracking-wider">
            STEP 1 OF {TOTAL_STEPS}
          </Text>
        </View>

        <ProgressBar currentStep={1} totalSteps={TOTAL_STEPS} />

        <View className="mt-8">
          <Text className="text-2xl font-bold text-white">
            Pick Your Interests
          </Text>
          <Text className="text-[#888] text-sm mt-1">
            Select exactly 5 content categories you love.
          </Text>

          <View className="flex-row items-center justify-between mt-4 mb-2">
            <Text className="text-[#888] text-xs tracking-wider uppercase">
              Categories
            </Text>
            <Text
              className={`text-xs font-medium ${
                data.categories.length === 5
                  ? "text-[#F5E642]"
                  : "text-[#888]"
              }`}
            >
              {data.categories.length} of 5 selected
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3 mt-2">
            {CATEGORIES.map((category) => {
              const selected = data.categories.includes(category);
              const isDisabled = !selected && data.categories.length >= 5;
              return (
                <Pressable
                  key={category}
                  onPress={() => toggleCategory(category)}
                  disabled={isDisabled}
                  className={`px-5 py-3 rounded-full ${
                    selected
                      ? "bg-[#F5E642]"
                      : isDisabled
                      ? "bg-[#1A1A1A] border border-[#222]"
                      : "bg-[#1A1A1A] border border-[#2A2A2A]"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selected
                        ? "text-black"
                        : isDisabled
                        ? "text-[#444]"
                        : "text-[#888]"
                    }`}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-6">
        <Button
          title="Continue"
          size="lg"
          disabled={!canContinue}
          onPress={() => router.push("/(onboarding)/contact")}
        />
      </View>
    </SafeAreaView>
  );
}
