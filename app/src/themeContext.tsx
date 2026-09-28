import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { palettes, type ThemeColors, type ThemeMode } from "./theme";

const STORAGE_KEY = "chainwitness.themeMode";

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ThemeColors;
  /** True until the persisted preference has been read once at startup. */
  ready: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * App-wide light/dark preference, independent of the OS theme — ChainWitness
 * defaults to dark (its original, only look) and lets the user opt into
 * light from Settings. Persisted locally so the choice survives a restart;
 * kept deliberately simple (no "follow system" option) since that's what
 * was asked for.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light" || stored === "dark") setModeState(stored);
      })
      .catch(() => {
        // No persisted preference (or storage unavailable) — dark default stands.
      })
      .finally(() => setReady(true));
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Best-effort — the in-memory switch above still applies to this session.
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palettes[mode],
      ready,
      setMode,
      toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme() must be called within a ThemeProvider");
  return ctx;
}
