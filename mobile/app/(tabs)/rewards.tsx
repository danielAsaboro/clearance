import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  Eye,
  Gift,
  ExternalLink,
  Loader,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { BlindBoxCard } from "@/components/BlindBoxCard";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Button } from "@/components/Button";
import type { GameResultNFT } from "@shared/types";

type RaffleStatus = "idle" | "requesting" | "polling" | "resolved";

export default function RewardsScreen() {
  const { walletAddress: walletAddr } = useAuth();
  const { signAndSend, connected: walletConnected } = useWallet();
  const [results, setResults] = useState<GameResultNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [raffleStatus, setRaffleStatus] = useState<
    Record<string, RaffleStatus>
  >({});
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>(
    {}
  );

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const userData = await apiFetch<{ id: string }>("/api/users");
        const fullData = await apiFetch<{ gameResults: GameResultNFT[] }>(
          `/api/users/${userData.id}`
        );
        setResults(fullData.gameResults || []);
      } catch {}
      setLoading(false);
    };
    fetchRewards();
  }, []);

  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  const pollRaffleStatus = useCallback((gameResultId: string) => {
    if (pollTimers.current[gameResultId]) {
      clearInterval(pollTimers.current[gameResultId]);
    }

    pollTimers.current[gameResultId] = setInterval(async () => {
      try {
        const { resolved, rewardAmount } = await apiFetch<{
          resolved: boolean;
          rewardAmount: number;
        }>(`/api/nft/raffle/status?gameResultId=${gameResultId}`);

        if (resolved) {
          clearInterval(pollTimers.current[gameResultId]);
          delete pollTimers.current[gameResultId];

          setRaffleStatus((prev) => ({
            ...prev,
            [gameResultId]: "resolved",
          }));
          setResults((prev) =>
            prev.map((r) =>
              r.id === gameResultId ? { ...r, rewardAmount } : r
            )
          );
        }
      } catch {}
    }, 3000);
  }, []);

  const handleOpenBox = async (gameResultId: string) => {
    setRaffleStatus((prev) => ({
      ...prev,
      [gameResultId]: "requesting",
    }));

    try {
      const { unsignedTx } = await apiFetch<{ unsignedTx: string }>(
        "/api/nft/raffle",
        {
          method: "POST",
          body: { gameResultId },
        }
      );

      // Sign and send the raffle transaction
      await signAndSend(unsignedTx);

      setRaffleStatus((prev) => ({
        ...prev,
        [gameResultId]: "polling",
      }));
      pollRaffleStatus(gameResultId);
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Failed to open box",
        text2: "Please try again",
      });
      setRaffleStatus((prev) => ({ ...prev, [gameResultId]: "idle" }));
    }
  };

  const handleReveal = async (gameResultId: string) => {
    try {
      const { rewardAmount } = await apiFetch<{ rewardAmount: number }>(
        "/api/nft/reveal",
        {
          method: "POST",
          body: { gameResultId },
        }
      );

      setResults((prev) =>
        prev.map((r) =>
          r.id === gameResultId
            ? { ...r, nftRevealed: true, rewardAmount }
            : r
        )
      );
      setRaffleStatus((prev) => {
        const next = { ...prev };
        delete next[gameResultId];
        return next;
      });
    } catch {}
  };

  const handleClaim = async (gameResultId: string) => {
    try {
      const res = await apiFetch<{
        transaction?: string;
        claimTxHash?: string;
      }>("/api/nft/claim", {
        method: "POST",
        body: { gameResultId },
      });

      if (res.claimTxHash) {
        // Already claimed
        setResults((prev) =>
          prev.map((r) =>
            r.id === gameResultId
              ? { ...r, usdcClaimed: true, claimTxHash: res.claimTxHash! }
              : r
          )
        );
        return;
      }

      // Sign and send the claim transaction
      const signature = await signAndSend(res.transaction!);

      setResults((prev) =>
        prev.map((r) =>
          r.id === gameResultId
            ? { ...r, usdcClaimed: true, claimTxHash: signature }
            : r
        )
      );

      Toast.show({
        type: "success",
        text1: "USDC Claimed!",
        text2: "Reward sent to your wallet",
      });
    } catch (err) {
      Toast.show({
        type: "error",
        text1: "Claim failed",
        text2: "Please try again",
      });
    }
  };

  const blindBoxResults = results.filter(
    (r) => r.nftMinted && (r.tier === "base" || r.tier === "gold")
  );
  const participationResults = results.filter(
    (r) => r.nftMinted && r.tier === "participation"
  );

  const walletAddress = walletAddr;

  return (
    <SafeAreaView className="flex-1 bg-black">
      <ScrollView className="flex-1 px-6 pt-6 pb-12">
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
            <Text className="text-white font-bold text-lg">My Rewards</Text>
            <Text className="text-[#888] text-xs">Blind Box Collection</Text>
          </View>
        </View>

        {/* Wallet */}
        <View className="mb-6">
          <ConnectWallet address={walletAddress} />
        </View>

        {loading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#F5E642" />
          </View>
        ) : blindBoxResults.length === 0 &&
          participationResults.length === 0 ? (
          <View className="items-center py-16">
            <Gift size={64} color="#555" />
            <Text className="text-white font-bold text-lg mb-2 mt-4">
              No NFTs Yet
            </Text>
            <Text className="text-[#888] text-sm mb-6 text-center">
              Play a live session to earn NFT rewards!
            </Text>
            <Button
              title="Go to Arena"
              onPress={() => router.push("/(tabs)/arena")}
            />
          </View>
        ) : (
          <>
            {blindBoxResults.map((result) => {
              const status = raffleStatus[result.id] ?? "idle";
              const needsRaffle = !result.nftRevealed && status === "idle";
              const isPolling = status === "polling";
              const isRequesting = status === "requesting";
              const isResolved = status === "resolved";

              return (
                <View key={result.id} className="mb-6">
                  <Text className="text-[#888] text-xs mb-2">
                    {result.session?.title || "Session"} -- Week{" "}
                    {result.session?.weekNumber}
                  </Text>

                  {/* Polling overlay */}
                  {(isRequesting || isPolling) && (
                    <View className="mb-3 bg-[#1A1A1A] rounded-xl p-4 border border-[#F5E642]/20 flex-row items-center gap-3">
                      <ActivityIndicator size="small" color="#F5E642" />
                      <View>
                        <Text className="text-white text-sm font-medium">
                          {isRequesting
                            ? "Submitting raffle transaction..."
                            : "Resolving randomness on-chain..."}
                        </Text>
                        {isPolling && (
                          <Text className="text-[#888] text-xs">
                            This usually takes ~3 seconds
                          </Text>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Resolved */}
                  {isResolved && !result.nftRevealed && (
                    <View className="mb-3 bg-[#1A1A1A] rounded-xl p-4 border border-green-500/20">
                      <Text className="text-green-400 text-sm font-medium mb-2">
                        Raffle resolved! Your reward: $
                        {result.rewardAmount.toFixed(2)} USDC
                      </Text>
                      <Button
                        title="Reveal NFT"
                        onPress={() => handleReveal(result.id)}
                      />
                    </View>
                  )}

                  {/* Open Box button */}
                  {needsRaffle && (
                    <View className="mb-3">
                      <Button
                        title="Open Box"
                        onPress={() => handleOpenBox(result.id)}
                      />
                    </View>
                  )}

                  <BlindBoxCard
                    gameResultId={result.id}
                    tier={result.tier as "base" | "gold"}
                    rewardAmount={result.rewardAmount}
                    revealed={result.nftRevealed}
                    tokenId={result.nftTokenId}
                    onReveal={handleReveal}
                    usdcClaimed={result.usdcClaimed}
                    claimTxHash={result.claimTxHash}
                    onClaim={handleClaim}
                  />
                </View>
              );
            })}

            {/* Participation NFTs */}
            {participationResults.length > 0 && (
              <View className="mt-8">
                <Text className="text-white font-bold text-sm mb-4">
                  Participation NFTs
                </Text>
                {participationResults.map((result) => (
                  <View
                    key={result.id}
                    className="bg-[#1A1A1A] rounded-2xl p-5 border border-[#2A2A2A] mb-4"
                  >
                    <Text className="text-[#888] text-xs mb-1">
                      {result.session?.title || "Session"} -- Week{" "}
                      {result.session?.weekNumber}
                    </Text>
                    <Text className="text-white font-bold text-sm mb-2">
                      Participation NFT
                    </Text>
                    {result.nftTokenId && (
                      <Pressable
                        onPress={() =>
                          Linking.openURL(
                            `https://explorer.solana.com/address/${result.nftTokenId}?cluster=devnet`
                          )
                        }
                        className="flex-row items-center gap-1.5"
                      >
                        <ExternalLink size={12} color="#F5E642" />
                        <Text className="text-[#F5E642] text-xs">
                          View on Solana Explorer
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
