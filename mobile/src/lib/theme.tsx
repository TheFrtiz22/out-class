import { resolveTheme, type Theme } from "@outclass/shared/tokens";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";

/** Font families registered in src/app/_layout.tsx. Caslon is the editorial display voice;
 * Source Sans 3 carries controls and body copy, as on the web (styles/tokens.css). */
export const fonts = {
  display: "LibreCaslonText-Regular",
  displayStrong: "LibreCaslonText-SemiBold",
  sans: "SourceSans3_400Regular",
  sansMedium: "SourceSans3_500Medium",
  sansSemibold: "SourceSans3_600SemiBold",
  sansBold: "SourceSans3_700Bold",
} as const;

type Accessibility = { reduceMotion: boolean; reduceTransparency: boolean };
type ThemeValue = Theme & { dark: boolean; a11y: Accessibility };

const light = resolveTheme("light");
const dark = resolveTheme("dark");
const ThemeContext = createContext<ThemeValue>({ ...light, dark: false, a11y: { reduceMotion: false, reduceTransparency: false } });

/** Follows the system light/dark setting. The school theme comes from the signed-in account's
 * server-side identity (`school`), never from the build: only the `--school-*` layer differs. */
export function ThemeProvider({ children, school }: { children: ReactNode; school?: string }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [a11y, setA11y] = useState<Accessibility>({ reduceMotion: false, reduceTransparency: false });
  useEffect(() => {
    let live = true;
    Promise.all([AccessibilityInfo.isReduceMotionEnabled().catch(() => false), AccessibilityInfo.isReduceTransparencyEnabled().catch(() => false)])
      .then(([reduceMotion, reduceTransparency]) => { if (live) setA11y({ reduceMotion, reduceTransparency }); }, () => {});
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", reduceMotion => setA11y(current => ({ ...current, reduceMotion })));
    const transparency = AccessibilityInfo.addEventListener("reduceTransparencyChanged", reduceTransparency => setA11y(current => ({ ...current, reduceTransparency })));
    return () => { live = false; motion.remove(); transparency.remove(); };
  }, []);
  const value = useMemo<ThemeValue>(() => {
    const base = school ? resolveTheme(scheme, school) : scheme === "dark" ? dark : light;
    return { ...base, dark: scheme === "dark", a11y };
  }, [scheme, school, a11y]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export type { Theme };
