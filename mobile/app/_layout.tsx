import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { LibreCaslonText_400Regular, LibreCaslonText_400Regular_Italic } from "@expo-google-fonts/libre-caslon-text";
import { SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold } from "@expo-google-fonts/source-sans-3";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { SessionProvider, useSession } from "@/lib/session";
import { palette, useTheme } from "@/theme/tokens";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const navigationTheme = (scheme: "light" | "dark") => {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const p = palette[scheme];
  return { ...base, colors: { ...base.colors, background: p.background, card: p.surface, text: p.ink, border: p.hairline, primary: p.accent } };
};

export default function Root() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useSession();
  const theme = useTheme();
  // The site's two families: Libre Caslon Text (display) and Source Sans 3 (text).
  const [fontsLoaded, fontError] = useFonts({ LibreCaslonText_400Regular, LibreCaslonText_400Regular_Italic, SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold });
  const ready = !loading && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <ThemeProvider value={navigationTheme(theme.scheme)}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="club/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
