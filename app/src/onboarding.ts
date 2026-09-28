import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "chainwitness.onboarded";

/**
 * Whether the first-run intro screen has already been shown. Fails OPEN
 * (treats a storage error as "already seen") rather than closed — a broken
 * read should never permanently trap someone on the intro screen every time
 * they open the app; worst case with fail-open is a returning user sees the
 * intro again once, which is harmless.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    return true;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "true");
  } catch {
    // Best-effort — worst case the intro shows again next launch.
  }
}
