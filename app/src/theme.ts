export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  link: string;
  warning: string;
  success: string;
  overlay: string;
  overlayStrong: string;
};

// The dark palette is exactly what ChainWitness looked like before light
// mode existed — every screen's hardcoded hex values, lifted here so both
// palettes live in one place instead of being scattered across four files.
const dark: ThemeColors = {
  background: "#0d0d12",
  surface: "#17171f",
  surfaceAlt: "#16161f",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.15)",
  text: "#ffffff",
  textSecondary: "#9a9aa8",
  textMuted: "#7a7a88",
  accent: "#8a6fe8",
  link: "#7ab8ff",
  warning: "#f5a623",
  success: "#34c759",
  overlay: "rgba(0,0,0,0.4)",
  overlayStrong: "rgba(0,0,0,0.55)",
};

const light: ThemeColors = {
  background: "#f4f4f7",
  surface: "#ffffff",
  surfaceAlt: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.15)",
  text: "#15151a",
  textSecondary: "#5c5c68",
  textMuted: "#84848f",
  accent: "#6a4fd0",
  link: "#2f6fe0",
  warning: "#b45309",
  success: "#1f9d4a",
  overlay: "rgba(0,0,0,0.25)",
  overlayStrong: "rgba(0,0,0,0.4)",
};

export const palettes: Record<ThemeMode, ThemeColors> = { dark, light };
