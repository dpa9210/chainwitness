import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PublicKey } from "@solana/web3.js";
import { Ionicons } from "@expo/vector-icons";

import { fetchFeed, type FeedPost } from "../src/api";
import { toFriendlyMessage } from "../src/friendlyError";
import { DEFAULT_TIP_LAMPORTS, explorerUrl } from "../src/solanaClient";
import { useWallet } from "../src/walletContext";

const TIP_SOL_LABEL = (DEFAULT_TIP_LAMPORTS / 1_000_000_000).toString();
const BOTTOM_BAR_HEIGHT = 88;

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type TipStatus = "idle" | "sending" | "sent" | "failed";

/**
 * One full-screen post — the "page" in the TikTok-style vertical pager.
 * The photo fills the screen; everything else is an overlay on top of it,
 * positioned to clear the persistent top/bottom bars (siblings in the
 * parent, not part of this item, so they never scroll away).
 */
function PostPage({ post, height }: { post: FeedPost; height: number }) {
  const { account, tip } = useWallet();
  const [tipStatus, setTipStatus] = useState<TipStatus>("idle");
  const [tipSignature, setTipSignature] = useState<string | null>(null);

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
    setTipStatus("sending");
    try {
      const sig = await tip(new PublicKey(post.authorPubkey));
      setTipSignature(sig);
      setTipStatus("sent");
    } catch (err) {
      setTipStatus("failed");
      Alert.alert("Tip failed", toFriendlyMessage(err));
    }
  };

  return (
    <View style={{ height, width: "100%" }}>
      <Image
        source={post.imageUrl}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
      />

      {/* Bottom-left: author + badge + timestamp + proof link */}
      <View style={[styles.bottomLeft, { bottom: BOTTOM_BAR_HEIGHT + 24 }]}>
        <View style={styles.authorRow}>
          <Text style={styles.author}>{shortAddress(post.authorPubkey)}</Text>
          {post.hasSgt && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Seeker ✓</Text>
            </View>
          )}
        </View>
        <Text style={styles.timestamp}>
          {new Date(post.capturedAtMs).toLocaleString()}
        </Text>
        <Pressable onPress={() => Linking.openURL(explorerUrl(post.txSignature))}>
          <Text style={styles.link}>View proof on Explorer →</Text>
        </Pressable>
      </View>

      {/* Right-side action stack: tip button, plus a link once sent */}
      {!isOwnPost && (
        <View style={[styles.rightStack, { bottom: BOTTOM_BAR_HEIGHT + 24 }]}>
          <Pressable
            style={styles.actionButton}
            onPress={handleTip}
            disabled={tipStatus === "sending" || tipStatus === "sent"}
          >
            {tipStatus === "sending" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons
                name={tipStatus === "sent" ? "checkmark-circle" : "cash-outline"}
                size={30}
                color={tipStatus === "sent" ? "#7ef29c" : "#fff"}
              />
            )}
          </Pressable>
          <Text style={styles.actionLabel}>
            {tipStatus === "sent" ? "Tipped" : `Tip ${TIP_SOL_LABEL}`}
          </Text>
          {tipStatus === "sent" && tipSignature && (
            <Pressable onPress={() => Linking.openURL(explorerUrl(tipSignature))}>
              <Text style={styles.actionSubLink}>view →</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setPosts(await fetchFeed());
    } catch (err) {
      setError(toFriendlyMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View
      style={styles.safe}
      onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
    >
      {loading || pageHeight === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostPage post={item} height={pageHeight} />}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageHeight}
          getItemLayout={(_, index) => ({
            length: pageHeight,
            offset: pageHeight * index,
            index,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={[styles.centered, { height: pageHeight }]}>
              <Text style={styles.emptyText}>
                {error ?? "No posts yet. Be the first to post."}
              </Text>
            </View>
          }
        />
      )}

      {/* Persistent top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.wordmark}>ChainWitness</Text>
      </View>

      {/* Persistent bottom bar — the TikTok-style tab row */}
      <View
        style={[
          styles.bottomBar,
          { height: BOTTOM_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
        ]}
      >
        <Pressable style={styles.tabButton} onPress={() => load(true)}>
          <Ionicons name="home" size={26} color="#fff" />
        </Pressable>

        <Pressable style={styles.postButton} onPress={() => router.push("/capture")}>
          <Ionicons name="add" size={34} color="#0d0d12" />
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={26} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d12" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyText: { color: "#7a7a88", textAlign: "center", fontSize: 14 },

  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "rgba(13,13,18,0.35)",
  },
  wordmark: { color: "#fff", fontSize: 18, fontWeight: "700" },

  bottomLeft: {
    position: "absolute",
    left: 16,
    right: 90,
    gap: 4,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "monospace",
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  badge: {
    backgroundColor: "rgba(42,33,64,0.85)",
    borderColor: "#8a6fe8",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#c9bbfb", fontSize: 11, fontWeight: "600" },
  timestamp: {
    color: "#e5e5ea",
    fontSize: 12,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  link: {
    color: "#cfe4ff",
    fontSize: 13,
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },

  rightStack: {
    position: "absolute",
    right: 14,
    alignItems: "center",
    gap: 4,
  },
  actionButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 11,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  actionSubLink: { color: "#cfe4ff", fontSize: 11 },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: "rgba(13,13,18,0.55)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  tabButton: { padding: 10 },
  postButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -18,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
