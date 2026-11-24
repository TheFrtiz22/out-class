import { useLocalSearchParams, useRouter } from "expo-router";
import { useLinkingURL } from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Field, type FieldRef } from "~/components/field";
import { Text } from "~/components/text";
import { Button } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { authenticatorIssue, resetTokenFrom } from "~/lib/password-reset";
import { PASSWORD_HINT, passwordIssue } from "~/lib/signup";
import { useTheme } from "~/lib/theme";

/**
 * Set a new password from the emailed reset link, without leaving the app. The server runs the
 * website's own reset (and then signs the account out everywhere), so afterwards the person signs
 * in again with the new password, on this phone too.
 */
export default function ResetPassword() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const params = useLocalSearchParams();
  const linkUrl = useLinkingURL();
  const token = useMemo(() => resetTokenFrom(params, linkUrl), [params, linkUrl]);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [usesAuthenticator, setUsesAuthenticator] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string; code?: string }>({});
  const [failure, setFailure] = useState<{ message: string; newLink: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<FieldRef>(null);
  const codeRef = useRef<FieldRef>(null);

  const requestNewLink = () => { WebBrowser.openBrowserAsync(`${config.apiUrl}/forgot-password`).catch(() => {}); };
  const toSignIn = () => router.replace("/sign-in");

  async function submit() {
    if (!token || busy) return;
    const next = {
      password: passwordIssue(password) ?? undefined,
      confirmation: confirmation !== password ? "The passwords don't match." : undefined,
      code: usesAuthenticator ? authenticatorIssue(code) ?? undefined : undefined,
    };
    setErrors(next);
    setFailure(null);
    if (next.password || next.confirmation || next.code) { haptics.error(); return; }
    setBusy(true);
    try {
      await api.post("auth.resetPassword", { tokenHash: token, password, confirmation, ...(usesAuthenticator && code ? { authenticatorCode: code } : {}) }, { anonymous: true });
      haptics.confirm();
      // The server already signed the reset account out everywhere. The phone may be signed in to that
      // account or another one, so it only drops its own session here and never ends anyone's others.
      if (session) await signOut({ thisDeviceOnly: true }).catch(() => {});
      setPassword(""); setConfirmation(""); setCode("");
      setDone(true);
    } catch (error) {
      haptics.error();
      setFailure({ message: errorMessage(error), newLink: error instanceof ApiError && error.code === "RESET_LINK_INVALID" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: colors.brandOrange }} />
          <Text variant="title" accessibilityRole="header">{done ? "Password updated" : "Set a new password"}</Text>
        </View>

        {done ? (
          <View testID="reset-password-done" style={{ gap: 16 }}>
            <Text variant="body" color={colors.mutedForeground}>Sign in with your new password. You've been signed out on your other devices too.</Text>
            <Button full size="large" label="Sign in" testID="reset-password-sign-in" onPress={toSignIn} />
          </View>
        ) : !token ? (
          <View testID="reset-password-no-link" style={{ gap: 16 }}>
            <Text variant="body" color={colors.mutedForeground}>This reset link is incomplete. Open the newest reset email again, or request a new link.</Text>
            <Button full label="Request a new link" testID="reset-password-new-link" onPress={requestNewLink} />
            <Button variant="ghost" label="Back to sign in" testID="reset-password-back" style={{ alignSelf: "center" }} onPress={toSignIn} />
          </View>
        ) : (
          <View testID="reset-password-form" style={{ gap: 14 }}>
            <Text variant="small" color={colors.mutedForeground}>Choose a new password for your OutClass account. The link works once and expires an hour after it was sent.</Text>
            <Field label="New password" testID="reset-password-password" value={password} onChangeText={setPassword} error={errors.password} hint={PASSWORD_HINT} secureTextEntry autoComplete="new-password" textContentType="newPassword" passwordRules="minlength: 10; required: lower; required: digit;" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
            <Field ref={confirmRef} label="Confirm new password" testID="reset-password-confirmation" value={confirmation} onChangeText={setConfirmation} error={errors.confirmation} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType={usesAuthenticator ? "next" : "go"} onSubmitEditing={() => (usesAuthenticator ? codeRef.current?.focus() : submit())} />
            {usesAuthenticator ? (
              <Field ref={codeRef} label="Authenticator code" testID="reset-password-code" value={code} onChangeText={value => setCode(value.replace(/\D/g, "").slice(0, 6))} error={errors.code} hint="The 6-digit code from your authenticator app." keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" returnKeyType="go" onSubmitEditing={() => submit()} />
            ) : (
              <Button variant="ghost" size="compact" label="My account uses an authenticator app" testID="reset-password-use-code" style={{ alignSelf: "flex-start" }} onPress={() => setUsesAuthenticator(true)} />
            )}
            {failure ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="reset-password-error">{failure.message}</Text> : null}
            {failure?.newLink ? (
              <Button full variant="secondary" label="Request a new link" testID="reset-password-new-link" onPress={requestNewLink} />
            ) : null}
            <Button full size="large" label="Update password" testID="reset-password-submit" loading={busy} onPress={submit} />
            <Button variant="ghost" label="Back to sign in" testID="reset-password-back" style={{ alignSelf: "center" }} onPress={toSignIn} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
