import { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";

export default function ReferralHandler() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    if (code) {
      // Save referral code for later use during onboarding
      SecureStore.setItemAsync("spotr_referral_code", code)
        .then(() => {
          router.replace("/");
        })
        .catch(() => {
          router.replace("/");
        });
    } else {
      router.replace("/");
    }
  }, [code]);

  return (
    <View className="flex-1 bg-black items-center justify-center">
      <ActivityIndicator size="large" color="#F5E642" />
      <Text className="text-[#888] text-sm mt-4">Processing referral...</Text>
    </View>
  );
}
