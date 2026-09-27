import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { PublicKey } from "@solana/web3.js";

import { fetchFeed, type FeedPost } from "../src/api";
import { toFriendlyMessage } from "../src/friendlyError";
import { DEFAULT_TIP_LAMPORTS, explorerUrl } from "../src/solanaClient";
import { useWallet } from "../src/walletContext";

const TIP_SOL_LABEL = (DEFAULT_TIP_LAMPORTS / 1_000_000_000).toString();

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

type TipStatus = "idle" | "sending" | "sent" | "failed";

function PostCard({ post }: { post: FeedPost }) {
  const { account, tip } = useWallet();
  const [tipStatus, setTipStatus] = useState<TipStatus>("idle");
  const [tipSignature, setTipSignature] = useState<string | null>(null);

  const isOwnPost = account?.publicKey.toBase58() === post.authorPubkey;

  const handleTip = async () => {
    if (!account) {
      Alert.alert(
        "Connect a wallet",
        "Connect a wallet on the Home screen before tipping.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Go to Home", onPress: () => router.push("/") },
        ],
      );
      return;
    }

    setTipStatus("sending");
    try {
      const recipient = new PublicKey(post.authorPubkey);
      const sig = await tip(recipient);
      setTipSignature(sig);
      setTipStatus("sent");
    } catch (err) {
      setTipStatus("failed");
      Alert.alert("Tip failed", toFriendlyMessage(err));
    }
  };

  return (
    <View style={styles.card}>
      <Image
        source={post.imageUrl}
        style={styles.photo}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.cardBody}>
        <View style={styles.cardRow}>
          <Text style={styles.author}>{shortAddress(post.authorPubkey)}</Text>
          <Text style={styles.timestamp}>
            {new Date(post.capturedAtMs).toLocaleString()}
          </Text>
        </View>
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(explorerUrl(post.txSignature))}
        >
          View proof on Solana Explorer →
        </Text>

        {!isOwnPost && (
          <View style={styles.tipRow}>
            <Button
              title={
                tipStatus === "sending"
                  ? "Sending…"
                  : tipStatus === "sent"
                    ? "Tipped ✓"
                    : `Tip ${TIP_SOL_LABEL} SOL`
              }
              onPress={handleTip}
              disabled={tipStatus === "sending" || tipStatus === "sent"}
            />
            {tipStatus === "sent" && tipSignature && (
              <Text
                style={styles.tipLink}
                onPress={() => Linking.openURL(explorerUrl(tipSignature))}
              >
                View tip →
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await fetchFeed();
      setPosts(result);
    } catch (err) {
      setError(toFriendlyMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch every time this screen comes into focus, so a post made just
  // now (or by someone else) shows up without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#fff"
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>
              {error ?? "No posts yet. Be the first to post."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d12" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: { color: "#7a7a88", textAlign: "center", fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#17171f",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  photo: { width: "100%", height: 280, backgroundColor: "#0d0d12" },
  cardBody: { padding: 14 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  author: { color: "#fff", fontSize: 14, fontFamily: "monospace" },
  timestamp: { color: "#7a7a88", fontSize: 12 },
  link: { color: "#7ab8ff", fontSize: 13 },
  tipRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipLink: { color: "#7ab8ff", fontSize: 13 },
});
