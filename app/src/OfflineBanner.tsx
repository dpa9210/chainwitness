import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { type ThemeColors } from "./theme";
import { useTheme } from "./themeContext";
import { useNetworkStatus } from "./useNetworkStatus";

/**
 * A thin pill shown at the top of a screen while the device has no network
 * connection — renders nothing at all while online (or while NetInfo hasn't
 * reported yet), so it never takes up layout space unless it's actually
 * telling you something.
 */
export function OfflineBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isOnline = useNetworkStatus();

  if (isOnline !== false) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
      <Text style={styles.text}>You&apos;re offline — some things won&apos;t work</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 6,
      backgroundColor: colors.surfaceAlt,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    text: { color: colors.warning, fontSize: 12, fontWeight: "600" },
  });
}
