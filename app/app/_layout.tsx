import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { router, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { ChakraPetch_700Bold, useFonts } from "@expo-google-fonts/chakra-petch";

import { isDailyPromptResponse } from "../src/dailyPrompt";
import { ThemeProvider, useTheme } from "../src/themeContext";
import { WalletProvider } from "../src/walletContext";

// Keeps the native splash screen (app.json's expo-splash-screen config —
// same wordmark, rendered as a static image since a native splash can't use
// a JS-loaded font) up until the Chakra Petch font used for that same
// wordmark in-app has actually loaded, so there's no hand-off flash from a
// system font to the real one right after launch.
SplashScreen.preventAutoHideAsync().catch(() => {});

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
  const [fontsLoaded, fontError] = useFonts({ ChakraPetch_700Bold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Render nothing (native splash stays up, per preventAutoHideAsync above)
  // until the font is ready — if it fails to load for some reason, fontError
  // still lets the app proceed rather than getting stuck on the splash
  // screen forever; the wordmark just falls back to the system font.
  if (!ready) return null;

  return (
    <ThemeProvider>
      <WalletProvider>
        <ThemedStack />
      </WalletProvider>
    </ThemeProvider>
  );
}
