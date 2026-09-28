import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";

import { isDailyPromptResponse } from "../src/dailyPrompt";
import { WalletProvider } from "../src/walletContext";

export default function RootLayout() {
  // Tapping the daily-prompt notification should open the capture screen
  // directly, both from a warm app (listener) and a cold start (the tap is
  // what launched the app, so it's already sitting there waiting to be
  // read on mount).
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (isDailyPromptResponse(response)) {
        router.push("/capture");
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isDailyPromptResponse(response)) {
        router.push("/capture");
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <WalletProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0d0d12" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#0d0d12" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="capture" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      </Stack>
    </WalletProvider>
  );
}
