import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";

import { isDailyPromptResponse } from "../src/dailyPrompt";
import { ThemeProvider, useTheme } from "../src/themeContext";
import { WalletProvider } from "../src/walletContext";

function ThemedStack() {
  const { mode, colors } = useTheme();

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
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="capture" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <WalletProvider>
        <ThemedStack />
      </WalletProvider>
    </ThemeProvider>
  );
}
