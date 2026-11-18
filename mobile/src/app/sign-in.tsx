import { Image } from "expo-image";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field, type FieldRef } from "~/components/field";
import { Text } from "~/components/text";
import { TurnstileSheet } from "~/components/turnstile";
import { Button } from "~/components/ui";
import { useAuth } from "~/lib/auth";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

export default function SignIn() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(false);
  const passwordRef = useRef<FieldRef>(null);

  async function submit(captchaToken?: string) {
    if (!email.trim()) { setError("Enter your UVA email first."); return; }
    if (!password) { setError("Enter your password."); return; }
    // Production may enforce Turnstile on password sign-in (docs/turnstile.md): get a token first.
    if (config.turnstileSiteKey && !captchaToken) { setChallenge(true); return; }
    setBusy(true); setError("");
    const failure = await signIn(email, password, captchaToken);
    setBusy(false);
    if (failure) { haptics.error(); setError(failure); } else haptics.confirm();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
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
        <Text variant="caption" align="center">New to OutClass? Create your account at out-class.net, then sign in here.</Text>
      </ScrollView>
      <TurnstileSheet open={challenge} onClose={() => setChallenge(false)} onToken={token => { setChallenge(false); submit(token); }} />
    </KeyboardAvoidingView>
  );
}
