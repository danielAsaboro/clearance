import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  AlertCircle,
  Coins,
  ChevronRight,
  X,
  CheckCircle,
  BarChart3,
  Trophy,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { useWallet } from "@/lib/wallet";
import { connectSSE } from "@/lib/sse";
import { MatchupPicker } from "@/components/MatchupPicker";
import { ProgressBar } from "@/components/ProgressBar";
import { RoundTimer } from "@/components/RoundTimer";
import { Button } from "@/components/Button";
import type { Matchup, RoundState, GamePhase } from "@shared/types";
import { CAMPAIGN } from "@shared/constants";

const ENTRY_FEE = CAMPAIGN.entryFeeUsdc.toFixed(2);

// ---------------------------------------------------------------------------
// Entry Confirmation Modal
// ---------------------------------------------------------------------------
function EntryConfirmModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <View className="w-full bg-[#111] border border-[#222] rounded-2xl p-6 gap-5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Coins size={20} color="#F5E642" />
            <Text className="text-white font-bold text-lg">Join Session</Text>
          </View>
          <Pressable onPress={onCancel}>
            <X size={20} color="#555" />
          </Pressable>
        </View>

        <View className="bg-[#0d0d0d] rounded-xl p-4 gap-2">
          <Text className="text-white font-semibold text-sm">
            Entry Cost: ${ENTRY_FEE} USDC
          </Text>
          <Text className="text-[#888] text-sm">
            Joining this session costs{" "}
            <Text className="text-white font-medium">${ENTRY_FEE} USDC</Text>,
            which is added to the reward pool.
          </Text>
          <Text className="text-[#888] text-sm">
            You may win up to{" "}
            <Text className="text-white font-medium">${ENTRY_FEE} USDC</Text>{" "}
            back.
          </Text>
        </View>

        <View className="bg-[#0d0d0d] rounded-xl p-4 gap-2">
          <Text className="text-[#F5E642] font-semibold text-sm">
            How It Works
          </Text>
          <Text className="text-[#888] text-sm">
            Each matchup shows two videos. Pick which one will trend -- the
            majority vote determines the correct answer.
          </Text>
          <Text className="text-[#888] text-sm">
            Your accuracy determines your{" "}
            <Text className="text-white font-medium">Blind Box tier</Text>:
          </Text>
          <Text className="text-[#888] text-sm">
            Gold -- 75%+ correct{"\n"}Base -- 36%+ correct{"\n"}Participation --
            below 36%
          </Text>
        </View>

        <Button
          title="Confirm & Join"
          size="lg"
          onPress={onConfirm}
        />
        <Pressable onPress={onCancel}>
          <Text className="text-[#555] text-sm text-center">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Insufficient Balance Screen
// ---------------------------------------------------------------------------
function InsufficientBalanceScreen() {
  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <View className="items-center gap-5">
        <AlertCircle size={48} color="#F87171" />
        <View className="items-center">
          <Text className="text-white text-xl font-bold mb-2">
            Insufficient Balance
          </Text>
          <Text className="text-[#888] text-sm text-center">
            You need at least{" "}
            <Text className="text-white font-medium">${ENTRY_FEE} USDC</Text> to
            join this session.
          </Text>
        </View>
        <Button
          title="Get Test USDC"
          size="lg"
          onPress={() => router.push("/(tabs)/mint")}
        />
        <Pressable onPress={() => router.back()}>
          <Text className="text-[#555] text-sm">Back to Arena</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Round Transition Interstitial
// ---------------------------------------------------------------------------
function RoundTransition({
  completedRound,
  totalRounds,
  pick,
}: {
  completedRound: number;
  totalRounds: number;
  pick: "video_a" | "video_b" | null;
}) {
  const [phase, setPhase] = useState<"tallying" | "done">("tallying");

  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <View className="items-center gap-6">
        <Text className="text-[#888] text-xs tracking-wider uppercase">
          Round {completedRound} / {totalRounds}
        </Text>

        <View className="w-20 h-20 rounded-full border-4 items-center justify-center"
          style={{ borderColor: phase === "done" ? "#F5E642" : "rgba(245,230,66,0.3)" }}
        >
          {phase === "tallying" ? (
            <BarChart3 size={32} color="#F5E642" />
          ) : (
            <CheckCircle size={40} color="#F5E642" />
          )}
        </View>

        <View className="items-center">
          <Text className="text-white font-bold text-lg">
            {phase === "tallying" ? "Tallying votes..." : "Vote recorded!"}
          </Text>
          {pick && phase === "done" && (
            <Text className="text-[#888] text-sm mt-1">
              You picked{" "}
              <Text className="text-[#F5E642] font-semibold">
                {pick === "video_a" ? "Video A" : "Video B"}
              </Text>
            </Text>
          )}
          {!pick && phase === "done" && (
            <Text className="text-[#888] text-sm mt-1">
              You didn't vote this round
            </Text>
          )}
        </View>

        {/* Progress dots */}
        <View className="flex-row gap-1.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <View
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < completedRound ? "bg-[#F5E642]" : "bg-[#333]"
              }`}
            />
          ))}
        </View>

        {completedRound < totalRounds && (
          <Text className="text-[#555] text-xs">Next matchup starting...</Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Game Over Screen
// ---------------------------------------------------------------------------
function GameOverScreen({
  sessionId,
  totalRounds,
}: {
  sessionId: string;
  totalRounds: number;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1200);
    const t2 = setTimeout(() => setStep(2), 2400);
    const t3 = setTimeout(() => {
      router.push(`/(tabs)/arena/results?session=${sessionId}`);
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [sessionId]);

  const steps = [
    "Collecting votes from all players...",
    "Calculating majority picks...",
    "Determining your rewards...",
  ];

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <View className="items-center gap-8 w-full">
        <View className="w-24 h-24 rounded-full bg-[#F5E642]/10 border-4 border-[#F5E642] items-center justify-center">
          <Trophy size={48} color="#F5E642" />
        </View>

        <View className="items-center gap-2">
          <Text className="text-white font-bold text-2xl">
            Session Complete!
          </Text>
          <Text className="text-[#888] text-sm">
            All <Text className="text-white font-semibold">{totalRounds}</Text>{" "}
            matchups finished
          </Text>
        </View>

        <View className="w-full gap-3">
          {steps.map((text, i) => (
            <View
              key={i}
              className={`flex-row items-center gap-3 ${
                step >= i ? "opacity-100" : "opacity-0"
              }`}
            >
              {step > i ? (
                <CheckCircle size={20} color="#22C55E" />
              ) : step === i ? (
                <ActivityIndicator size="small" color="#F5E642" />
              ) : (
                <View className="w-5 h-5 rounded-full border border-[#333]" />
              )}
              <Text
                className={`text-sm ${
                  step >= i ? "text-white" : "text-[#555]"
                }`}
              >
                {text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Game Content
// ---------------------------------------------------------------------------
export default function GameScreen() {
  const { session: sessionId } = useLocalSearchParams<{ session: string }>();
  const { getAccessToken } = useAuth();
  const { signAndSend } = useWallet();

  const [phase, setPhase] = useState<GamePhase>("confirming");
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [voted, setVoted] = useState<"video_a" | "video_b" | null>(null);
  const [loading, setLoading] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [muted, setMuted] = useState(true);
  const [defaultRoundDuration, setDefaultRoundDuration] = useState<
    number | null
  >(null);
  const [interstitial, setInterstitial] = useState<{
    round: number;
    totalRounds: number;
    pick: "video_a" | "video_b" | null;
  } | null>(null);

  const lastVotedRound = useRef<number>(0);
  const prevRound = useRef<number>(0);
  const lastPick = useRef<"video_a" | "video_b" | null>(null);

  // Fetch matchups list
  const fetchMatchups = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await apiFetch<{
        matchups: Matchup[];
        roundDurationSeconds: number;
      }>(`/api/sessions/${sessionId}/rounds`);
      setMatchups(data.matchups);
      setDefaultRoundDuration(data.roundDurationSeconds);
    } catch {}
    setLoading(false);
  }, [sessionId]);

  // Connect to SSE stream after joining
  useEffect(() => {
    if (phase !== "playing" || !sessionId) return;

    let token: string | null = null;
    let cleanup: (() => void) | null = null;

    (async () => {
      token = await getAccessToken();
      cleanup = connectSSE(`/api/sessions/${sessionId}/stream`, {
        token,
        onMessage: (data) => {
          const rs = data as RoundState;
          setRoundState(rs);
          if (rs.status === "ended") {
            setGameOver(true);
          }
        },
        onError: (err) => {
          console.warn("[game] SSE error:", err);
        },
      });
    })();

    return () => {
      cleanup?.();
    };
  }, [phase, sessionId, getAccessToken]);

  // Auto-advance voted state when server round changes
  useEffect(() => {
    if (!roundState) return;
    const serverRound = roundState.round;

    if (serverRound !== prevRound.current) {
      const completedRound = prevRound.current;
      prevRound.current = serverRound;

      if (completedRound > 0) {
        setInterstitial({
          round: completedRound,
          totalRounds: roundState.totalRounds,
          pick: lastPick.current,
        });
        setTimeout(() => {
          setInterstitial(null);
          setVoted(null);
          lastPick.current = null;
        }, 3000);
      } else {
        setVoted(null);
      }
    }
  }, [roundState]);

  const confirmJoin = async () => {
    if (!sessionId) return;
    setPhase("joining");

    try {
      const res = await apiFetch<{
        unsignedTx?: string;
        requiresSignature?: boolean;
      }>(`/api/sessions/${sessionId}/join`, { method: "POST" });

      // If the API returns an unsigned transaction, sign and send it
      if (res.unsignedTx && res.requiresSignature) {
        await signAndSend(res.unsignedTx);
      }
    } catch (err: any) {
      if (
        err?.body?.toLowerCase?.().includes("insufficient") ||
        err?.body?.toLowerCase?.().includes("wallet")
      ) {
        setPhase("insufficient");
        return;
      }
    }

    await fetchMatchups();
    setPhase("playing");
  };

  const handleVote = async (decision: "video_a" | "video_b") => {
    if (decision === voted) return;
    const serverRound = roundState?.round ?? 1;

    setVoted(decision);
    lastPick.current = decision;
    lastVotedRound.current = serverRound;

    const currentMatchup = matchups[serverRound - 1];
    if (!currentMatchup) return;

    try {
      await apiFetch("/api/votes", {
        method: "POST",
        body: { matchupId: currentMatchup.id, decision },
      });
    } catch {}
  };

  if (gameOver) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <GameOverScreen
          sessionId={sessionId!}
          totalRounds={roundState?.totalRounds ?? matchups.length}
        />
      </SafeAreaView>
    );
  }

  if (phase === "confirming") {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <EntryConfirmModal
          onConfirm={confirmJoin}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (phase === "insufficient") {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <InsufficientBalanceScreen />
      </SafeAreaView>
    );
  }

  if (phase === "joining" || loading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#F5E642" />
      </SafeAreaView>
    );
  }

  if (!sessionId || matchups.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
        <Text className="text-[#888] text-sm mb-4">
          No active session found.
        </Text>
        <Button title="Back to Arena" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (interstitial) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <RoundTransition
          completedRound={interstitial.round}
          totalRounds={interstitial.totalRounds}
          pick={interstitial.pick}
        />
      </SafeAreaView>
    );
  }

  const serverRound = roundState?.round ?? 1;
  const roundDuration =
    roundState?.roundDuration ??
    defaultRoundDuration ??
    CAMPAIGN.votingRoundDurationSeconds;
  const secondsRemaining = roundState?.secondsRemaining ?? roundDuration;
  const currentMatchup = matchups[serverRound - 1] ?? matchups[0];
  const totalRounds = roundState?.totalRounds ?? matchups.length;

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Top Bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[#888] text-xs tracking-wider uppercase">
            Matchup {serverRound} / {totalRounds}
          </Text>
          <View className="flex-row items-center gap-1.5 bg-[#1A1A1A] rounded-full px-3 py-1.5 border border-[#2A2A2A]">
            <BarChart3 size={16} color="#F5E642" />
            <Text className="text-white text-sm font-bold">{serverRound}</Text>
            <Text className="text-[#555] text-sm">/ {totalRounds}</Text>
          </View>
        </View>
        <View className="mb-3">
          <ProgressBar currentStep={serverRound} totalSteps={totalRounds} />
        </View>
        <RoundTimer
          secondsRemaining={secondsRemaining}
          roundDuration={roundDuration}
          active={voted === null}
        />
      </View>

      {/* Matchup Area */}
      <View className="flex-1 px-4 py-2">
        <MatchupPicker
          key={currentMatchup.id}
          videoA={currentMatchup.videoA}
          videoB={currentMatchup.videoB}
          onPick={handleVote}
          voted={voted}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
        />
      </View>
    </SafeAreaView>
  );
}
