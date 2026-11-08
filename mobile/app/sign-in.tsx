import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Title } from "@/components/ui";
import { isUvaEmail, supabase } from "@/lib/supabase";
import { radius, space, type, useTheme } from "@/theme/tokens";

/**
 * Same sign-in options as the web (components/views/auth-view.tsx): UVA email
 * with a password, or a 6-digit emailed code. Neither creates accounts; new
 * students sign up on the web first.
 */
type Step = "password" | "request-code" | "verify-code";

export default function SignIn() {
  const t = useTheme();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const normalized = email.trim().toLowerCase();

  async function run(action: () => Promise<void>) {
    setError("");
    setLoading(true);
    try { await action(); } catch { setError("Something went wrong. Please try again."); } finally { setLoading(false); }
  }

  const signIn = () => run(async () => {
    if (!isUvaEmail(normalized)) return setError("Use your UVA email ending in @virginia.edu.");
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error) setError(error.message);
  });

  const requestCode = () => run(async () => {
    if (!isUvaEmail(normalized)) return setError("Enter your UVA email first.");
    const { error } = await supabase.auth.signInWithOtp({ email: normalized, options: { shouldCreateUser: false } });
    if (error) return setError(error.status === 429 ? "Too many requests. Wait a minute and try again." : "We couldn’t send a code to that address.");
    setStep("verify-code");
    setNotice(`We sent a 6-digit code to ${normalized}.`);
  });

  const verifyCode = () => run(async () => {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code.");
    const { data, error } = await supabase.auth.verifyOtp({ email: normalized, token: code, type: "email" });
    if (error || data.user?.email?.toLowerCase() !== normalized) {
      await supabase.auth.signOut();
      setError("That code didn’t work. Check it or request a new one.");
    }
  });

  const input = [styles.input, type.body, { color: t.foreground, backgroundColor: t.card, borderColor: t.border }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={[type.headline, { color: t.brand, marginBottom: space.sm }]}>OutClass</Text>
          <Title>Sign in</Title>
          <Text style={[type.body, { color: t.mutedForeground, marginTop: space.sm, marginBottom: space.xl }]}>
            One profile for every club at UVA.
          </Text>

          <Text style={[type.caption, { color: t.mutedForeground }]}>UVA email</Text>
          <TextInput
            accessibilityLabel="UVA email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="computingid@virginia.edu"
            placeholderTextColor={t.input}
            style={input}
            value={email}
            editable={step !== "verify-code"}
            onChangeText={setEmail}
          />

          {step === "password" && (
            <>
              <Text style={[type.caption, { color: t.mutedForeground }]}>Password</Text>
              <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" style={input} value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
              <Button label="Sign in" onPress={signIn} loading={loading} disabled={!email || !password} />
              <LinkButton label="Email me a code instead" onPress={() => { setError(""); setStep("request-code"); }} />
            </>
          )}

          {step === "request-code" && (
            <>
              <Button label="Send code" onPress={requestCode} loading={loading} disabled={!email} />
              <LinkButton label="Use my password" onPress={() => { setError(""); setStep("password"); }} />
            </>
          )}

          {step === "verify-code" && (
            <>
              <Text style={[type.caption, { color: t.mutedForeground }]}>6-digit code</Text>
              <TextInput accessibilityLabel="6-digit code" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} style={input} value={code} onChangeText={setCode} />
              <Button label="Verify" onPress={verifyCode} loading={loading} disabled={code.length !== 6} />
              <LinkButton label="Use a different email" onPress={() => { setStep("request-code"); setCode(""); setNotice(""); }} />
            </>
          )}

          {notice ? <Text style={[type.body, { color: t.success, marginTop: space.lg }]}>{notice}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={[type.body, { color: t.destructive, marginTop: space.lg }]}>{error}</Text> : null}

          <View style={{ height: space.xxl }} />
          <Text style={[type.caption, { color: t.mutedForeground }]}>New to OutClass? Create your account at out-class.net, then sign in here.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingVertical: space.md, alignItems: "center" }}>
      <Text style={[type.headline, { color: t.info }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.xl, paddingTop: space.xxl },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 14, marginTop: space.xs, marginBottom: space.lg },
});
