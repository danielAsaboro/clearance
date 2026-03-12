import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Eye, Bell } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { SessionStateDisplay } from "@/components/SessionStateDisplay";
import { scheduleSessionReminder } from "@/lib/notifications";

type SessionState = "future" | "today-waiting" | "live" | "ended";

interface SessionData {
  id: string;
  weekNumber: number;
  title: string;
  scheduledAt: string;
  status: string;
  lateJoinCutoff: string | null;
  totalMatchups?: number;
  roundDurationSeconds?: number;
}

function getSessionState(session: SessionData): SessionState {
  const now = new Date();
  const scheduled = new Date(session.scheduledAt);

  if (session.status === "live") return "live";
  if (session.status === "ended") return "ended";

  const diff = scheduled.getTime() - now.getTime();
  const isToday = scheduled.toDateString() === now.toDateString();

  if (isToday && diff > 0) return "today-waiting";
  if (diff <= 0) return "live";
  return "future";
}

export default function ArenaScreen() {
  const { authenticated } = useAuth();
  const [session, setSession] = useState<SessionData | null>(null);
  const [state, setState] = useState<SessionState>("future");
  const [loading, setLoading] = useState(true);
  const [reminderSet, setReminderSet] = useState(false);
  const scheduledReminderId = useRef<string | null>(null);

  const handleReminder = useCallback(async () => {
    if (!session || reminderSet) return;
    const id = await scheduleSessionReminder(
      session.id,
      session.title,
      new Date(session.scheduledAt)
    );
    if (id) {
      scheduledReminderId.current = id;
      setReminderSet(true);
      Toast.show({
        type: "success",
        text1: "Reminder set!",
        text2: "You'll be notified 5 min before the session starts",
      });
    } else {
      Toast.show({
        type: "info",
        text1: "Session is starting very soon!",
      });
    }
  }, [session, reminderSet]);

  const fetchSession = useCallback(async () => {
    try {
      const data = await apiFetch<{
        current?: SessionData;
        next?: SessionData;
      }>("/api/sessions");
      const current = data.current || data.next || null;
      setSession(current);
      if (current) {
        setState(getSessionState(current));
      }
    } catch {
      // Failed to fetch session
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 10000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (!authenticated) return;
    // Record referral (non-fatal)
    apiFetch("/api/referrals", { method: "POST" }).catch(() => {});
  }, [authenticated]);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-6">
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
            <Text className="text-white font-bold text-lg">The Arena</Text>
            <Text className="text-[#888] text-xs">Live Voting Sessions</Text>
          </View>
        </View>

        {/* Session Display */}
        <View className="flex-1 justify-center">
          {loading ? (
            <ActivityIndicator size="large" color="#F5E642" />
          ) : (
            <>
              <SessionStateDisplay session={session} state={state} />
              {/* Remind Me button for upcoming sessions */}
              {session &&
                (state === "future" || state === "today-waiting") && (
                  <Pressable
                    onPress={handleReminder}
                    disabled={reminderSet}
                    className={`flex-row items-center justify-center gap-2 mt-4 py-3 rounded-xl border ${
                      reminderSet
                        ? "border-green-500/30 bg-green-500/10"
                        : "border-[#F5E642]/30 bg-[#F5E642]/10"
                    }`}
                  >
                    <Bell
                      size={16}
                      color={reminderSet ? "#22C55E" : "#F5E642"}
                    />
                    <Text
                      className={`text-sm font-medium ${
                        reminderSet ? "text-green-400" : "text-[#F5E642]"
                      }`}
                    >
                      {reminderSet ? "Reminder Set" : "Remind Me"}
                    </Text>
                  </Pressable>
                )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
