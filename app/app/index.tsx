import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { fetchFeed, type FeedPost } from "../src/api";
import { setFeedCache } from "../src/feedCache";
import { toFriendlyMessage } from "../src/friendlyError";
import { hasCompletedOnboarding } from "../src/onboarding";
import { SeekerBadge } from "../src/SeekerBadge";
import { StreakBadge } from "../src/StreakBadge";
import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";
import { useStreak } from "../src/useStreak";
import { useWallet } from "../src/walletContext";

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function PostCard({ post, styles }: { post: FeedPost; styles: ReturnType<typeof createStyles> }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/post/${post.id}`)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.author}>{shortAddress(post.authorPubkey)}</Text>
        {post.hasSgt && <SeekerBadge />}
      </View>

      <View style={styles.photoWrap}>
        <Image
          source={post.imageUrl}
          style={styles.photo}
          contentFit="cover"
          transition={150}
        />
      </View>

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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useWallet();
  const accountPubkeyStr = account?.publicKey.toBase58();
  const { streak, refreshStreak } = useStreak();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Runs once, on the app's very first mount (index is the initial route
  // and stays mounted for the app's lifetime, so this never re-fires when
  // navigating back here from Settings or a post) — not on focus.
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  useEffect(() => {
    hasCompletedOnboarding().then((seen) => {
      if (seen) {
        setOnboardingChecked(true);
      } else {
        router.replace("/onboarding");
      }
    });
  }, []);

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
      if (accountPubkeyStr) refreshStreak(accountPubkeyStr);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accountPubkeyStr]),
  );

  if (!onboardingChecked) {
    return <View style={styles.safe} />;
  }

  return (
    // Only the top edge is handled by SafeAreaView's own padding — the
    // bottom edge is handled manually on bottomBar below, so that bar's
    // background can extend all the way to the true screen edge instead
    // of leaving a plain gap under it (SafeAreaView's own inset padding
    // would otherwise just add blank space after the bar, not inside it).
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>ChainWitness</Text>
        {streak !== null && <StreakBadge days={streak} />}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} styles={styles} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.text}
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

      <View style={[styles.bottomBar, { height: 64 + insets.bottom, paddingBottom: insets.bottom }]}>
        <Pressable style={styles.tabButton} onPress={() => load(true)}>
          <Ionicons name="home" size={26} color={colors.text} />
        </Pressable>

        <Pressable
          style={styles.postButton}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            router.push("/capture");
          }}
        >
          <Ionicons name="add" size={34} color={colors.background} />
        </Pressable>

        <Pressable style={styles.tabButton} onPress={() => router.push("/settings")}>
          <Ionicons name="settings-outline" size={26} color={colors.text} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 32 },
    emptyText: { color: colors.textMuted, textAlign: "center", fontSize: 14 },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    wordmark: { color: colors.text, fontSize: 19, fontFamily: "ChakraPetch_700Bold" },

    // Each post is a genuine card — its own background a shade different
    // from the screen, rounded, with real spacing between cards — rather
    // than edge-to-edge content sitting directly on the same background as
    // everything else, which made it hard to tell where one post ended and
    // the next began.
    list: { paddingVertical: 12, paddingHorizontal: 12 },
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    author: { color: colors.text, fontSize: 14, fontFamily: "monospace", fontWeight: "700" },

    photoWrap: { backgroundColor: colors.background },
    photo: { width: "100%", aspectRatio: 4 / 5 },

    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    timestamp: { color: colors.textSecondary, fontSize: 12 },
    tapHint: { color: colors.link, fontSize: 12 },

    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-evenly",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    tabButton: { padding: 10 },
    postButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.text,
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
}
