import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

import { WalletProvider } from "../src/walletContext";

export default function RootLayout() {
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
