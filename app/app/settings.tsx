import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";

import {
  cancelDailyPrompt,
  ensurePermission,
  scheduleDailyPrompt,
  sendTestPrompt,
} from "../src/dailyPrompt";
import { toFriendlyMessage } from "../src/friendlyError";
import { bytesToHex } from "../src/mwaClient";
import { getBalanceSol, requestDevnetAirdrop } from "../src/solanaClient";
import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";
import { useWallet } from "../src/walletContext";

const DAILY_PROMPT_ID = "chainwitness-daily-prompt";

const TIME_PRESETS: { label: string; hour: number; minute: number }[] = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "1:00 PM", hour: 13, minute: 0 },
  { label: "6:00 PM", hour: 18, minute: 0 },
  { label: "9:00 PM", hour: 21, minute: 0 },
];

function formatHourMinute(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/**
 * Wallet connection, balance/airdrop, appearance, and the debug log —
 * everything that used to live on the Home screen before the feed became
 * the app's front door. This is where you connect, top up devnet SOL,
 * switch light/dark, and see what the wallet layer is actually doing,
 * without it cluttering the feed.
 */
export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { account, connecting, connect, signMessage } = useWallet();
  const [signatureHex, setSignatureHex] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [airdropping, setAirdropping] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  // The scheduled trigger itself (read back from the OS) is the source of
  // truth for whether the daily prompt is on and at what time — no separate
  // persisted setting to fall out of sync with reality.
  const [reminderTime, setReminderTime] = useState<{ hour: number; minute: number } | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const appendLog = (line: string) =>
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev]);

  const refreshReminderState = useCallback(async () => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = scheduled.find((n) => n.identifier === DAILY_PROMPT_ID);
    const trigger = existing?.trigger;
    if (trigger && "type" in trigger && trigger.type === "daily") {
      setReminderTime({ hour: trigger.hour, minute: trigger.minute });
    } else {
      setReminderTime(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshReminderState();
    }, [refreshReminderState]),
  );

  const handleSetReminder = async (hour: number, minute: number) => {
    setReminderBusy(true);
    try {
      const outcome = await ensurePermission();
      if (outcome !== "granted") {
        appendLog("Notification permission denied.");
        Alert.alert(
          "Notifications disabled",
          "ChainWitness can't remind you without notification permission — enable it for ChainWitness in your phone's system settings.",
        );
        return;
      }
      await scheduleDailyPrompt(hour, minute);
      setReminderTime({ hour, minute });
      appendLog(`Daily reminder set for ${formatHourMinute(hour, minute)}.`);
    } catch (err) {
      appendLog(`Couldn't set reminder: ${String(err)}`);
      Alert.alert("Couldn't set reminder", toFriendlyMessage(err));
    } finally {
      setReminderBusy(false);
    }
  };

  const handleDisableReminder = async () => {
    setReminderBusy(true);
    try {
      await cancelDailyPrompt();
      setReminderTime(null);
      appendLog("Daily reminder turned off.");
    } finally {
      setReminderBusy(false);
    }
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    try {
      const outcome = await ensurePermission();
      if (outcome !== "granted") {
        Alert.alert(
          "Notifications disabled",
          "Enable notification permission for ChainWitness first.",
        );
        return;
      }
      await sendTestPrompt();
      appendLog("Test notification sent — arrives in a few seconds.");
    } catch (err) {
      appendLog(`Test notification failed: ${String(err)}`);
      Alert.alert("Couldn't send test notification", toFriendlyMessage(err));
    } finally {
      setSendingTest(false);
    }
  };

  const accountPubkeyStr = account?.publicKey.toBase58();

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
  }, [accountPubkeyStr]);

  useFocusEffect(
    useCallback(() => {
      refreshBalance();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountPubkeyStr]),
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
    // This screen keeps its native header, which already sits below the
    // status bar — only the bottom edge needs handling here (top edge
    // handling would double up with the header's own spacing).
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Wallet</Text>
          <Text style={styles.value}>
            {account ? account.publicKey.toBase58() : "Not connected"}
          </Text>
        </View>

        <Text style={styles.tip}>
          ChainWitness runs entirely on Solana Devnet. Your wallet app
          (Phantom, Solflare, etc.) has its own separate network setting —
          make sure it&apos;s also set to Devnet, or posting and tipping will
          fail with a network-mismatch error from the wallet itself.
        </Text>

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
                0 SOL — posting will fail (can&apos;t pay the transaction fee).
                Tap below to airdrop devnet SOL, or tap Refresh if you just
                topped up elsewhere.
              </Text>
            )}
          </View>
        )}

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

        <Text style={styles.sectionHeader}>Appearance</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Theme</Text>
          <View style={styles.presetRow}>
            {(["dark", "light"] as const).map((option) => {
              const active = mode === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  onPress={() => setMode(option)}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                    {option === "dark" ? "Dark" : "Light"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionHeader}>Daily reminder</Text>

        <View style={styles.card}>
          <View style={styles.balanceRow}>
            <Text style={styles.label}>
              {reminderTime
                ? `On — ${formatHourMinute(reminderTime.hour, reminderTime.minute)} daily`
                : "Off"}
            </Text>
            <Switch
              value={!!reminderTime}
              disabled={reminderBusy}
              trackColor={{ false: colors.border, true: colors.accent }}
              onValueChange={(next) => {
                if (next) {
                  const preset = TIME_PRESETS[2]; // 6:00 PM default
                  handleSetReminder(preset.hour, preset.minute);
                } else {
                  handleDisableReminder();
                }
              }}
            />
          </View>
          <Text style={styles.tip}>
            A local, on-device notification — no server involved — nudging
            you to capture and sign today&apos;s photo. Tapping it opens the
            camera directly.
          </Text>

          {reminderTime && (
            <View style={styles.presetRow}>
              {TIME_PRESETS.map((preset) => {
                const active =
                  reminderTime.hour === preset.hour && reminderTime.minute === preset.minute;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.presetChip, active && styles.presetChipActive]}
                    disabled={reminderBusy}
                    onPress={() => handleSetReminder(preset.hour, preset.minute)}
                  >
                    <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.buttonRow}>
          <Button
            title="Send test notification now"
            onPress={handleSendTest}
            disabled={sendingTest}
          />
        </View>

        <Text style={styles.sectionHeader}>About</Text>

        <View style={styles.buttonRow}>
          <Button
            title="Replay intro screen"
            onPress={() => router.push("/onboarding")}
          />
        </View>

        <Text style={styles.sectionHeader}>Debug</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Last test signature</Text>
          <Text style={styles.value} numberOfLines={2}>
            {signatureHex ?? "None yet"}
          </Text>
        </View>
        <View style={styles.buttonRow}>
          <Button
            title="Sign Test Message"
            onPress={handleSignTest}
            disabled={busy || !account}
          />
        </View>

        <Text style={styles.logHeader}>Log</Text>
        {log.length === 0 && <Text style={styles.logLine}>Nothing yet.</Text>}
        {log.map((line, i) => (
          <Text key={i} style={styles.logLine}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 20, paddingBottom: 60 },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 28,
      marginBottom: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    label: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
    value: { color: colors.text, fontSize: 14, fontFamily: "monospace" },
    warning: { color: colors.warning, fontSize: 12, marginTop: 8 },
    tip: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
    balanceRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    refreshLink: { color: colors.link, fontSize: 12 },
    presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    presetChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    presetChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    presetChipText: { color: colors.textSecondary, fontSize: 12 },
    presetChipTextActive: { color: "#ffffff", fontWeight: "700" },
    spinner: { marginVertical: 12 },
    buttonRow: { marginTop: 10 },
    logHeader: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 20,
      marginBottom: 8,
    },
    logLine: { color: colors.textMuted, fontSize: 11, fontFamily: "monospace", marginBottom: 4 },
  });
}
