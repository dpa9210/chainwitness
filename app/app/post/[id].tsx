import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { PublicKey } from "@solana/web3.js";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { toFriendlyMessage } from "../../src/friendlyError";
import { getCachedPost } from "../../src/feedCache";
import { OfflineBanner } from "../../src/OfflineBanner";
import { SeekerBadge } from "../../src/SeekerBadge";
import { DEFAULT_TIP_LAMPORTS, explorerUrl } from "../../src/solanaClient";
import { type ThemeColors } from "../../src/theme";
import { useTheme } from "../../src/themeContext";
import { useNetworkStatus } from "../../src/useNetworkStatus";
import { useWallet } from "../../src/walletContext";

const TIP_SOL_LABEL = (DEFAULT_TIP_LAMPORTS / 1_000_000_000).toString();

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type TipStatus = "idle" | "sending" | "sent" | "failed";

/**
 * Full-screen detail view for a single post, reached by tapping it in the
 * feed. The post comes from src/feedCache.ts (populated by the feed
 * screen) rather than a fresh fetch — see that file for why.
 */
export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = getCachedPost(id);

  const { account, tip } = useWallet();
  const [tipStatus, setTipStatus] = useState<TipStatus>("idle");
  const [tipSignature, setTipSignature] = useState<string | null>(null);
  const isOnline = useNetworkStatus();

  if (!post) {
    return (
      <SafeAreaView style={styles.safe}>
        <OfflineBanner />
        <View style={styles.centered}>
          <Text style={styles.info}>
            Couldn&apos;t find this post — go back and open it from the feed.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnPost = account?.publicKey.toBase58() === post.authorPubkey;

  const handleTip = async () => {
    if (!account) {
      Alert.alert(
        "Connect a wallet",
        "Connect a wallet in Settings before tipping.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Settings", onPress: () => router.push("/settings") },
        ],
      );
      return;
    }
    if (isOnline === false) {
      Alert.alert("You're offline", "Reconnect to send a tip.");
      return;
    }
    setTipStatus("sending");
    try {
      const sig = await tip(new PublicKey(post.authorPubkey));
      setTipSignature(sig);
      setTipStatus("sent");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setTipStatus("failed");
      Alert.alert("Tip failed", toFriendlyMessage(err));
    }
  };

  return (
    <View style={styles.safe}>
      <Image source={post.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* A translucent scrim behind the close button — full-bleed photo
          under system status bar icons needs this regardless of how
          bright or busy the photo itself is; Instagram/TikTok/Snapchat
          all do the same thing (usually as a gradient — this app has no
          gradient library, so a flat scrim stands in for one). */}
      <View style={[styles.topScrim, { height: insets.top + 64 }]} />

      {/* Only the top edge goes through SafeAreaView here — the bottom
          panel's own background handles its edge manually (below) so it
          can extend into the unsafe/gesture-nav zone instead of leaving
          a hard cutoff right where that zone begins. */}
      <SafeAreaView style={styles.overlaySafe} edges={["top"]}>
        <OfflineBanner />
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>

        <View style={styles.spacer} />

        <View style={[styles.bottomPanel, { paddingBottom: 16 + insets.bottom }]}>
          <View style={styles.authorRow}>
            <Text style={styles.author}>{shortAddress(post.authorPubkey)}</Text>
            {post.hasSgt && <SeekerBadge />}
          </View>
          <Text style={styles.timestamp}>
            {new Date(post.capturedAtMs).toLocaleString()}
          </Text>
          <Pressable onPress={() => Linking.openURL(explorerUrl(post.txSignature))}>
            <Text style={styles.link}>View proof on Solana Explorer →</Text>
          </Pressable>

          {!isOwnPost && (
            <View style={styles.tipRow}>
              <Pressable
                style={styles.tipButton}
                onPress={handleTip}
                disabled={tipStatus === "sending" || tipStatus === "sent"}
              >
                {tipStatus === "sending" ? (
                  <ActivityIndicator color="#0d0d12" />
                ) : (
                  <Ionicons
                    name={tipStatus === "sent" ? "checkmark" : "cash-outline"}
                    size={20}
                    color="#0d0d12"
                  />
                )}
                <Text style={styles.tipButtonText}>
                  {tipStatus === "sent" ? "Tipped" : `Tip ${TIP_SOL_LABEL} SOL`}
                </Text>
              </Pressable>
              {tipStatus === "sent" && tipSignature && (
                <Pressable onPress={() => Linking.openURL(explorerUrl(tipSignature))}>
                  <Text style={styles.link}>View tip →</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    overlaySafe: { flex: 1, justifyContent: "space-between" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
    info: { color: colors.text, textAlign: "center" },

    // This screen is always a photo full-bleed under overlays, so its
    // chrome (scrim, close button, bottom panel) intentionally stays on a
    // fixed dark/white-on-black scheme regardless of the app's light/dark
    // setting — the same way it would over any bright or dark photo.
    topScrim: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    closeButton: {
      margin: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    spacer: { flex: 1 },

    bottomPanel: {
      padding: 16,
      paddingTop: 40,
      gap: 4,
      backgroundColor: "rgba(13,13,18,0.55)",
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    author: { color: "#fff", fontSize: 16, fontFamily: "monospace", fontWeight: "700" },
    timestamp: { color: "#e5e5ea", fontSize: 13 },
    link: { color: "#cfe4ff", fontSize: 14, marginTop: 4 },

    tipRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14 },
    tipButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "#fff",
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    tipButtonText: { color: "#0d0d12", fontWeight: "700", fontSize: 14 },
  });
}
