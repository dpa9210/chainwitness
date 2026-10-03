import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Whether the device currently has a usable network connection. Backed by
 * NetInfo's own continuous listener rather than a one-off check, so it
 * stays correct as wifi/data drops or comes back without the screen doing
 * anything else.
 *
 * `null` for the brief window before the first NetInfo event arrives —
 * callers that need a definite yes/no (not just "don't show the offline
 * banner yet") should treat null as "assume online" rather than block on it,
 * since the real failure mode they care about (a stalled network call) is
 * already handled separately wherever it matters.
 */
export function useNetworkStatus(): boolean | null {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while NetInfo is still figuring it
      // out (common right after a wifi handoff) — isConnected is the more
      // stable signal in that gap, so fall back to it rather than reading
      // a transient null as "offline".
      setIsOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
