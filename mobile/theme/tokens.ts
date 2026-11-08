import { useColorScheme } from "react-native";

/**
 * Mirrors the web design tokens in styles/tokens.css. Light = the default web
 * theme; dark = the web's dark ("present") theme. Change both together.
 */
export const palette = {
  light: {
    background: "#f6f5f1",
    foreground: "#1c2d40",
    card: "#fffefa",
    primary: "#142d45",
    primaryForeground: "#ffffff",
    secondary: "#eaece8",
    secondaryForeground: "#34485a",
    muted: "#edeee9",
    mutedForeground: "#52606d",
    border: "#dfe3dd",
    input: "#8793a0",
    brand: "#e8793e",
    brandSubtle: "#fceadd",
    brandInk: "#9f3d12",
    destructive: "#ac3544",
    success: "#296448",
    successSubtle: "#edf5ef",
    info: "#295c88",
    infoSubtle: "#edf3fa",
  },
  dark: {
    background: "#0f1c2b",
    foreground: "#f6f5f1",
    card: "#162638",
    primary: "#f6f5f1",
    primaryForeground: "#142d45",
    secondary: "#22364b",
    secondaryForeground: "#e3e8ec",
    muted: "#1d3045",
    mutedForeground: "#b0c1cc",
    border: "#2c4257",
    input: "#5d7286",
    brand: "#e8793e",
    brandSubtle: "#3a2618",
    brandInk: "#f3a274",
    destructive: "#e07a86",
    success: "#7fc6a0",
    successSubtle: "#173327",
    info: "#8ab8e0",
    infoSubtle: "#172b40",
  },
} as const;

export type Palette = { [K in keyof typeof palette.light]: string };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" as const, letterSpacing: 0.2 },
  title: { fontSize: 22, fontWeight: "700" as const },
  headline: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "500" as const },
};

/** The app always follows the system light/dark setting. */
export function useTheme(): Palette & { scheme: "light" | "dark" } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { ...palette[scheme], scheme };
}
