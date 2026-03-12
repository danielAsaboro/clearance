import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiFetch } from "./api";

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request push notification permissions and register the device token
 * with the backend. Returns the Expo push token or null.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("sessions", {
      name: "Live Sessions",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F5E642",
      sound: "default",
    });
  }

  // Get Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[notifications] No EAS project ID found");
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  // Register token with backend
  try {
    await apiFetch("/api/users/push-token", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
  } catch {
    // Non-critical — token registration can be retried later
  }

  return token;
}

/**
 * Schedule a local notification for an upcoming session.
 */
export async function scheduleSessionReminder(
  sessionId: string,
  title: string,
  scheduledAt: Date
): Promise<string | null> {
  const now = new Date();
  const triggerDate = new Date(scheduledAt.getTime() - 5 * 60_000); // 5 min before

  if (triggerDate <= now) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Session Starting Soon!",
      body: `"${title}" goes live in 5 minutes. Get ready to play!`,
      data: { sessionId, type: "session_reminder" },
      ...(Platform.OS === "android" && { channelId: "sessions" }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
    },
  });

  return id;
}

/**
 * Cancel a previously scheduled notification.
 */
export async function cancelNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}

/**
 * Add a listener for notification taps (user interacts with notification).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
