import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, router } from "expo-router";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { OnboardingProvider } from "@/lib/onboarding-context";

export default function OnboardingLayout() {
  const { authenticated, isReady } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    if (!authenticated) {
      router.replace("/");
      return;
    }

    apiFetch<{ consentAccepted?: boolean }>("/api/users")
      .then((profile) => {
        if (profile?.consentAccepted) {
          router.replace("/(tabs)/arena");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [isReady, authenticated]);

  if (checking) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#F5E642" />
      </View>
    );
  }

  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#000" },
          animation: "slide_from_right",
        }}
      />
    </OnboardingProvider>
  );
}
