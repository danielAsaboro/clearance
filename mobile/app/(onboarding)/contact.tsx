import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Eye, Mail, Wallet, Check } from "lucide-react-native";
import { ProgressBar } from "@/components/ProgressBar";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useOnboarding } from "@/lib/onboarding-context";
import { useAuth, getUserEmail, getUserWallet } from "@/lib/auth";

const TOTAL_STEPS = 4;

export default function ContactStep() {
  const { user } = useAuth();
  const { data, updateData } = useOnboarding();
  const [emailInput, setEmailInput] = useState(data.email);

  const userEmail = getUserEmail(user);
  const userWallet = getUserWallet(user);
  const hasEmail = !!userEmail;
  const hasWallet = !!userWallet;

  const handleEmailChange = (text: string) => {
    setEmailInput(text);
    updateData({ email: text });
  };

  const handleContinue = () => {
    if (hasEmail && !data.email) {
      updateData({ email: userEmail! });
    }
    router.push("/(onboarding)/profile");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-6">
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
            STEP 2 OF {TOTAL_STEPS}
          </Text>
        </View>

        <ProgressBar currentStep={2} totalSteps={TOTAL_STEPS} />

        <View className="mt-8">
          <Text className="text-2xl font-bold text-white">Contact Info</Text>
          <Text className="text-[#888] text-sm mt-1">
            Help us keep you connected with updates and rewards.
          </Text>

          <View className="gap-4 mt-8">
            {/* Email section */}
            <View className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
                  <Mail size={20} color="#F5E642" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">
                    Email Address
                  </Text>
                  <Text className="text-[#888] text-xs">
                    For session reminders & results
                  </Text>
                </View>
                {hasEmail && <Check size={20} color="#F5E642" />}
              </View>
              {hasEmail ? (
                <View className="bg-[#111] rounded-xl px-4 py-3">
                  <Text className="text-[#888] text-sm">
                    {userEmail}
                  </Text>
                </View>
              ) : (
                <Input
                  placeholder="you@example.com"
                  value={emailInput}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            </View>

            {/* Wallet section */}
            <View className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A]">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
                  <Wallet size={20} color="#F5E642" />
                </View>
                <View className="flex-1">
                  <Text className="text-white text-sm font-medium">Wallet</Text>
                  <Text className="text-[#888] text-xs">
                    For on-chain rewards & NFTs
                  </Text>
                </View>
                {hasWallet && <Check size={20} color="#F5E642" />}
              </View>
              {hasWallet ? (
                <View className="bg-[#111] rounded-xl px-4 py-3">
                  <Text
                    className="text-[#888] text-sm font-mono"
                    numberOfLines={1}
                  >
                    {userWallet}
                  </Text>
                </View>
              ) : (
                <View className="bg-[#111] rounded-xl px-4 py-3">
                  <Text className="text-[#555] text-sm">
                    Wallet will be created on login
                  </Text>
                </View>
              )}
            </View>

            {hasEmail && hasWallet && (
              <View className="bg-[#F5E642]/10 rounded-xl p-4 border border-[#F5E642]/20">
                <Text className="text-[#F5E642] text-sm font-medium">
                  All set! Both your email and wallet are connected.
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className="px-6 pb-6">
        <Button title="Continue" size="lg" onPress={handleContinue} />
      </View>
    </SafeAreaView>
  );
}
