import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

import { buildSignedMessage, hashPhoto } from "../src/contentHash";
import { confirmTransaction, explorerUrl } from "../src/solanaClient";
import { useWallet } from "../src/walletContext";
import { withTimeout } from "../src/withTimeout";

const POST_TIMEOUT_MS = 90_000;

type Stage = "camera" | "processing" | "confirming" | "done";

/**
 * Capture a photo in-app (no gallery picker — the whole point is that the
 * timestamp is honest), hash it locally, and submit a devnet transaction
 * carrying {hash, timestamp} as a Memo instruction, signed AND sent by the
 * user's own wallet via Mobile Wallet Adapter. The transaction signature is
 * the public proof — no backend, no relay, no server-held key.
 *
 * Not yet wired to a backend/feed — that's next. This screen proves
 * capture → hash → on-chain memo tx works end to end on device.
 */
export default function CaptureScreen() {
  const { account, postProof } = useWallet();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [stage, setStage] = useState<Stage>("camera");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [capturedAtMs, setCapturedAtMs] = useState<number | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.info}>Connect a wallet on the Home screen first.</Text>
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
      const hashHex = await hashPhoto(photo.uri);
      const message = buildSignedMessage(hashHex, now);

      setPhotoUri(photo.uri);
      setImageHash(hashHex);
      setCapturedAtMs(now);

      const sig = await withTimeout(
        postProof(message),
        POST_TIMEOUT_MS,
        "Wallet didn't respond in time. Check Phantom for a pending approval " +
          "screen, or confirm your wallet has devnet SOL (see the Home screen).",
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
    } catch (err) {
      setError(String(err));
      setStage("camera");
      Alert.alert("Capture failed", String(err));
    }
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setImageHash(null);
    setCapturedAtMs(null);
    setSignature(null);
    setConfirmed(false);
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

          <Text style={styles.note}>
            This is a real devnet transaction, signed and sent by your own
            wallet. Not yet wired to a feed — that's next.
          </Text>

          <View style={styles.buttonRow}>
            <Button title="Retake" onPress={handleRetake} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        {stage === "processing" ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>Hashing + signing + sending…</Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <Button title="Capture & Post" onPress={handleCapture} />
          </View>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d12" },
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  info: { color: "#fff", textAlign: "center", marginBottom: 8 },
  camera: { flex: 1, borderRadius: 16, overflow: "hidden" },
  preview: { width: "100%", height: 280, borderRadius: 16, marginBottom: 16 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 16,
  },
  overlayText: { color: "#fff", marginTop: 12 },
  card: {
    backgroundColor: "#17171f",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  label: { color: "#7a7a88", fontSize: 12, marginBottom: 4 },
  value: { color: "#fff", fontSize: 13, fontFamily: "monospace" },
  link: { color: "#7ab8ff", fontSize: 13, marginTop: 8 },
  note: { color: "#7a7a88", fontSize: 12, marginBottom: 16 },
  buttonRow: { marginTop: 12 },
  error: { color: "#ff6b6b", marginTop: 12, textAlign: "center" },
});
