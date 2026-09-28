import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

/** Compact "🔥 N" chip for the feed top bar. Pops in with a small spring
 * whenever the count changes, so a fresh streak increment is noticeable. */
export function StreakBadge({ days }: { days: number }) {
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 180 });
  }, [days, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (days <= 0) return null;

  return (
    <Animated.View style={[styles.badge, animatedStyle]}>
      <Ionicons name="flame" size={14} color="#ff9f45" />
      <Text style={styles.text}>{days}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,159,69,0.14)",
    borderColor: "#ff9f45",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  text: { color: "#ff9f45", fontSize: 13, fontWeight: "700" },
});
