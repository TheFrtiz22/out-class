import { SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold } from "@expo-google-fonts/source-sans-3";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Component, type ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "~/components/text";
import { Button } from "~/components/ui";
import { AuthProvider, useAuth } from "~/lib/auth";
import { createQueryClient } from "~/lib/query";
import { reportError } from "~/lib/report";
import { ThemeProvider, useTheme } from "~/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** The last line of defence: a calm screen and a way back, never a white screen. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { reportError(error, "render"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: "#f6f5f1" }}>
        <Text variant="title" align="center" color="#232d4b">Something went wrong</Text>
        <Text variant="small" align="center" color="#52606d">Your work is saved on the server. Try opening the app again.</Text>
        <Button label="Try again" onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

function Navigation() {
  const { session } = useAuth();
  const { colors, dark } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const ready = session !== undefined;

  useEffect(() => {
    if (!ready) return;
    const onSignIn = segments[0] === "sign-in";
    if (!session && !onSignIn) router.replace("/sign-in");
    else if (session && onSignIn) router.replace("/");
  }, [ready, session, segments, router]);
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "default", gestureEnabled: true, fullScreenGestureEnabled: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="pass" options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    "LibreCaslonText-Regular": require("../../assets/fonts/LibreCaslonText-Regular.ttf"),
    "LibreCaslonText-SemiBold": require("../../assets/fonts/LibreCaslonText-SemiBold.ttf"),
    SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_600SemiBold, SourceSans3_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <ErrorBoundary>
              <AuthProvider>
                <Navigation />
              </AuthProvider>
            </ErrorBoundary>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
