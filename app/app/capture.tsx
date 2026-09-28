import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { submitPostToFeed } from "../src/api";
import { buildSignedMessage, hashAndEncodePhoto } from "../src/contentHash";
import { toFriendlyMessage } from "../src/friendlyError";
import { confirmTransaction, explorerUrl } from "../src/solanaClient";
import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";
import { useWallet } from "../src/walletContext";
import { withTimeout } from "../src/withTimeout";

const POST_TIMEOUT_MS = 90_000;

type Stage = "camera" | "processing" | "confirming" | "done";
type FeedStatus = "idle" | "uploading" | "uploaded" | "failed";

/**
 * Capture a photo in-app (no gallery picker — the whole point is that the
 * timestamp is honest), hash it locally, and submit a devnet transaction
 * carrying {hash, timestamp} as a Memo instruction, signed AND sent by the
 * user's own wallet via Mobile Wallet Adapter. The transaction signature is
 * the public proof — no backend, no relay, no server-held key.
 *
 * Once that succeeds, the photo + metadata are uploaded to the feed
 * backend, which independently re-verifies the same proof against devnet
 * before storing anything (see server/lib/solana.ts) — this app never
 * asks the backend to just trust it. A feed upload failure doesn't
 * invalidate the post: the on-chain transaction already succeeded and
 * remains the real proof regardless of whether it shows up in any feed.
 *
 * NOTE: capture submits immediately — there's no "review before posting"
 * step, since the whole flow (hash → sign → send) happens in one go. So the
 * button on the result screen below is deliberately labeled "New Post", not
 * "Retake": the photo already went on-chain and into the feed by the time
 * you see that screen, and tapping it can't undo that — it just clears
 * local state and lets you capture another one.
 */
export default function CaptureScreen() {
  const { account, postProof } = useWallet();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // CameraView is only ever mounted while this screen is genuinely the
  // focused, visible route (see the render below) — connecting a wallet
  // opens an external wallet app, which backgrounds/resumes this Activity
  // and updates context state that this screen (still mounted, just
  // hidden behind whatever screen the user navigated to) would otherwise
  // react to immediately. Mounting the native camera while off-screen left
  // its preview permanently blank even after navigating back to it, and
  // takePictureAsync() on that broken session is what produced the
  // generic "Something went wrong" error — the camera was never actually
  // running.
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  const [stage, setStage] = useState<Stage>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [capturedAtMs, setCapturedAtMs] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("idle");
  const [feedError, setFeedError] = useState<string | null>(null);

  if (!account) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.info}>Connect a wallet in Settings first.</Text>
          <Button title="Go to Settings" onPress={() => router.push("/settings")} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.info}>ChainWitness needs camera access to capture posts.</Text>
          <Button title="Grant camera permission" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setStage("processing");
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) throw new Error("Camera returned no photo URI");

      const now = Date.now();
      const { hashHex, base64 } = await hashAndEncodePhoto(photo.uri);
      const message = buildSignedMessage(hashHex, now);

      setPhotoUri(photo.uri);
      setImageHash(hashHex);
      setCapturedAtMs(now);

      const sig = await withTimeout(
        postProof(message),
        POST_TIMEOUT_MS,
        "Wallet didn't respond in time. Check Phantom for a pending approval " +
          "screen, or confirm your wallet has devnet SOL (see Settings).",
      );
      setSignature(sig);
      setStage("confirming");

      // Best-effort UI polish only — the signature itself, once the wallet
      // has accepted and broadcast it, is already the proof. A failed or
      // slow confirmation check here doesn't invalidate that.
      try {
        const ok = await confirmTransaction(sig);
        setConfirmed(ok);
      } catch {
        // Leave it at "confirming" — the signature/explorer link still work.
      } finally {
        setStage("done");
      }

      // Upload to the feed. This is separate from — and doesn't gate — the
      // proof above: the on-chain transaction is already final regardless
      // of whether this succeeds.
      setFeedStatus("uploading");
      try {
        await submitPostToFeed({
          authorPubkey: account.publicKey.toBase58(),
          imageBase64: base64,
          imageHash: hashHex,
          capturedAtMs: now,
          txSignature: sig,
        });
        setFeedStatus("uploaded");
      } catch (err) {
        console.warn("[ChainWitness] feed upload failed:", err);
        setFeedStatus("failed");
        setFeedError(toFriendlyMessage(err));
      }
    } catch (err) {
      const friendly = toFriendlyMessage(err);
      setError(friendly);
      setStage("camera");
      Alert.alert("Couldn't post", friendly);
    }
  };

  const handleNewPost = () => {
    setPhotoUri(null);
    setImageHash(null);
    setCapturedAtMs(null);
    setSignature(null);
    setConfirmed(false);
    setFeedStatus("idle");
    setFeedError(null);
    setStage("camera");
  };

  const isResultStage = stage === "confirming" || stage === "done";

  if (isResultStage && photoUri && imageHash && signature && capturedAtMs) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Image source={{ uri: photoUri }} style={styles.preview} />

          <View style={styles.card}>
            <Text style={styles.label}>Captured at</Text>
            <Text style={styles.value}>{new Date(capturedAtMs).toLocaleString()}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Image hash (SHA-256)</Text>
            <Text style={styles.value} numberOfLines={2}>
              {imageHash}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>
              Devnet transaction{" "}
              {stage === "confirming"
                ? "(confirming…)"
                : confirmed
                  ? "(confirmed ✓)"
                  : "(submitted)"}
            </Text>
            <Text style={styles.value} numberOfLines={2}>
              {signature}
            </Text>
            <Text
              style={styles.link}
              onPress={() => Linking.openURL(explorerUrl(signature))}
            >
              View on Solana Explorer →
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Feed</Text>
            <View style={styles.statusRow}>
              {feedStatus === "uploading" && (
                <>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                  <Text style={styles.value}>Uploading…</Text>
                </>
              )}
              {feedStatus === "uploaded" && (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  <Text style={[styles.value, styles.successText]}>Post successful</Text>
                </>
              )}
              {feedStatus === "failed" && (
                <>
                  <Ionicons name="alert-circle" size={18} color={colors.warning} />
                  <Text style={styles.value}>Not posted to feed</Text>
                </>
              )}
            </View>
            {feedStatus === "failed" && feedError && (
              <Text style={styles.warning}>
                {feedError} The on-chain proof above is still valid either way.
              </Text>
            )}
          </View>

          <Text style={styles.note}>
            This is a real devnet transaction, signed and sent by your own
            wallet.
          </Text>

          <View style={styles.resultButtonRow}>
            <Button title="New Post" onPress={handleNewPost} />
            <Button title="View Feed" onPress={() => router.replace("/")} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.safe}>
      {isFocused ? (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}

      {stage === "processing" && (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>Hashing + signing + sending…</Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorBanner, { top: insets.top + 12 }]}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      {stage === "camera" && (
        <>
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.shutter, { bottom: insets.bottom + 48 }]}
            onPress={handleCapture}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const SHUTTER_SIZE = 78;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, padding: 16 },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    info: { color: colors.text, textAlign: "center", marginBottom: 8 },
    preview: { width: "100%", height: 280, borderRadius: 16, marginBottom: 16 },

    // The camera stage itself (preview, shutter, close button) intentionally
    // stays on a fixed dark-with-white-icons scheme regardless of app theme
    // — it's a full-bleed live camera feed, not a themed surface, same
    // reasoning as the post detail screen's overlay chrome.
    overlay: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    overlayText: { color: "#fff", marginTop: 12 },

    errorBanner: {
      position: "absolute",
      left: 16,
      right: 16,
      backgroundColor: "rgba(60,0,0,0.75)",
      borderRadius: 10,
      padding: 10,
    },
    error: { color: "#ff9b9b", textAlign: "center", fontSize: 13 },

    closeButton: {
      position: "absolute",
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.4)",
      alignItems: "center",
      justifyContent: "center",
    },

    // A camera-app-style circular shutter, floating above the bottom edge
    // (not flush against it) so it's comfortable to reach and doesn't sit
    // under a device's gesture bar.
    shutter: {
      position: "absolute",
      alignSelf: "center",
      width: SHUTTER_SIZE,
      height: SHUTTER_SIZE,
      borderRadius: SHUTTER_SIZE / 2,
      borderWidth: 4,
      borderColor: "rgba(255,255,255,0.9)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.15)",
    },
    shutterInner: {
      width: SHUTTER_SIZE - 20,
      height: SHUTTER_SIZE - 20,
      borderRadius: (SHUTTER_SIZE - 20) / 2,
      backgroundColor: "#fff",
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
    value: { color: colors.text, fontSize: 13, fontFamily: "monospace" },
    link: { color: colors.link, fontSize: 13, marginTop: 8 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    successText: { color: colors.success, fontWeight: "700" },
    warning: { color: colors.warning, fontSize: 12, marginTop: 8 },
    note: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
    resultButtonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 12,
    },
  });
}
