import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SessionProvider, useSession } from "@/lib/session";
import { palette, useTheme } from "@/theme/tokens";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const navigationTheme = (scheme: "light" | "dark") => {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const p = palette[scheme];
  return { ...base, colors: { ...base.colors, background: p.background, card: p.card, text: p.foreground, border: p.border, primary: p.brand } };
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
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;
  return (
    <ThemeProvider value={navigationTheme(theme.scheme)}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
