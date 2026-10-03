import { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type ThemeColors } from "../src/theme";
import { useTheme } from "../src/themeContext";

const GITHUB_URL = "https://github.com/dpa9210/chainwitness";

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
 * Plain-English privacy notes, not a legal document — this is a hackathon
 * submission, not a company with a legal team, and a wall of boilerplate
 * would say less than the truth does. Reached from Settings → Privacy.
 */
export default function PrivacyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.intro}>
          Short version: posts are public by design — that&apos;s the whole
          point of an on-chain proof — so don&apos;t post anything you
          don&apos;t want visible to anyone, forever.
        </Text>

        <Section title="What's collected when you post" styles={styles}>
          <Text style={styles.body}>
            The photo you capture, its SHA-256 hash, a timestamp, and your
            wallet&apos;s public address. These are published together as a
            transaction on Solana Devnet — public and permanent, checkable by
            anyone, independent of this app. The photo and the same details
            are also stored on ChainWitness&apos;s own backend (Vercel Blob +
            Upstash Redis) so your post can show up in the feed.
          </Text>
        </Section>

        <Section title="What's not collected" styles={styles}>
          <Text style={styles.body}>
            ChainWitness never reads your photo gallery — only photos taken
            right here, in-app, ever touch the app. No analytics SDK, no ad
            tracking, no third-party trackers of any kind.
          </Text>
        </Section>

        <Section title="Your wallet key" styles={styles}>
          <Text style={styles.body}>
            ChainWitness never sees or stores your private key. Signing
            happens entirely inside your wallet app — Seed Vault on Seeker,
            or Phantom/Solflare elsewhere — via Mobile Wallet Adapter. The
            app only ever receives a finished signature and a transaction
            result.
          </Text>
        </Section>

        <Section title="Network" styles={styles}>
          <Text style={styles.body}>
            Posting and tipping happen entirely on Solana Devnet. The one
            exception is the Seeker Genesis Token badge check, which reads
            (never writes) mainnet to check whether an address holds a real
            Genesis Token.
          </Text>
        </Section>

        <Section title="Questions" styles={styles}>
          <Text style={styles.body}>
            This is an open-source hackathon project, not a company — the
            full source, including exactly what the backend stores and how,
            is public.
          </Text>
          <Text style={styles.link} onPress={() => Linking.openURL(GITHUB_URL)}>
            View source on GitHub →
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
    title: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 10 },
    intro: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 },
    section: { marginBottom: 22 },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    body: { color: colors.text, fontSize: 14, lineHeight: 21 },
    link: { color: colors.link, fontSize: 14, marginTop: 10 },
  });
}
