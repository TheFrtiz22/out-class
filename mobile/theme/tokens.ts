import { useColorScheme } from "react-native";

/**
 * The web's design language, ported. Sources: styles/tokens.css (palette, dark
 * "present" theme), styles/navigation-glass.css (navy and ivory glass optics),
 * app/layout.tsx (Libre Caslon Text display + Source Sans 3 text),
 * public/brand/README.md (navy #0F2E56, orange #F26522, ivory #FFF9F1).
 * Change web and app together.
 */
export const palette = {
  light: {
    background: "#f6f5f1",
    surface: "#fffdf8",
    raised: "#faf8f3",
    ink: "#1c2d40",
    inkSoft: "#34485a",
    muted: "#52606d",
    faint: "#8793a0",
    hairline: "rgba(20,45,69,0.10)",
    edge: "rgba(255,255,255,0.68)",
    navy: "#142d45",
    navyDeep: "#0e2338",
    onNavy: "#fff9f1",
    onNavyMuted: "rgba(255,249,241,0.68)",
    accent: "#e8793e",
    accentInk: "#9f3d12",
    accentSubtle: "#fceadd",
    success: "#296448",
    successSubtle: "#edf5ef",
    info: "#295c88",
    infoSubtle: "#edf3fa",
    danger: "#ac3544",
    shadow: "0 1px 2px rgba(20,45,69,0.05), 0 12px 32px -12px rgba(20,45,69,0.16)",
    shadowRaised: "0 2px 4px rgba(20,45,69,0.06), 0 10px 22px -10px rgba(20,45,69,0.22)",
  },
  dark: {
    background: "#0f1c2b",
    surface: "#162638",
    raised: "#1b2d41",
    ink: "#f6f5f1",
    inkSoft: "#e3e8ec",
    muted: "#b0c1cc",
    faint: "#7d91a3",
    hairline: "rgba(191,216,238,0.14)",
    edge: "rgba(220,238,255,0.10)",
    navy: "#1f3a56",
    navyDeep: "#0a1726",
    onNavy: "#fff9f1",
    onNavyMuted: "rgba(255,249,241,0.68)",
    accent: "#e8793e",
    accentInk: "#f3a274",
    accentSubtle: "#3a2618",
    success: "#7fc6a0",
    successSubtle: "#173327",
    info: "#8ab8e0",
    infoSubtle: "#172b40",
    danger: "#e07a86",
    shadow: "0 1px 2px rgba(0,0,0,0.25), 0 14px 32px -14px rgba(0,0,0,0.55)",
    shadowRaised: "0 2px 4px rgba(0,0,0,0.3), 0 10px 22px -10px rgba(0,0,0,0.6)",
  },
} as const;

export type Theme = { [K in keyof typeof palette.light]: string } & { scheme: "light" | "dark" };

/** Navy glass, as on the web dock and dark panels (--oc-glass-navy-material). */
export const navyGradient = ["#24425f", "#142d45", "#0b1d30"] as const;
export const navyDepth = "inset 0 1px 0 rgba(222,237,255,0.24), 0 3px 6px rgba(8,22,37,0.12), 0 16px 32px -14px rgba(8,22,37,0.45)";

export const font = {
  display: "LibreCaslonText_400Regular",
  displayItalic: "LibreCaslonText_400Regular_Italic",
  text: "SourceSans3_400Regular",
  textMedium: "SourceSans3_500Medium",
  textSemibold: "SourceSans3_600SemiBold",
  textBold: "SourceSans3_700Bold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 18, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 10, md: 12, lg: 18, xl: 22, pill: 999 } as const;

/** Every control keeps at least a 44-point tap area (Apple HIG), even when it draws smaller. */
export const TAP = 44;
export const hit = (height: number) => { const pad = Math.max(0, Math.ceil((TAP - height) / 2)); return { top: pad, bottom: pad, left: pad, right: pad }; };

export const text = {
  hero: { fontFamily: font.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.4 },
  title: { fontFamily: font.display, fontSize: 25, lineHeight: 29, letterSpacing: -0.2 },
  cardTitle: { fontFamily: font.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.1 },
  section: { fontFamily: font.textSemibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.text, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: font.textSemibold, fontSize: 15, lineHeight: 20 },
  small: { fontFamily: font.text, fontSize: 13, lineHeight: 17 },
  label: { fontFamily: font.textSemibold, fontSize: 13, lineHeight: 17 },
  eyebrow: { fontFamily: font.textSemibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase" as const },
} as const;

/** The app always follows the system light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { ...palette[scheme], scheme };
}
