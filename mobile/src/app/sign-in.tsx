import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field, type FieldRef } from "~/components/field";
import { Text } from "~/components/text";
import { TurnstileSheet } from "~/components/turnstile";
import { Button } from "~/components/ui";
import { useAuth } from "~/lib/auth";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import type { SignupOptions } from "~/lib/signup";
import { useTheme } from "~/lib/theme";

export default function SignIn() {
  const { colors, dark } = useTheme();
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

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, gap: 28 }}>
        <View style={{ gap: 18 }}>
          <Image accessibilityLabel="OutClass" source={dark ? require("../../assets/brand/10_hero_transparent.svg") : require("../../assets/brand/02_primary_lockup.svg")} style={{ width: 190, height: 52 }} contentFit="contain" contentPosition="left" />
          <View style={{ gap: 6 }}>
            <Text variant="display" accessibilityRole="header">Sign in</Text>
            <Text variant="body" color={colors.mutedForeground}>Sign in with your UVA account.</Text>
          </View>
        </View>
        <View style={{ gap: 14 }}>
          <Field label="UVA email" testID="sign-in-email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <Field ref={passwordRef} label="Password" testID="sign-in-password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => submit()} />
          {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
          <Button full size="large" label="Sign in" testID="sign-in-submit" loading={busy} onPress={() => submit()} />
        </View>
        <View style={{ gap: 4, alignItems: "center" }}>
          <Text variant="small" color={colors.mutedForeground}>New to OutClass?</Text>
          <Button variant="secondary" full label="Create an account" testID="sign-in-sign-up" onPress={() => router.push("/sign-up")} />
          <Button variant="ghost" size="compact" label="Forgot password?" testID="sign-in-forgot" onPress={() => { WebBrowser.openBrowserAsync(`${config.apiUrl}/forgot-password`).catch(() => {}); }} />
        </View>
      </ScrollView>
      <TurnstileSheet open={challenge} siteKey={siteKey} onClose={() => setChallenge(false)} onToken={token => { setChallenge(false); submit(token); }} />
    </KeyboardAvoidingView>
  );
}
