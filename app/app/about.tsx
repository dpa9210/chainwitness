import { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import appJson from "../app.json";
import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";

const GITHUB_URL = "https://github.com/dpa9210/chainwitness";
const PITCH_DECK_URL = "https://dpa9210.github.io/chainwitness/pitch-deck.html";

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Plain "what is this app" page — version, what it does, what it proves
 * (and doesn't), and links out to the repo/pitch deck. Reached from
 * Settings → About.
 */
export default function AboutScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const version = appJson.expo.version;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.wordmark}>ChainWitness</Text>
        <Text style={styles.tagline}>
          Hardware-signed authenticity in a world of AI-generated content.
        </Text>
        <Text style={styles.version}>Version {version} · Solana Devnet</Text>

        <Section title="What it does" styles={styles}>
          <Text style={styles.body}>
            Every photo is captured in-app only — no gallery uploads — hashed
            on the device, and signed and sent on-chain by your own wallet as
            a real Solana transaction, within seconds of the shutter closing.
            A backend independently re-verifies that transaction against
            devnet before the post ever reaches the feed. No backend ever
            holds a signing key.
          </Text>
        </Section>

        <Section title="What this proves" styles={styles}>
          <Text style={styles.body}>
            That the hash matches the exact bytes captured, that your
            wallet&apos;s key signed it, and that the signature landed
            on-chain at that timestamp.
          </Text>
        </Section>

        <Section title="What it doesn't claim" styles={styles}>
          <Text style={styles.body}>
            That the camera wasn&apos;t pointed at a screen, or that the
            scene wasn&apos;t staged. ChainWitness never claims to be
            &quot;unfakeable&quot; — just honestly checkable.
          </Text>
        </Section>

        <Section title="Built for" styles={styles}>
          <Text style={styles.body}>Solana Mobile Hackathon, 2026.</Text>
        </Section>

        <Section title="Links" styles={styles}>
          <Text style={styles.link} onPress={() => Linking.openURL(GITHUB_URL)}>
            Source code on GitHub →
          </Text>
          <Text style={styles.link} onPress={() => Linking.openURL(PITCH_DECK_URL)}>
            Pitch deck →
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    container: { padding: 20, paddingBottom: 48 },
    wordmark: {
      color: colors.text,
      fontSize: 26,
      fontFamily: "ChakraPetch_700Bold",
      marginBottom: 6,
    },
    tagline: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 6 },
    version: { color: colors.textMuted, fontSize: 12, marginBottom: 24 },
    section: { marginBottom: 22 },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    body: { color: colors.text, fontSize: 14, lineHeight: 21 },
    link: { color: colors.link, fontSize: 14, marginBottom: 10 },
  });
}
