import { useCallback, useState } from "react";

import { fetchFeed } from "./api";
import { computeStreak } from "./streak";

/**
 * Fetches the connected wallet's own posts (from the same feed endpoint
 * the feed screen already uses — no dedicated backend route for this) and
 * computes a consecutive-day streak from them. Best-effort: a failed fetch
 * just leaves the streak unset rather than erroring the screen it's shown
 * on, since it's a nice-to-have, not load-bearing.
 */
export function useStreak() {
  const [streak, setStreak] = useState<number | null>(null);

  const refreshStreak = useCallback(async (authorPubkey: string) => {
    try {
      const posts = await fetchFeed(50);
      const mine = posts
        .filter((p) => p.authorPubkey === authorPubkey)
        .map((p) => p.capturedAtMs);
      setStreak(computeStreak(mine));
    } catch {
      // Leave streak as-is (null, or last known value) — best-effort only.
    }
  }, []);

  return { streak, refreshStreak };
}
