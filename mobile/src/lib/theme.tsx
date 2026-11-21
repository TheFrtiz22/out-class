import { resolveTheme, type Theme } from "@outclass/shared/tokens";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AccessibilityInfo, Appearance, useColorScheme } from "react-native";

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
/** The person's light/dark choice in Settings. "system" follows the phone. */
export type AppearancePreference = "system" | "light" | "dark";
/** `loaded` turns true once the saved Light/Dark choice is read (or after a short wait), so launch can keep the splash up until then. */
type ThemeValue = Theme & { dark: boolean; a11y: Accessibility; appearance: AppearancePreference; setAppearance: (value: AppearancePreference) => void; loaded: boolean };
const APPEARANCE_KEY = "outclass.appearance";
const THEME_WAIT_MS = 500;
const isPreference = (value: unknown): value is AppearancePreference => value === "system" || value === "light" || value === "dark";
/** Native views (alerts, the keyboard, pickers, Liquid Glass) follow the app's choice too, not only our own colours. */
function applyNative(preference: AppearancePreference) {
  try { Appearance.setColorScheme(preference === "system" ? "unspecified" : preference); } catch { /* an old runtime without overrides: our own colours still follow */ }
}

const light = resolveTheme("light");
const dark = resolveTheme("dark");
const ThemeContext = createContext<ThemeValue>({ ...light, dark: false, a11y: { reduceMotion: false, reduceTransparency: false }, appearance: "system", setAppearance: () => {}, loaded: true });

/** Follows the system light/dark setting unless the person picked Light or Dark in Settings (kept on
 * this device). The school theme comes from the signed-in account's server-side identity (`school`),
 * never from the build: only the `--school-*` layer differs. */
export function ThemeProvider({ children, school }: { children: ReactNode; school?: string }) {
  const [appearance, setPreference] = useState<AppearancePreference>("system");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(APPEARANCE_KEY).then(stored => {
      if (live && isPreference(stored) && stored !== "system") { setPreference(stored); applyNative(stored); }
    }, () => {}).finally(() => { if (live) setLoaded(true); });
    // Storage that never answers must not hold the launch.
    const timer = setTimeout(() => { if (live) setLoaded(true); }, THEME_WAIT_MS);
    return () => { live = false; clearTimeout(timer); };
  }, []);
  const setAppearance = useCallback((value: AppearancePreference) => {
    setPreference(value);
    applyNative(value);
    AsyncStorage.setItem(APPEARANCE_KEY, value).catch(() => {});
  }, []);
  const system = useColorScheme() === "dark" ? "dark" : "light";
  const scheme = appearance === "system" ? system : appearance;
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
    return { ...base, dark: scheme === "dark", a11y, appearance, setAppearance, loaded };
  }, [scheme, school, a11y, appearance, setAppearance, loaded]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
export type { Theme };
