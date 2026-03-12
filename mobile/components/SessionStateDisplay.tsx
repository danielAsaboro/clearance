import { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import {
  Calendar,
  Clock,
  Radio,
  CheckCircle,
  Bell,
} from "lucide-react-native";

type SessionState = "future" | "today-waiting" | "live" | "ended";

interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  totalMatchups?: number;
  roundDurationSeconds?: number;
}

interface SessionStateDisplayProps {
  session: SessionData | null;
  state: SessionState;
}

export function SessionStateDisplay({
  session,
  state,
}: SessionStateDisplayProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!session || (state !== "future" && state !== "today-waiting")) return;

    const update = () => {
      const now = new Date();
      const target = new Date(session.scheduledAt);
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("Starting...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
          2,
          "0"
        )}:${String(seconds).padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session, state]);

  if (!session) {
    return (
      <View className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] items-center">
        <Clock size={48} color="#555" />
        <Text className="text-xl font-bold text-white mb-2 mt-4">
          No Upcoming Session
        </Text>
        <Text className="text-[#888] text-sm text-center">
          Check back soon for the next live session.
        </Text>
      </View>
    );
  }

  if (state === "future") {
    const date = new Date(session.scheduledAt);
    return (
      <View className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] items-center">
        <Calendar size={48} color="#F5E642" />
        <Text className="text-xl font-bold text-white mb-2 mt-4">
          {session.title}
        </Text>
        <Text className="text-[#888] text-sm mb-1">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>
        <Text className="text-[#F5E642] text-sm font-medium mb-6">
          {date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  }

  if (state === "today-waiting") {
    return (
      <View className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] items-center">
        <Text className="text-5xl font-bold text-[#F5E642] tracking-wider mb-4 font-mono">
          {countdown}
        </Text>
        <Text className="text-xl font-bold text-white mb-2">
          {session.title}
        </Text>
        <Text className="text-[#888] text-sm mb-6">
          Session starts soon. Get ready!
        </Text>
        <View className="flex-row gap-6 mb-6">
          <View className="items-center">
            <Text className="text-white font-bold">
              {session.totalMatchups ?? "--"}
            </Text>
            <Text className="text-[#888] text-xs">Rounds</Text>
          </View>
          <View className="items-center">
            <Text className="text-white font-bold">
              {session.roundDurationSeconds ?? "--"}s
            </Text>
            <Text className="text-[#888] text-xs">Per Round</Text>
          </View>
        </View>
      </View>
    );
  }

  if (state === "live") {
    return (
      <View className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#F5E642]/30 items-center">
        <View className="flex-row items-center gap-2 mb-4">
          <View className="w-3 h-3 bg-red-500 rounded-full" />
          <Text className="text-red-400 font-bold text-sm tracking-wider">
            LIVE
          </Text>
        </View>
        <Text className="text-xl font-bold text-white mb-2">
          {session.title}
        </Text>
        <Text className="text-[#888] text-sm mb-6">
          Session is happening now!
        </Text>
        <Pressable
          onPress={() =>
            router.push(`/(tabs)/arena/game?session=${session.id}`)
          }
          className="bg-[#F5E642] px-8 py-4 rounded-xl flex-row items-center gap-2"
        >
          <Radio size={20} color="#000" />
          <Text className="text-black font-bold text-base">
            Join Session Now
          </Text>
        </Pressable>
      </View>
    );
  }

  // ended
  return (
    <View className="bg-[#1A1A1A] rounded-2xl p-8 border border-[#2A2A2A] items-center">
      <CheckCircle size={48} color="#22C55E" />
      <Text className="text-xl font-bold text-white mb-2 mt-4">
        Session Complete
      </Text>
      <Text className="text-[#888] text-sm mb-6">{session.title} has ended.</Text>
      <Pressable
        onPress={() =>
          router.push(`/(tabs)/arena/results?session=${session.id}`)
        }
        className="bg-[#F5E642] px-6 py-3 rounded-xl"
      >
        <Text className="text-black font-bold text-sm">View Results</Text>
      </Pressable>
    </View>
  );
}
