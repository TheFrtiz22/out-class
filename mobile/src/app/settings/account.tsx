import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Field } from "~/components/field";
import { Header, useHeaderInset } from "~/components/header";
import { ExternalLink, LogOut } from "~/components/icons";
import { SHEET_CLOSE_MS, useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { TurnstileSheet } from "~/components/turnstile";
import { Button, Card, Divider, ScreenScroll, Skeleton } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { config } from "~/lib/config";
import { easternLongDate } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import type { SignupOptions } from "~/lib/signup";
import { useTheme } from "~/lib/theme";
import type { AccountDeletionStatus, Me } from "~/lib/types";

type DeletionResult = { requestedAt: string; scheduledFor: string; emailSent: boolean; warnings: string[] };
const DELETION_KEY = ["account.deletion", null] as const;

/** The web's confirmation rule (lib/account-deletion.ts): the account's email, or the word DELETE. The server checks it again. */
const confirmationMatches = (input: string, email: string) => { const value = input.trim(); return value === "DELETE" || (!!email && value.toLowerCase() === email.trim().toLowerCase()); };

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 2 }}><Text variant="small">{label}</Text><Text variant="bodyStrong" selectable>{value}</Text></View>;
}

/** "Delete account" (components/settings/account-deletion.tsx): request with a 14-day grace period, or cancel. */
function AccountDeletion({ email, passwordAccount }: { email: string; passwordAccount: boolean }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const { confirm, sheet } = useConfirm();
  const status = useApiQuery<AccountDeletionStatus>("account.deletion");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState(false);
  // The same site key sign-in uses: the build's own, else the server's (a build without one would send no token, and be refused every time).
  const options = useApiQuery<SignupOptions>("auth.signupOptions", undefined, { anonymous: true, staleTime: 10 * 60_000, enabled: passwordAccount });
  const siteKey = config.turnstileSiteKey || options.data?.turnstileSiteKey || null;
  const opening = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (opening.current) clearTimeout(opening.current); }, []);
  const pending = status.data?.pending ?? null;
  const warnings = status.data?.warnings ?? [];
  const ready = confirmationMatches(typed, email) && (!passwordAccount || password.length > 0);

  const request = useMutation({
    mutationFn: (turnstileToken?: string) => api.post<DeletionResult>("account.deletion.request", { confirmation: typed, ...(passwordAccount ? { password, ...(turnstileToken ? { turnstileToken } : {}) } : {}) }),
    onSuccess: result => {
      client.setQueryData<AccountDeletionStatus>(DELETION_KEY, { pending: { requestedAt: result.requestedAt, scheduledFor: result.scheduledFor, emailSent: result.emailSent }, warnings: result.warnings });
      setTyped(""); setPassword("");
      setMessage(result.emailSent ? "Request received. We sent a confirmation to your university email." : "");
      haptics.confirm();
    },
    onError: reason => { setError(errorMessage(reason, "Could not request deletion.")); haptics.error(); },
  });
  const cancel = useMutation({
    mutationFn: () => api.post("account.deletion.cancel"),
    onMutate: () => { setMessage(""); setError(""); },
    onSuccess: () => {
      client.setQueryData<AccountDeletionStatus>(DELETION_KEY, current => ({ warnings: current?.warnings ?? [], pending: null }));
      setMessage("Deletion cancelled. Your account stays as it is."); haptics.confirm();
    },
    onError: reason => { setError(errorMessage(reason, "Could not cancel the request.")); haptics.error(); },
    onSettled: () => client.invalidateQueries({ queryKey: DELETION_KEY }),
  });

  async function submit() {
    if (opening.current) return;
    setMessage(""); setError("");
    // The question comes first and the check second: a sheet opened while another is still sliding away is
    // presented over it, and on iOS dismissing the one underneath took the new one with it (nothing on screen).
    const ok = await confirm({ title: "Delete your OutClass account?", description: "Your account will be deleted in 14 days. You can cancel any time before then from this page.", confirmLabel: "Delete account", destructive: true });
    if (!ok) return;
    // Password accounts pass the same quick check as sign-in, once the confirm sheet has gone.
    if (passwordAccount && siteKey) { opening.current = setTimeout(() => { opening.current = null; setChallenge(true); }, SHEET_CLOSE_MS + 60); return; }
    request.mutate(undefined);
  }

  return (
    <Card style={{ gap: 12 }} testID="account-deletion">
      <Text variant="section" accessibilityRole="header">Delete account</Text>
      {status.isError && status.data ? <Text variant="caption" accessibilityRole="alert">Couldn’t refresh this status. Showing what was last loaded.</Text> : null}
      {status.isPending ? <View style={{ gap: 10 }}><Skeleton width="85%" /><Skeleton width="70%" /><Skeleton width={150} height={44} radius={22} /></View>
        : status.isError && !status.data ? <View style={{ gap: 8 }}><Text variant="small" color={colors.destructive} accessibilityRole="alert">{errorMessage(status.error)}</Text><Button variant="secondary" size="compact" label="Try again" onPress={() => status.refetch()} /></View>
          : pending ? (
            <>
              <Text testID="account-deletion-scheduled" variant="body">Your account is scheduled for deletion on <Text variant="bodyStrong">{easternLongDate(pending.scheduledFor)}</Text>.</Text>
              {!pending.emailSent ? <Text variant="small" color={colors.foreground}>We couldn’t send the confirmation email. Your request is saved, and you can cancel here until that date.</Text> : null}
              <Button variant="secondary" testID="account-deletion-cancel" loading={cancel.isPending} label={cancel.isPending ? "Cancelling…" : "Cancel deletion"} onPress={() => cancel.mutate()} />
            </>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                {[
                  "Your profile, résumé, headshot, files and in-progress applications are deleted.",
                  "For decided applications, the club keeps its own review notes and the decision, linked to an anonymized placeholder. Your answers are removed.",
                  "Decision letters and interview copies of your résumé that a club already holds stay with that club’s records.",
                  "Attendance and audit history keep only the anonymized placeholder.",
                  "You can cancel within 14 days.",
                ].map(line => (
                  <View key={line} style={{ flexDirection: "row", gap: 8 }}>
                    <Text variant="small" accessibilityElementsHidden importantForAccessibility="no">•</Text>
                    <Text variant="small" style={{ flex: 1 }}>{line}</Text>
                  </View>
                ))}
              </View>
              <Field label="Type your university email or DELETE" testID="account-deletion-confirm" autoCapitalize="none" autoCorrect={false} spellCheck={false} autoComplete="off" value={typed} onChangeText={setTyped} editable={!request.isPending} />
              {passwordAccount
                ? <Field label="Current password" testID="account-deletion-password" secureTextEntry autoComplete="current-password" textContentType="password" value={password} onChangeText={setPassword} editable={!request.isPending} />
                : <Text variant="small">If you signed in more than 10 minutes ago, sign out and back in first.</Text>}
              <Button variant="destructive" testID="account-deletion-submit" disabled={!ready} loading={request.isPending} label={request.isPending ? "Requesting…" : "Delete account"} onPress={() => submit()} />
            </>
          )}
      {warnings.map(warning => <Text key={warning} variant="small">{warning}</Text>)}
      {message ? <Text testID="account-deletion-message" variant="small" color={colors.foreground} accessibilityLiveRegion="polite">{message}</Text> : null}
      {error ? <Text testID="account-deletion-error" variant="small" color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
      {sheet}
      <TurnstileSheet open={challenge} siteKey={siteKey} purpose="requesting deletion" onClose={() => setChallenge(false)} onToken={token => { setChallenge(false); request.mutate(token); }} />
    </Card>
  );
}

/** Account & Security (components/settings/account-settings.tsx). */
export default function AccountSettings() {
  const top = useHeaderInset();
  const { session, signOut } = useAuth();
  const { confirm, sheet } = useConfirm();
  const me = useApiQuery<Me>("me", undefined, { staleTime: 5 * 60_000 });
  const [leaving, setLeaving] = useState(false);
  const email = me.data?.email ?? session?.user.email ?? "";
  // The same rule as the web's Settings page: an "email" identity means the account has a password.
  const meta = (session?.user.app_metadata ?? {}) as { providers?: unknown; provider?: unknown };
  const passwordAccount = Array.isArray(meta.providers) ? meta.providers.includes("email") : meta.provider === "email";

  async function leave() {
    const ok = await confirm({ title: "Sign out?", confirmLabel: "Sign out" });
    if (!ok) return;
    setLeaving(true);
    // signOut() stops this device's pushes itself, within its own deadline.
    try { await signOut(); } finally { setLeaving(false); }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} automaticallyAdjustKeyboardInsets testID="settings-account-screen">
        <Card style={{ gap: 14 }}>
          <Text variant="section" accessibilityRole="header">Sign-in information</Text>
          <Detail label="University email" value={email} />
          <Detail label="University" value="University of Virginia" />
          <Detail label="Sign-in method" value={passwordAccount ? "Email and password" : "University sign-in"} />
          <Divider />
          <Button variant="secondary" icon={LogOut} testID="settings-sign-out" loading={leaving} label="Sign out" onPress={leave} />
        </Card>
        <Card style={{ gap: 10 }}>
          <Text variant="section" accessibilityRole="header">Password & security</Text>
          <Text variant="small">{passwordAccount ? "Request a secure reset link at your university email to change your password." : "Your sign-in provider manages your password. Use your university account’s security settings to update it."}</Text>
          <Button variant="secondary" icon={ExternalLink} testID="settings-security-web" label="Open on web" accessibilityHint="Password and two-step sign-in settings on the site" onPress={() => { openOnWeb("/settings/account"); }} />
        </Card>
        {email ? <AccountDeletion email={email} passwordAccount={passwordAccount} /> : null}
      </ScreenScroll>
      <Header title="Account & Security" back />
      {sheet}
    </View>
  );
}
