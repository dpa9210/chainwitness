import { Image, StyleSheet, Text, View } from "react-native";

/**
 * Shown on a post when its author holds a Seeker Genesis Token (see
 * server/lib/sgt.ts) — the actual Solana logomark instead of a generic
 * checkmark, since "just a check" doesn't communicate what's being
 * verified. Sourced from Solana Labs' own token-list repo, background
 * keyed out to transparent (see git history for how) so it sits cleanly
 * on the badge's own color rather than carrying its original black box.
 */
export function SeekerBadge() {
  return (
    <View style={styles.badge}>
      <Image source={require("../assets/badges/solana-mark.png")} style={styles.icon} />
      <Text style={styles.text}>Seeker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(42,33,64,0.85)",
    borderColor: "#8a6fe8",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  icon: { width: 12, height: 12 },
  text: { color: "#c9bbfb", fontSize: 11, fontWeight: "600" },
});
