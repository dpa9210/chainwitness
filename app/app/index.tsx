import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { toFriendlyMessage } from "../src/friendlyError";
import { bytesToHex } from "../src/mwaClient";
import { getBalanceSol, requestDevnetAirdrop } from "../src/solanaClient";
import { useWallet } from "../src/walletContext";

export default function HomeScreen() {
  const { account, connecting, connect, signMessage } = useWallet();
  const [signatureHex, setSignatureHex] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [airdropping, setAirdropping] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev]);

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    setCheckingBalance(true);
    try {
      const sol = await getBalanceSol(account.publicKey);
      setBalance(sol);
    } catch (err) {
      appendLog(`Balance check failed: ${String(err)}`);
    } finally {
      setCheckingBalance(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.publicKey.toBase58()]);

  // Refetch every time this screen comes into focus — covers returning
  // here after a successful post (balance just dropped by the tx fee) and
  // after topping up via an external faucet while this screen was already
  // mounted underneath. A plain useEffect on mount alone would miss both:
  // it only reacts to `account` changing, not to revisiting the screen.
  useFocusEffect(
    useCallback(() => {
      refreshBalance();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [account?.publicKey.toBase58()]),
  );

  const handleConnect = async () => {
    try {
      appendLog("Opening MWA session — launching wallet app...");
      const acct = await connect();
      appendLog(`Connected: ${acct.publicKey.toBase58()}`);
    } catch (err) {
      appendLog(`Connect failed: ${String(err)}`);
      Alert.alert("Couldn't connect", toFriendlyMessage(err));
    }
  };

  const handleAirdrop = async () => {
    if (!account) return;
    setAirdropping(true);
    try {
      appendLog("Requesting 1 devnet SOL airdrop...");
      await requestDevnetAirdrop(account.publicKey);
      appendLog("Airdrop confirmed.");
      await refreshBalance();
    } catch (err) {
      appendLog(`Airdrop failed: ${String(err)}`);
      Alert.alert("Airdrop didn't go through", toFriendlyMessage(err));
    } finally {
      setAirdropping(false);
    }
  };

  const handleSignTest = async () => {
    setSigning(true);
    try {
      const message = `CHAINWITNESS_TEST_${Date.now()}`;
      appendLog(`Requesting signature for: ${message}`);
      const sig = await signMessage(message);
      const hex = bytesToHex(sig);
      setSignatureHex(hex);
      appendLog(`Signed. Signature (hex): ${hex.slice(0, 24)}...`);
    } catch (err) {
      appendLog(`Sign failed: ${String(err)}`);
      Alert.alert("Couldn't sign", toFriendlyMessage(err));
    } finally {
      setSigning(false);
    }
  };

  const busy = connecting || signing;
  const needsFunds = balance !== null && balance <= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>
          Hardware-signed proof of presence. Devnet only.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Wallet</Text>
          <Text style={styles.value}>
            {account ? account.publicKey.toBase58() : "Not connected"}
          </Text>
        </View>

        {account && (
          <View style={styles.card}>
            <View style={styles.balanceRow}>
              <Text style={styles.label}>Devnet balance</Text>
              <Text style={styles.refreshLink} onPress={refreshBalance}>
                ↻ Refresh
              </Text>
            </View>
            <Text style={styles.value}>
              {checkingBalance
                ? "Checking…"
                : balance !== null
                  ? `${balance} SOL`
                  : "Unknown"}
            </Text>
            {needsFunds && (
              <Text style={styles.warning}>
                0 SOL — posting will fail (can't pay the transaction fee).
                Tap below to airdrop devnet SOL, or tap Refresh if you just
                topped up elsewhere.
              </Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Last test signature</Text>
          <Text style={styles.value} numberOfLines={2}>
            {signatureHex ?? "None yet"}
          </Text>
        </View>

        {(busy || airdropping) && <ActivityIndicator style={styles.spinner} />}

        <View style={styles.buttonRow}>
          <Button
            title={account ? "Reconnect" : "Connect Wallet"}
            onPress={handleConnect}
            disabled={busy}
          />
        </View>
        {account && (
          <View style={styles.buttonRow}>
            <Button
              title="Get Devnet SOL (airdrop)"
              onPress={handleAirdrop}
              disabled={airdropping}
            />
          </View>
        )}
        <View style={styles.buttonRow}>
          <Button
            title="Sign Test Message"
            onPress={handleSignTest}
            disabled={busy || !account}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="New Post →"
            onPress={() => router.push("/capture")}
            disabled={!account}
          />
        </View>

        <Text style={styles.logHeader}>Log</Text>
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d12" },
  container: { padding: 20, paddingBottom: 60 },
  subtitle: { fontSize: 13, color: "#9a9aa8", marginBottom: 20 },
  card: {
    backgroundColor: "#17171f",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  label: { color: "#7a7a88", fontSize: 12, marginBottom: 4 },
  value: { color: "#fff", fontSize: 14, fontFamily: "monospace" },
  warning: { color: "#f5a623", fontSize: 12, marginTop: 8 },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshLink: { color: "#7ab8ff", fontSize: 12 },
  spinner: { marginVertical: 12 },
  buttonRow: { marginTop: 10 },
  logHeader: {
    color: "#7a7a88",
    fontSize: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  logLine: { color: "#5f5f6e", fontSize: 11, fontFamily: "monospace", marginBottom: 4 },
});
