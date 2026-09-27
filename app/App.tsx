import { useState } from "react";
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

import {
  bytesToHex,
  connectWallet,
  signMessage,
  type ConnectedAccount,
} from "./src/mwaClient";

/**
 * Day 1 spike screen: prove Mobile Wallet Adapter connect + sign works
 * end-to-end on the Seeker (Seed Vault) and on a standard Android phone
 * (fallback wallet app). Nothing else in the app gets built until this
 * works reliably — see PLAN.md.
 */
export default function App() {
  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [signatureHex, setSignatureHex] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      appendLog("Opening MWA session — launching wallet app...");
      const acct = await connectWallet();
      setAccount(acct);
      appendLog(`Connected: ${acct.publicKey.toBase58()}`);
    } catch (err) {
      appendLog(`Connect failed: ${String(err)}`);
      Alert.alert("Connect failed", String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSign = async () => {
    if (!account) return;
    setBusy(true);
    try {
      const message = `CHAINWITNESS_TEST_${Date.now()}`;
      appendLog(`Requesting signature for: ${message}`);
      const sig = await signMessage(account, message);
      const hex = bytesToHex(sig);
      setSignatureHex(hex);
      appendLog(`Signed. Signature (hex): ${hex.slice(0, 24)}...`);
    } catch (err) {
      appendLog(`Sign failed: ${String(err)}`);
      Alert.alert("Sign failed", String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>ChainWitness — MWA Spike</Text>
        <Text style={styles.subtitle}>
          Day 1 goal: connect a wallet and sign a message via Mobile Wallet
          Adapter. Devnet only.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Wallet</Text>
          <Text style={styles.value}>
            {account ? account.publicKey.toBase58() : "Not connected"}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Last signature</Text>
          <Text style={styles.value} numberOfLines={2}>
            {signatureHex ?? "None yet"}
          </Text>
        </View>

        {busy && <ActivityIndicator style={styles.spinner} />}

        <View style={styles.buttonRow}>
          <Button
            title={account ? "Reconnect" : "Connect Wallet"}
            onPress={handleConnect}
            disabled={busy}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="Sign Test Message"
            onPress={handleSign}
            disabled={busy || !account}
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
  title: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#9a9aa8", marginBottom: 20 },
  card: {
    backgroundColor: "#17171f",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  label: { color: "#7a7a88", fontSize: 12, marginBottom: 4 },
  value: { color: "#fff", fontSize: 14, fontFamily: "monospace" },
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
