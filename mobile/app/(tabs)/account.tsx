import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  User,
  Mail,
  Wallet,
  LogOut,
  ChevronRight,
  Coins,
  Smartphone,
  Unlink,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { UserProfile } from "@shared/types";

export default function AccountScreen() {
  const { user, authenticated, logout, login, email: authEmail, walletAddress: walletAddr } = useAuth();
  const {
    walletType,
    publicKey: mwaPublicKey,
    connectMWA,
    disconnectMWA,
    mwaAvailable,
  } = useWallet();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingMWA, setConnectingMWA] = useState(false);

  useEffect(() => {
    if (!authenticated) {
      setLoading(false);
      return;
    }

    apiFetch<UserProfile>("/api/users")
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authenticated]);

  if (!authenticated) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
        <User size={48} color="#555" />
        <Text className="text-white text-xl font-bold mt-4 mb-2">
          Not Signed In
        </Text>
        <Text className="text-[#888] text-sm mb-6 text-center">
          Sign in to view your account and manage your profile.
        </Text>
        <Button title="Sign In" size="lg" onPress={login} />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#F5E642" />
      </SafeAreaView>
    );
  }

  const walletAddress = profile?.walletAddress ?? walletAddr ?? null;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 px-6 pt-6 pb-12">
        <Text className="text-white font-bold text-2xl mb-6">Account</Text>

        {/* Profile Card */}
        <Card variant="bordered" className="mb-4">
          <View className="flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-[#2A2A2A] items-center justify-center overflow-hidden">
              {profile?.profilePhoto ? (
                <Image
                  source={{ uri: profile.profilePhoto }}
                  className="w-16 h-16"
                />
              ) : (
                <User size={32} color="#555" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">
                {profile?.displayName || "Player"}
              </Text>
              <Text className="text-[#888] text-sm">
                {profile?.categories?.length || 0} categories selected
              </Text>
            </View>
          </View>
        </Card>

        {/* Email */}
        <Card variant="bordered" className="mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
              <Mail size={20} color="#F5E642" />
            </View>
            <View className="flex-1">
              <Text className="text-[#888] text-xs">Email</Text>
              <Text className="text-white text-sm">
                {profile?.email || authEmail || "Not set"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Wallet */}
        <Card variant="bordered" className="mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
              <Wallet size={20} color="#F5E642" />
            </View>
            <View className="flex-1">
              <Text className="text-[#888] text-xs">Wallet</Text>
              {walletAddress ? (
                <ConnectWallet address={walletAddress} />
              ) : (
                <Text className="text-[#555] text-sm">Not connected</Text>
              )}
            </View>
          </View>
        </Card>

        {/* External Wallet (MWA) */}
        {mwaAvailable && (
          <Card variant="bordered" className="mb-4">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
                <Smartphone size={20} color="#F5E642" />
              </View>
              <View className="flex-1">
                <Text className="text-[#888] text-xs">External Wallet</Text>
                {walletType === "mwa" && mwaPublicKey ? (
                  <View>
                    <Text className="text-white text-sm" numberOfLines={1}>
                      {mwaPublicKey.slice(0, 4)}...{mwaPublicKey.slice(-4)}
                    </Text>
                    <Text className="text-green-400 text-xs">Active</Text>
                  </View>
                ) : (
                  <Text className="text-[#555] text-sm">
                    Connect via Phantom, Solflare, etc.
                  </Text>
                )}
              </View>
              {walletType === "mwa" ? (
                <Pressable
                  onPress={() => {
                    disconnectMWA();
                    Toast.show({
                      type: "info",
                      text1: "External wallet disconnected",
                    });
                  }}
                  className="px-3 py-2 rounded-lg bg-[#2A2A2A]"
                >
                  <Unlink size={16} color="#888" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={async () => {
                    setConnectingMWA(true);
                    try {
                      await connectMWA();
                      Toast.show({
                        type: "success",
                        text1: "Wallet connected!",
                        text2: "External wallet is now active",
                      });
                    } catch (err) {
                      Toast.show({
                        type: "error",
                        text1: "Connection failed",
                        text2:
                          err instanceof Error
                            ? err.message
                            : "Make sure a Solana wallet app is installed",
                      });
                    }
                    setConnectingMWA(false);
                  }}
                  disabled={connectingMWA}
                  className="px-4 py-2 rounded-lg bg-[#F5E642]"
                >
                  {connectingMWA ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text className="text-black text-xs font-bold">
                      Connect
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
          </Card>
        )}

        {/* Test USDC */}
        <Pressable
          onPress={() => router.push("/(tabs)/mint")}
          className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A] mb-4 flex-row items-center gap-3"
        >
          <View className="w-10 h-10 bg-[#2A2A2A] rounded-xl items-center justify-center">
            <Coins size={20} color="#F5E642" />
          </View>
          <View className="flex-1">
            <Text className="text-white text-sm font-medium">
              Get Test USDC
            </Text>
            <Text className="text-[#888] text-xs">Mint devnet USDC</Text>
          </View>
          <ChevronRight size={20} color="#555" />
        </Pressable>

        {/* Sign Out */}
        <Pressable
          onPress={logout}
          className="bg-[#1A1A1A] rounded-xl p-4 border border-red-500/20 flex-row items-center gap-3 mt-4"
        >
          <View className="w-10 h-10 bg-red-500/10 rounded-xl items-center justify-center">
            <LogOut size={20} color="#EF4444" />
          </View>
          <Text className="text-red-400 text-sm font-medium">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
