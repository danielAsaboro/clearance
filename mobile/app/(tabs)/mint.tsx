import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  Wallet,
  Coins,
  CheckCircle,
  AlertCircle,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { CAMPAIGN } from "@shared/constants";

type MintStatus = "idle" | "minting" | "success" | "error";

export default function MintScreen() {
  const { authenticated, login } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mintStatus, setMintStatus] = useState<MintStatus>("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!authenticated) return;
    setLoadingBalance(true);
    try {
      const data = await apiFetch<{
        balance: number;
        walletAddress: string;
      }>("/api/usdc/balance");
      setBalance(data.balance);
      setWalletAddress(data.walletAddress);
    } catch {}
    setLoadingBalance(false);
  }, [authenticated]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const handleMint = async () => {
    setMintStatus("minting");
    setErrorMsg(null);
    setTxSignature(null);
    try {
      const data = await apiFetch<{ signature: string }>("/api/usdc/mint", {
        method: "POST",
      });
      setTxSignature(data.signature);
      setMintStatus("success");
      setTimeout(fetchBalance, 2000);
    } catch (err) {
      setMintStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  };

  if (!authenticated) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
        <Wallet size={48} color="#F5E642" />
        <Text className="text-white text-2xl font-bold mt-4 mb-2">
          Connect Wallet
        </Text>
        <Text className="text-[#888] text-sm mb-6 text-center">
          Connect your wallet to get test USDC for Spotr TV.
        </Text>
        <Button title="Sign In" size="lg" onPress={login} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6">
        {/* Header */}
        <View className="flex-row items-center gap-3 pt-4 pb-2">
          <Pressable onPress={() => router.back()}>
            <ArrowLeft size={20} color="#888" />
          </Pressable>
          <Text className="text-white text-lg font-bold">Get Test USDC</Text>
        </View>

        <View className="flex-1 gap-6 py-6">
          {/* Network badge */}
          <View className="self-start bg-[#1a1a2e] border border-[#F5E642]/30 rounded-full px-3 py-1">
            <Text className="text-[#F5E642] text-xs font-bold">
              DEVNET - TEST USDC
            </Text>
          </View>

          {/* Balance card */}
          <View className="bg-[#111] border border-[#222] rounded-2xl p-5">
            <View className="flex-row items-center gap-3 mb-1">
              <Coins size={20} color="#F5E642" />
              <Text className="text-[#888] text-sm">Your Balance</Text>
            </View>
            {loadingBalance ? (
              <View className="flex-row items-center gap-2 mt-2">
                <ActivityIndicator size="small" color="#888" />
                <Text className="text-[#555] text-sm">
                  Fetching balance...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-3xl font-bold mt-1">
                {balance !== null ? `${balance.toFixed(2)} USDC` : "--"}
              </Text>
            )}
            {walletAddress && (
              <Text
                className="text-[#555] text-xs mt-2 font-mono"
                numberOfLines={1}
              >
                {walletAddress}
              </Text>
            )}
          </View>

          {/* Info */}
          <View className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-4 gap-1">
            <Text className="text-[#888] text-sm">
              - Each mint gives you{" "}
              <Text className="text-white font-medium">10 USDC</Text>
            </Text>
            <Text className="text-[#888] text-sm">
              - Session entry costs{" "}
              <Text className="text-white font-medium">
                ${CAMPAIGN.entryFeeUsdc.toFixed(2)} USDC
              </Text>
            </Text>
            <Text className="text-[#888] text-sm">
              - Funds are on Solana Devnet and have no real value
            </Text>
            <Text className="text-[#888] text-sm">
              - Limit: 3 mints per hour
            </Text>
          </View>

          {/* Mint button */}
          {mintStatus === "success" ? (
            <View className="items-center gap-3">
              <View className="flex-row items-center gap-2">
                <CheckCircle size={20} color="#22C55E" />
                <Text className="text-green-400 font-medium">
                  10 USDC minted!
                </Text>
              </View>
              {txSignature && (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`
                    )
                  }
                >
                  <Text className="text-[#F5E642] text-xs underline">
                    View on Explorer
                  </Text>
                </Pressable>
              )}
              <Button
                title="Mint Again"
                size="lg"
                onPress={() => setMintStatus("idle")}
              />
            </View>
          ) : (
            <>
              {mintStatus === "error" && (
                <View className="flex-row items-start gap-2 bg-red-900/20 border border-red-500/30 rounded-xl p-3">
                  <AlertCircle size={16} color="#F87171" />
                  <Text className="text-red-400 text-sm flex-1">
                    {errorMsg}
                  </Text>
                </View>
              )}
              <Button
                title={
                  mintStatus === "minting" ? "Minting..." : "Mint 10 USDC"
                }
                size="lg"
                loading={mintStatus === "minting"}
                disabled={mintStatus === "minting"}
                onPress={handleMint}
              />
            </>
          )}

          {/* Link back */}
          <Pressable
            onPress={() => router.push("/(tabs)/arena")}
            className="items-center"
          >
            <Text className="text-[#555] text-sm">Back to Arena</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
