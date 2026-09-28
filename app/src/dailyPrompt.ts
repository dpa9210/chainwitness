import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

/**
 * Daily photo-prompt notification. Deliberately a pure on-device local
 * schedule — no server-side scheduler, no push infra (see PLAN.md, "should
 * have" scope). expo-notifications handles re-arming the OS-level alarm
 * itself once a DAILY trigger is registered, so this only needs to run once
 * (on toggle-on) rather than being re-scheduled every day by our own code.
 */

const CHANNEL_ID = "daily-prompt";
const NOTIFICATION_IDENTIFIER = "chainwitness-daily-prompt";

// Prompt copy varies a little run to run so a demo video (or real daily use)
// doesn't show the exact same sentence every time.
const PROMPT_BODIES = [
  "Time to prove today happened. Capture a photo now.",
  "Today's moment, signed by your wallet. Tap to capture.",
  "One photo, hardware-signed, right now.",
  "Show today's proof — capture and sign a photo.",
];

function pickBody(): string {
  return PROMPT_BODIES[Math.floor(Math.random() * PROMPT_BODIES.length)];
}

// Foreground behavior: still show/alert even while the app is open, so a
// demo can trigger "Send test notification" and see it without backgrounding
// the app first.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Daily photo prompt",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export type PermissionOutcome = "granted" | "denied";

export async function ensurePermission(): Promise<PermissionOutcome> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return "granted";
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? "granted" : "denied";
}

/**
 * (Re-)arms the recurring daily notification at the given local hour/minute.
 * Safe to call repeatedly — it always clears any previous ChainWitness
 * schedule first, so changing the time never leaves a stale duplicate
 * behind.
 */
export async function scheduleDailyPrompt(hour: number, minute: number): Promise<void> {
  await ensureChannel();
  await cancelDailyPrompt();
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_IDENTIFIER,
    content: {
      title: "ChainWitness",
      body: pickBody(),
      data: { kind: "daily-prompt" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelDailyPrompt(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER).catch(() => {
    // Nothing scheduled yet — fine.
  });
}

export async function isDailyPromptScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === NOTIFICATION_IDENTIFIER);
}

/**
 * Fires a one-off notification a few seconds out — lets a demo (or the user)
 * see exactly what the daily prompt looks like without waiting for the
 * scheduled time to actually arrive.
 */
export async function sendTestPrompt(): Promise<void> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "ChainWitness",
      body: pickBody(),
      data: { kind: "daily-prompt" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: CHANNEL_ID,
    },
  });
}

/** True if this notification response is a tap on our daily prompt. */
export function isDailyPromptResponse(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  return response?.notification.request.content.data?.kind === "daily-prompt";
}
