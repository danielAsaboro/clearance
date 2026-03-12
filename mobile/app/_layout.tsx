import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PrivyProvider } from "@privy-io/expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as SplashScreen from "expo-splash-screen";
import { WalletProvider } from "@/lib/wallet-provider";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "@/lib/notifications";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID!;

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  // Register for push notifications on mount
  useEffect(() => {
    registerForPushNotifications();
  }, []);

  // Handle notification taps — navigate to relevant screen
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "session_reminder" && data?.sessionId) {
        router.push(
          `/(tabs)/arena/game?session=${data.sessionId}` as any
        );
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <PrivyProvider appId={PRIVY_APP_ID}>
        <QueryClientProvider client={queryClient}>
          <WalletProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#000" },
                animation: "slide_from_right",
              }}
            />
            <Toast />
          </WalletProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}
