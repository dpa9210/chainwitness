import { Stack } from "expo-router";

import { WalletProvider } from "../src/walletContext";

export default function RootLayout() {
  return (
    <WalletProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0d0d12" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#0d0d12" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "ChainWitness" }} />
        <Stack.Screen name="capture" options={{ title: "New Post" }} />
      </Stack>
    </WalletProvider>
  );
}
