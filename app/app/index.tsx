import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { fetchFeed, type FeedPost } from "../src/api";
import { setFeedCache } from "../src/feedCache";
import { toFriendlyMessage } from "../src/friendlyError";

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function PostCard({ post }: { post: FeedPost }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.author}>{shortAddress(post.authorPubkey)}</Text>
        {post.hasSgt && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Seeker ✓</Text>
          </View>
        )}
      </View>

      <Image
        source={post.imageUrl}
        style={styles.photo}
        contentFit="cover"
        transition={150}
      />

      <View style={styles.cardFooter}>
        <Text style={styles.timestamp}>
          {new Date(post.capturedAtMs).toLocaleString()}
        </Text>
        <Text style={styles.tapHint}>Tap for details & tip →</Text>
      </View>
    </Pressable>
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
      setFeedCache(result);
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>ChainWitness</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
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
      )}

      <View style={styles.bottomBar}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0d0d12" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyText: { color: "#7a7a88", textAlign: "center", fontSize: 14 },

  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  wordmark: { color: "#fff", fontSize: 18, fontWeight: "700" },

  list: { paddingVertical: 12 },
  card: { marginBottom: 20 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  author: { color: "#fff", fontSize: 14, fontFamily: "monospace", fontWeight: "700" },
  badge: {
    backgroundColor: "rgba(42,33,64,0.85)",
    borderColor: "#8a6fe8",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: "#c9bbfb", fontSize: 11, fontWeight: "600" },

  photo: { width: "100%", aspectRatio: 4 / 5, backgroundColor: "#17171f" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  timestamp: { color: "#7a7a88", fontSize: 12 },
  tapHint: { color: "#7ab8ff", fontSize: 12 },

  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    height: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0d0d12",
  },
  tabButton: { padding: 10 },
  postButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
