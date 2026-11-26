import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field, type FieldRef } from "~/components/field";
import { ArrowLeft } from "~/components/icons";
import { TermsCheckbox } from "~/components/terms-checkbox";
import { Text } from "~/components/text";
import { TurnstileSheet } from "~/components/turnstile";
import { Button, TARGET, useScreenGutters } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { PASSWORD_HINT, emailIssue, nameIssue, passwordIssue, rememberPasswordNotSaved, rememberTermsAccepted, type SignupOptions } from "~/lib/signup";
import { supabase } from "~/lib/supabase";
import { useTheme } from "~/lib/theme";

type Errors = Partial<Record<"firstName" | "lastName" | "email" | "password" | "terms" | "code" | "form", string>>;
type Pending = { kind: "register" } | { kind: "resend" };

/**
 * Account creation, the same steps as the web's sign-up: name, UVA email and password, then the
 * 6-digit code emailed to that address. Confirming the code signs the person in; the profile
 * screen (complete-profile) comes next through the navigation gate in _layout.
 */
export default function SignUp() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const gutters = useScreenGutters(24);
  const router = useRouter();
  const options = useApiQuery<SignupOptions>("auth.signupOptions", undefined, { anonymous: true, staleTime: 10 * 60_000 });
  const siteKey = options.data?.turnstileSiteKey ?? config.turnstileSiteKey ?? null;
  const termsRequired = options.data?.termsRequired === true;

  const [step, setStep] = useState<"account" | "code">("account");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Pending | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const lastRef = useRef<FieldRef>(null), emailRef = useRef<FieldRef>(null), passwordRef = useRef<FieldRef>(null);
  const verifying = useRef(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const address = email.trim().toLowerCase();

  async function register(captchaToken?: string) {
    if (busy) return;
    const found: Errors = {
      firstName: nameIssue(firstName, "First") ?? undefined,
      lastName: nameIssue(lastName, "Last") ?? undefined,
      email: emailIssue(email) ?? undefined,
      password: passwordIssue(password) ?? undefined,
      terms: termsRequired && !acceptTerms ? "Accept the Terms and Privacy Policy to continue." : undefined,
    };
    if (Object.values(found).some(Boolean)) { haptics.error(); setErrors(found); return; }
    if (options.isPending) { setErrors({ form: "Still getting ready. Try again in a moment." }); return; }
    if (siteKey && !captchaToken) { setChallenge({ kind: "register" }); return; }
    setBusy(true); setErrors({}); setNotice("");
    try {
      await api.post("auth.register", { firstName: firstName.trim(), lastName: lastName.trim(), email: address, password, acceptTerms: termsRequired ? acceptTerms : undefined, turnstileToken: captchaToken }, { anonymous: true });
      haptics.confirm();
      setCode(""); setStep("code"); setResendIn(60);
    } catch (error) {
      haptics.error();
      setErrors({ form: errorMessage(error) });
    } finally { setBusy(false); }
  }

  async function confirm(value = code) {
    if (verifying.current) return;
    if (!/^\d{6}$/.test(value)) { setErrors({ code: "Enter the 6-digit code from the email." }); return; }
    verifying.current = true; setBusy(true); setErrors({}); setNotice("");
    try {
      const result = await api.post<{ session: { access_token: string; refresh_token: string }; passwordSaved?: boolean }>("auth.confirmEmail", { email: address, code: value, password }, { anonymous: true });
      if (termsRequired && acceptTerms) rememberTermsAccepted(address);
      if (result.passwordSaved === false) rememberPasswordNotSaved(address);
      const { error } = await supabase.auth.setSession(result.session);
      if (error) throw error;
      haptics.confirm();
      // The navigation gate takes a new account to complete-profile.
    } catch (error) {
      haptics.error();
      setErrors({ code: errorMessage(error) });
      setCode("");
    } finally { verifying.current = false; setBusy(false); }
  }

  async function resend(captchaToken?: string) {
    if (busy || resendIn > 0) return;
    if (siteKey && !captchaToken) { setChallenge({ kind: "resend" }); return; }
    setBusy(true); setErrors({}); setNotice("");
    const { error } = await supabase.auth.resend({ type: "signup", email: address, options: captchaToken ? { captchaToken } : undefined }).catch(() => ({ error: { status: 0, message: "" } }));
    setBusy(false);
    if (!error) { setNotice("We sent a new code."); setResendIn(60); return; }
    setErrors({ form: error.status === 429 ? "Too many codes requested. Wait a minute, then try again." : "We couldn't send a new code. Check your connection and try again." });
    if (error.status === 429) setResendIn(60);
  }

  function changeEmail() {
    setStep("account"); setCode(""); setErrors({}); setNotice("");
    setTimeout(() => emailRef.current?.focus(), 250);
  }


  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, ...gutters.padding, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, gap: 24 }}>
        <Pressable testID="sign-up-back" accessibilityRole="button" accessibilityLabel={step === "code" ? "Back to your details" : "Back to sign in"} hitSlop={8}
          onPress={() => step === "code" ? changeEmail() : router.canGoBack() ? router.back() : router.replace("/sign-in")}
          style={{ width: TARGET, height: TARGET, marginLeft: -10, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        {step === "account" ? (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="display" accessibilityRole="header">Create your account</Text>
              <Text variant="body" color={colors.mutedForeground}>Use your UVA email. We'll send a code to confirm it.</Text>
            </View>
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="First name" testID="sign-up-first" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" returnKeyType="next" maxLength={50} onSubmitEditing={() => lastRef.current?.focus()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field ref={lastRef} label="Last name" testID="sign-up-last" value={lastName} onChangeText={setLastName} error={errors.lastName} autoComplete="family-name" textContentType="familyName" autoCapitalize="words" returnKeyType="next" maxLength={50} onSubmitEditing={() => emailRef.current?.focus()} />
                </View>
              </View>
              <Field ref={emailRef} label="UVA email" testID="sign-up-email" placeholder="abc1de@virginia.edu" value={email} onChangeText={setEmail} error={errors.email} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" textContentType="username" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
              <Field ref={passwordRef} label="Password" testID="sign-up-password" value={password} onChangeText={setPassword} error={errors.password} hint={PASSWORD_HINT} secureTextEntry autoComplete="new-password" textContentType="newPassword" passwordRules="minlength: 10; required: lower; required: digit;" returnKeyType="go" onSubmitEditing={() => register()} />
              {termsRequired ? <TermsCheckbox testID="sign-up-terms" checked={acceptTerms} onChange={setAcceptTerms} error={errors.terms} /> : null}
              {errors.form ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite">{errors.form}</Text> : null}
              <Button full size="large" label="Create account" testID="sign-up-submit" loading={busy} onPress={() => register()} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <Text variant="small" color={colors.mutedForeground}>Already have an account?</Text>
              <Pressable testID="sign-up-sign-in" accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/sign-in")} hitSlop={8} style={{ minHeight: TARGET, justifyContent: "center" }}>
                <Text variant="smallStrong" color={colors.primary}>Sign in</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={{ gap: 6 }}>
              <Text variant="display" accessibilityRole="header">Check your email</Text>
              <Text variant="body" color={colors.mutedForeground}>Enter the 6-digit code we sent to {address}. It can take a minute to arrive, so check Junk too.</Text>
              <Text variant="small" color={colors.mutedForeground}>Already have an account with this email? Go back and sign in instead.</Text>
            </View>
            <View style={{ gap: 14 }}>
              <Field label="Code" testID="sign-up-code" value={code} error={errors.code} autoFocus keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} returnKeyType="go"
                style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }}
                onChangeText={text => { const digits = text.replace(/\D/g, "").slice(0, 6); setCode(digits); if (digits.length === 6) confirm(digits); }}
                onSubmitEditing={() => confirm()} />
              {notice ? <Text variant="small" color={colors.success} accessibilityLiveRegion="polite">{notice}</Text> : null}
              {errors.form ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite">{errors.form}</Text> : null}
              <Button full size="large" label="Confirm email" testID="sign-up-confirm" loading={busy} onPress={() => confirm()} />
              <Button full variant="secondary" label={resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"} testID="sign-up-resend" disabled={resendIn > 0 || busy} onPress={() => resend()} />
              <Button full variant="ghost" label="Use a different email" testID="sign-up-change-email" onPress={changeEmail} />
            </View>
          </>
        )}
      </ScrollView>
      <TurnstileSheet open={challenge !== null} siteKey={siteKey} action="signup" purpose="creating your account" onClose={() => setChallenge(null)}
        onToken={token => { const pending = challenge; setChallenge(null); if (pending?.kind === "resend") resend(token); else register(token); }} />
    </KeyboardAvoidingView>
  );
}
