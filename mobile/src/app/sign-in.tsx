import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field, type FieldRef } from "~/components/field";
import { CalendarClock, ClipboardCheck, Compass } from "~/components/icons";
import { Text } from "~/components/text";
import { TurnstileSheet } from "~/components/turnstile";
import { Button } from "~/components/ui";
import { useAuth } from "~/lib/auth";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import type { SignupOptions } from "~/lib/signup";
import { useTheme } from "~/lib/theme";

/** What OutClass does, in the web landing page's words. */
const WELCOME_POINTS = [
  { icon: Compass, label: "Discover clubs that fit you" },
  { icon: ClipboardCheck, label: "Apply and track every application" },
  { icon: CalendarClock, label: "See interviews and decisions as they happen" },
];

export default function SignIn() {
  const { colors, a11y } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const passwordRef = useRef<FieldRef>(null);
  // The check's site key: this build's, or the one the server gives the sign-up screens.
  const options = useApiQuery<SignupOptions>("auth.signupOptions", undefined, { anonymous: true, staleTime: 10 * 60_000 });
  const siteKey = config.turnstileSiteKey || options.data?.turnstileSiteKey || null;

  async function submit(captchaToken?: string) {
    if (!email.trim()) { setError("Enter your UVA email first."); return; }
    if (!password) { setError("Enter your password."); return; }
    setBusy(true); setError("");
    const failure = await signIn(email, password, captchaToken);
    setBusy(false);
    if (!failure) { haptics.confirm(); return; }
    // Supabase enforces Turnstile on password sign-in only when its captcha setting is on
    // (docs/turnstile.md, stage 2): ask for the check only then, and retry once with its token.
    if (failure.needsCaptcha && !captchaToken && siteKey) { setChallenge(true); return; }
    haptics.error();
    setError(failure.needsCaptcha && !siteKey ? "Sign-in needs a security check this copy of the app can't load. Try again in a moment." : failure.message);
  }

  const enter = (order: number) => (a11y.reduceMotion ? undefined : FadeInDown.duration(420).delay(80 * order));

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }}>
        {/* The welcome: OutClass's navy, the ivory hero logo and the web's own promise. */}
        <View testID="sign-in-welcome" style={{ backgroundColor: colors.rail, paddingTop: insets.top + 28, paddingHorizontal: 24, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 18, overflow: "hidden" }}>
          <Image accessibilityLabel="OutClass" source={require("../../assets/brand/10_hero_transparent.svg")} style={{ width: 176, height: 44 }} contentFit="contain" contentPosition="left" />
          <Animated.View entering={enter(0)} style={{ gap: 10 }}>
            <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: colors.brandOrange }} />
            <Text variant="display" accessibilityRole="header" color={colors.railText}>Welcome to OutClass</Text>
            <Text variant="body" color={colors.railMuted}>Find and apply to UVA clubs, then track applications, interviews and decisions in one place.</Text>
          </Animated.View>
          <Animated.View entering={enter(1)} style={{ gap: 12 }}>
            {WELCOME_POINTS.map(({ icon: Icon, label }) => (
              <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,245,241,0.10)" }}>
                  <Icon size={18} color={colors.brandOrange} />
                </View>
                <Text variant="smallStrong" color={colors.railText} style={{ flex: 1 }}>{label}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={enter(2)} style={{ paddingHorizontal: 24, paddingTop: 28, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text variant="title">Sign in</Text>
            <Text variant="small" color={colors.mutedForeground}>Use your UVA email and OutClass password.</Text>
          </View>
          <Field label="UVA email" testID="sign-in-email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <Field ref={passwordRef} label="Password" testID="sign-in-password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => submit()} />
          {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button full size="large" label="Sign in" testID="sign-in-submit" loading={busy} onPress={() => submit()} />
          {/* Button sizes to its label and sits at the start unless told otherwise; this one is centred. */}
          <Button variant="ghost" size="compact" label="Forgot password?" testID="sign-in-forgot" style={{ alignSelf: "center" }} onPress={() => { WebBrowser.openBrowserAsync(`${config.apiUrl}/forgot-password`).catch(() => {}); }} />
        </Animated.View>

        <Animated.View entering={enter(3)} style={{ paddingHorizontal: 24, paddingTop: 18, gap: 10, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text variant="small" color={colors.mutedForeground}>New to OutClass?</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
          <Button variant="secondary" full label="Create an account" testID="sign-in-sign-up" onPress={() => router.push("/sign-up")} />
        </Animated.View>
      </ScrollView>
      <TurnstileSheet open={challenge} siteKey={siteKey} onClose={() => setChallenge(false)} onToken={token => { setChallenge(false); submit(token); }} />
    </KeyboardAvoidingView>
  );
}
