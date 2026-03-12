import { useState } from "react";
import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import {
  ArrowLeft,
  Eye,
  CheckCircle,
  Copy,
  Check,
  PartyPopper,
  ArrowRight,
} from "lucide-react-native";
import { ProgressBar } from "@/components/ProgressBar";
import { Button } from "@/components/Button";
import { useOnboarding } from "@/lib/onboarding-context";
import { apiFetch, API_URL } from "@/lib/api";

const TOTAL_STEPS = 4;

const terms = [
  "I understand Spotr TV is a platform for predicting trending content",
  "I will participate in good faith during live voting sessions",
  "I understand that rewards are based on prediction accuracy and participation",
  "I acknowledge that Spotr TV does not guarantee specific reward amounts",
];

export default function CompleteStep() {
  const { data, updateData, resetData } = useOnboarding();
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        role: "player" as const,
        categories: data.categories,
        email: data.email || undefined,
        displayName: data.displayName,
        profilePhoto: data.profilePhoto || undefined,
        consentAccepted: data.consentAccepted,
      };

      const result = await apiFetch<{ referralCode: string }>("/api/onboard", {
        method: "POST",
        body,
      });

      setReferralCode(result.referralCode);
      setSubmitted(true);

      // Record referral (non-fatal)
      try {
        await apiFetch("/api/referrals", { method: "POST" });
      } catch {}
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Registration failed",
        text2: "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(`${API_URL}/ref/${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Toast.show({ type: "success", text1: "Copied!", visibilityTime: 1500 });
  };

  const handleGoToArena = () => {
    resetData();
    router.replace("/(tabs)/arena");
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {!submitted ? (
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
              STEP {TOTAL_STEPS} OF {TOTAL_STEPS}
            </Text>
          </View>

          <ProgressBar currentStep={TOTAL_STEPS} totalSteps={TOTAL_STEPS} />

          <View className="mt-8">
            <Text className="text-2xl font-bold text-white">
              Disclaimer & Consent
            </Text>
            <Text className="text-[#888] text-sm mt-1">
              Please review and accept the following terms
            </Text>
          </View>

          <View className="bg-[#1A1A1A] rounded-2xl p-6 mt-8 border border-[#2A2A2A]">
            {terms.map((term, i) => (
              <View key={i} className="flex-row items-start gap-3 mb-4">
                <CheckCircle size={20} color="#F5E642" />
                <Text className="text-[#ccc] text-sm flex-1">{term}</Text>
              </View>
            ))}
          </View>

          {/* Consent Toggle */}
          <View className="bg-[#1A1A1A] rounded-2xl px-5 py-4 mt-4 flex-row items-center justify-between border border-[#2A2A2A]">
            <Text className="text-white text-sm font-medium">
              I accept the terms above
            </Text>
            <Switch
              value={data.consentAccepted}
              onValueChange={(val) => updateData({ consentAccepted: val })}
              trackColor={{ false: "#333", true: "#F5E642" }}
              thumbColor="#fff"
            />
          </View>

          {/* Summary */}
          <View className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] mt-4">
            <Text className="text-[#888] text-xs uppercase tracking-wider mb-3">
              Summary
            </Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-[#888] text-sm">Role</Text>
                <Text className="text-white text-sm">Player</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[#888] text-sm">Name</Text>
                <Text className="text-white text-sm">{data.displayName}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[#888] text-sm">Categories</Text>
                <Text className="text-white text-sm">
                  {data.categories.length} selected
                </Text>
              </View>
            </View>
          </View>

          <View className="py-6">
            <Button
              title={submitting ? "Submitting..." : "Complete Registration"}
              size="lg"
              disabled={!data.consentAccepted || submitting}
              loading={submitting}
              onPress={handleSubmit}
            />
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 bg-[#F5E642]/20 rounded-full items-center justify-center mb-6">
            <PartyPopper size={40} color="#F5E642" />
          </View>

          <Text className="text-2xl font-bold text-white mb-2">
            You're In!
          </Text>
          <Text className="text-[#888] text-sm mb-8">
            Welcome to Spotr TV. Your account is ready.
          </Text>

          {/* Referral Code */}
          <View className="bg-[#1A1A1A] rounded-2xl p-6 border border-[#2A2A2A] w-full">
            <Text className="text-[#888] text-xs uppercase tracking-wider mb-2">
              Your Referral Code
            </Text>
            <View className="flex-row items-center gap-3">
              <Text className="text-[#F5E642] text-lg font-bold flex-1">
                {referralCode}
              </Text>
              <Pressable
                onPress={handleCopy}
                className="w-10 h-10 rounded-xl bg-[#2A2A2A] items-center justify-center"
              >
                {copied ? (
                  <Check size={16} color="#F5E642" />
                ) : (
                  <Copy size={16} color="#888" />
                )}
              </Pressable>
            </View>
            <Text className="text-[#555] text-xs mt-2">
              Share this to invite others
            </Text>
          </View>

          <View className="w-full mt-8">
            <Button title="Go to Arena" size="lg" onPress={handleGoToArena} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
