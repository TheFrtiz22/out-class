import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Display, Logo, PrimaryButton } from "@/components/ui";
import { isUvaEmail, supabase } from "@/lib/supabase";
import { font, radius, space, text, useTheme } from "@/theme/tokens";

/**
 * Same sign-in options as the web (components/views/auth-view.tsx): UVA email
 * with a password, or a 6-digit emailed code. Neither creates accounts; new
 * students create their profile on the web first.
 */
type Step = "password" | "request-code" | "verify-code";

export default function SignIn() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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

  const field = [styles.input, text.body, { color: t.ink, backgroundColor: t.scheme === "dark" ? t.raised : "#fffefb", borderColor: t.scheme === "dark" ? t.hairline : "#d5dad6" }];
  const label = [text.label, { fontSize: 14, color: t.ink, marginBottom: 6 }];

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
          <View style={[styles.hero, { paddingTop: insets.top + space.xl }]}>
            <Image source={require("@/assets/campus/sunset-rotunda-960.webp")} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={["rgba(14,35,56,0.62)", "rgba(14,35,56,0.30)", "rgba(14,35,56,0.78)", "rgba(14,35,56,0.94)"]} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
            <View style={{ zIndex: 1, alignSelf: "flex-start" }}><Logo onNavy width={140} /></View>
            <View style={{ flex: 1 }} />
            <Text style={[text.eyebrow, { color: "rgba(255,249,241,0.78)" }]}>Made for University of Virginia</Text>
            <Text style={styles.heroLine}>Find and apply to UVA clubs with one profile.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.edge, boxShadow: t.shadow }]}>
            <Display size="title" style={{ fontSize: 29, lineHeight: 33 }}>Welcome back</Display>
            <Text style={[text.body, { color: t.muted, marginTop: 6 }]}>Sign in with your UVA account.</Text>
            <View style={[styles.rule, { backgroundColor: t.hairline }]} />

            <Text style={label}>Email address</Text>
            <TextInput accessibilityLabel="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username"
              placeholder="computingid@virginia.edu" placeholderTextColor={t.faint} style={field} value={email} editable={step !== "verify-code"} onChangeText={setEmail} />
            <Text style={[text.small, { color: t.muted, marginTop: 6, marginBottom: space.lg }]}>Use your @virginia.edu email address.</Text>

            {step === "password" && (
              <>
                <Text style={label}>Password</Text>
                <TextInput accessibilityLabel="Password" secureTextEntry autoComplete="current-password" textContentType="password" style={[field, { marginBottom: space.lg }]} value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
                <PrimaryButton label="Sign in" onPress={signIn} loading={loading} disabled={!email || !password} />
                <Choice label="Use an email code instead" onPress={() => { setError(""); setStep("request-code"); }} />
              </>
            )}
            {step === "request-code" && (
              <>
                <PrimaryButton label="Email me a code" onPress={requestCode} loading={loading} disabled={!email} />
                <Choice label="Use my password" onPress={() => { setError(""); setStep("password"); }} />
              </>
            )}
            {step === "verify-code" && (
              <>
                <Text style={label}>6-digit code</Text>
                <TextInput accessibilityLabel="6-digit code" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6}
                  style={[field, { marginBottom: space.xl, fontFamily: font.textSemibold, fontSize: 22, letterSpacing: 8, textAlign: "center" }]} value={code} onChangeText={setCode} />
                <PrimaryButton label="Verify and sign in" onPress={verifyCode} loading={loading} disabled={code.length !== 6} />
                <Choice label="Use a different email" onPress={() => { setStep("request-code"); setCode(""); setNotice(""); }} />
              </>
            )}

            {notice ? <Text style={[text.body, { color: t.success, marginTop: space.md }]}>{notice}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginTop: space.md }]}>{error}</Text> : null}

            <View style={[styles.rule, { backgroundColor: t.hairline }]} />
            <Text style={[text.body, { color: t.muted, textAlign: "center" }]}>New to OutClass? <Text style={[text.bodyStrong, { color: t.ink }]}>Create your profile at out-class.net</Text></Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: "center", alignItems: "center", marginTop: 4 }}>
      <Text style={[text.bodyStrong, { color: t.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { height: 300, paddingHorizontal: space.xl, paddingBottom: 64, overflow: "hidden" },
  heroLine: { fontFamily: font.display, fontSize: 27, lineHeight: 31, color: "#fff9f1", marginTop: space.sm, letterSpacing: -0.3 },
  card: { marginTop: -40, marginHorizontal: space.lg, borderRadius: radius.xl, borderWidth: 1, padding: space.xl, paddingTop: space.xxl, borderCurve: "continuous" },
  input: { height: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.lg },
  rule: { height: 1, marginVertical: space.lg },
});
