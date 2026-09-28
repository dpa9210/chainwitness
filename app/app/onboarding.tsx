import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { markOnboardingComplete } from "../src/onboarding";
import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: "images-outline",
    title: "Share a unique part of your life",
    body: "Every photo is captured right here in the app and signed by your wallet the instant you take it — real moments you won't find anywhere else, not a repost or a gallery pick.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Proof, not just a photo",
    body: "Each post carries a transaction on Solana, signed by your own wallet — a permanent, independently-checkable record that this exact photo existed at this exact time. No backend key ever touches it.",
  },
  {
    icon: "cash-outline",
    title: "Get tipped for what you share",
    body: "Friends can send SOL straight to your wallet for posts they love — no middleman. Seeker Genesis Token holders get a badge that shows right on their posts.",
  },
];

/**
 * First-run intro, shown once (gated by src/onboarding.ts, checked from the
 * feed screen on cold start) before the feed itself. Tap-through rather than
 * a swipe gesture — avoids pulling in a pager-view native dependency for
 * three slides.
 */
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const finish = () => {
    markOnboardingComplete();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <Text style={styles.wordmark}>ChainWitness</Text>
        {!isLast && (
          <Pressable onPress={finish}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name={slide.icon} size={40} color={colors.accent} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          style={styles.nextButton}
          onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
        >
          <Text style={styles.nextButtonText}>{isLast ? "Get Started" : "Next"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    wordmark: { color: colors.text, fontSize: 17, fontFamily: "ChakraPetch_700Bold" },
    skip: { color: colors.textMuted, fontSize: 14 },

    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 36,
      gap: 18,
    },
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 30,
    },
    body: {
      color: colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },

    footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 20 },
    dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: { backgroundColor: colors.accent, width: 20 },
    nextButton: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      paddingVertical: 16,
      alignItems: "center",
    },
    nextButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  });
}
