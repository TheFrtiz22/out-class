import { SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold } from "@expo-google-fonts/source-sans-3";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavigationTheme, useGlobalSearchParams, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { Component, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Appearance, Platform, Pressable, Text as NativeText, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "~/lib/auth";
import { hideDevToolsButton } from "~/lib/dev-tools";
import { openRoute, resolveHref } from "~/lib/links";
import { pendingLinkFor } from "~/lib/pending-link";
import { notificationPath } from "~/lib/push";
import { createQueryClient, useApiQuery } from "~/lib/query";
import { reportError } from "~/lib/report";
import { ThemeProvider, useTheme } from "~/lib/theme";
import type { Me } from "~/lib/types";

SplashScreen.preventAutoHideAsync().catch(() => {});
hideDevToolsButton();

// Optional at runtime: a build made before the module was added simply has no shortcuts.
type QuickAction = { id: string; title: string; subtitle?: string; icon?: string; params?: { href?: string } };
type QuickActionsModule = { initial?: QuickAction; setItems(items: QuickAction[]): Promise<void>; addListener(listener: (action: QuickAction) => void): { remove(): void } };
const QuickActions: QuickActionsModule | null = (() => { try { return require("expo-quick-actions") as QuickActionsModule; } catch { return null; } })();

/** How long launch waits for fonts and the stored session before showing the app regardless. */
const LAUNCH_WAIT_MS = 6000;

// The fallback's own colours (the light and dark canvas, ink and primary of lib/theme), so it draws even
// when the theme, fonts or any provider is what failed.
const FALLBACK = {
  light: { background: "#f6f5f1", title: "#232d4b", body: "#52606d", button: "#232d4b", buttonText: "#ffffff" },
  dark: { background: "#0f1c2b", title: "#f6f5f1", body: "#b0c1cc", button: "#f6f5f1", buttonText: "#232d4b" },
};

/** The last line of defence: a calm screen and a way back, never a white screen. It depends on no provider. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    reportError(error, "render");
    // A failure before the first screen would otherwise leave the splash up for good.
    SplashScreen.hideAsync().catch(() => {});
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const palette = FALLBACK[Appearance.getColorScheme() === "dark" ? "dark" : "light"];
    return (
      <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: palette.background }}>
        <NativeText maxFontSizeMultiplier={1.6} style={{ fontSize: 26, lineHeight: 32, fontWeight: "600", textAlign: "center", color: palette.title }}>Something went wrong</NativeText>
        <NativeText maxFontSizeMultiplier={2} style={{ fontSize: 15, lineHeight: 21, textAlign: "center", color: palette.body }}>Anything you already saved is safe. Try again, or close and reopen the app.</NativeText>
        <Pressable accessibilityRole="button" accessibilityLabel="Try again" onPress={() => this.setState({ failed: false })}
          style={({ pressed }) => ({ marginTop: 8, minHeight: 48, minWidth: 140, paddingHorizontal: 22, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: palette.button, opacity: pressed ? 0.85 : 1 })}>
          <NativeText maxFontSizeMultiplier={1.6} style={{ fontSize: 16, fontWeight: "600", color: palette.buttonText }}>Try again</NativeText>
        </Pressable>
      </View>
    );
  }
}

function Navigation() {
  const { session } = useAuth();
  const { colors, dark, loaded: themeLoaded } = useTheme();
  const segments = useSegments();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const router = useRouter();
  // A link opened while signed out (a /q check-in or club code, a meeting) is followed once the person is in, not dropped for Home.
  // Only a link that opened the app signed out counts: signing out from a screen must not bring the next sign-in back to it.
  const pendingPath = useRef<string | null>(null);
  const wasSignedIn = useRef(false);
  const ready = session !== undefined;
  // A signed-in account without a student profile (a new account, or one made on the web that never
  // finished) is held on complete-profile, as the web holds it on /signup.
  const me = useApiQuery<Me>("me", undefined, { enabled: !!session });
  const needsProfile = !!session && me.data?.profile === null;

  useEffect(() => {
    if (!ready) return;
    const onAuth = segments[0] === "sign-in" || segments[0] === "sign-up";
    const onProfile = segments[0] === "complete-profile";
    if (session) wasSignedIn.current = true;
    if (!session) {
      if (!onAuth) {
        if (!wasSignedIn.current) pendingPath.current = pendingLinkFor(pathname, segments[0], searchParams, segments) ?? pendingPath.current;
        router.replace("/sign-in");
      }
    }
    else if (needsProfile) { if (!onProfile) router.replace("/complete-profile"); }
    // Wait for `me` before leaving, so a new account never flashes the tabs on its way to its profile.
    else if ((onAuth || onProfile) && (me.data || me.isError)) {
      const next = pendingPath.current;
      pendingPath.current = null;
      router.replace((next ?? "/") as never);
    }
  }, [ready, session, needsProfile, me.data, me.isError, segments, pathname, router]);
  // The splash stays until the session and the saved Light/Dark choice are both read, so the first frame is in the right theme.
  useEffect(() => { if (ready && themeLoaded) SplashScreen.hideAsync().catch(() => {}); }, [ready, themeLoaded]);
  // Should reading the stored session ever stall, the splash still goes away.
  useEffect(() => {
    const timer = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, LAUNCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);
  // The window behind every screen follows the theme, so transitions and the keyboard never flash white in dark mode.
  useEffect(() => { SystemUI.setBackgroundColorAsync(colors.background).catch(() => {}); }, [colors.background]);
  // The session object changes on every token refresh; these effects care only whether someone is signed in.
  const signedIn = !!session;
  // A tapped push opens the screen for the path it carries (the same mapping as the Inbox), once.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);
  useEffect(() => {
    const path = notificationPath(lastResponse);
    if (!ready || !signedIn || !path || !lastResponse) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    // "reuse": a push for the Inbox while the Inbox is open leaves it in place instead of stacking a second one.
    resolveHref(path).then(route => openRoute(router, route ?? { pathname: "/inbox" }, "reuse")).catch(() => {});
    Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }, [ready, signedIn, lastResponse, router]);
  // Long-press app-icon shortcuts: offered only while signed in, and routed like any other link.
  useEffect(() => {
    QuickActions?.setItems(signedIn ? [
      { id: "scan", title: "Scan", subtitle: "Check in or open a code", icon: Platform.OS === "ios" ? "symbol:qrcode.viewfinder" : undefined, params: { href: "/scan" } },
    ] : [])?.catch(() => {});
  }, [signedIn]);
  // The shortcut that launched the app is followed once, not again after each sign-in or refresh.
  const launchedFromShortcut = useRef(false);
  useEffect(() => {
    if (!ready || !signedIn || !QuickActions) return;
    const go = (action: QuickAction | undefined) => { const href = action?.params?.href; if (href === "/scan") router.push(href); };
    if (!launchedFromShortcut.current) { launchedFromShortcut.current = true; go(QuickActions.initial); }
    const subscription = QuickActions.addListener(go);
    return () => subscription.remove();
  }, [ready, signedIn, router]);

  // React Navigation paints its own containers behind screens; without this they stay light grey in dark mode.
  const navigationTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: colors.background, card: colors.card, text: colors.foreground, border: colors.border, primary: colors.primary } };
  }, [dark, colors]);

  return (
    <NavigationTheme value={navigationTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="sign-up" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="complete-profile" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="q/[code]" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
      </Stack>
    </NavigationTheme>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    "LibreCaslonText-Regular": require("../../assets/fonts/LibreCaslonText-Regular.ttf"),
    "LibreCaslonText-SemiBold": require("../../assets/fonts/LibreCaslonText-SemiBold.ttf"),
    SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold,
  });
  // Fonts that fail fall back to the system faces; fonts that never answer must not hold the launch either.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    if (fontError) reportError(fontError, "render");
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontWaitOver(true), LAUNCH_WAIT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError && !fontWaitOver) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <Navigation />
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
