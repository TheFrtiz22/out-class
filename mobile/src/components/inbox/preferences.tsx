import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Divider, Segmented, Skeleton, TARGET, Toggle } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { push, type PushStatus } from "~/lib/push";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { NotificationPreferences as Preferences } from "~/lib/types";

// The web's toggles and wording (components/communications-preferences.tsx).
const fields = [
  ["emailAnnouncements", "Club announcements"],
  ["emailApplications", "Application updates and decisions"],
  ["emailInterviews", "Interview updates"],
  ["emailInvitations", "Club invitations"],
  ["emailTasks", "Tasks and deadlines"],
  ["emailPlatform", "Optional OutClass news"],
] as const;
const frequencies: { value: Preferences["emailFrequency"]; label: string }[] = [{ value: "INSTANT", label: "Instant" }, { value: "DAILY", label: "Daily digest" }, { value: "OFF", label: "Off" }];

function ToggleRow({ label, value, onChange, disabled, testID }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 8, paddingVertical: 6 }}>
      <Text variant="body" style={{ flex: 1 }}>{label}</Text>
      <Toggle testID={testID} accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );
}

/** Push for this device, through `~/lib/push` (web: components/inbox/push-notifications-toggle.tsx). */
function PushRow() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let live = true; push.status().then(value => { if (live) setStatus(value); }).catch(() => { if (live) setStatus("unavailable"); }); return () => { live = false; }; }, []);
  async function toggle(next: boolean) {
    setBusy(true); setMessage("");
    try {
      if (next) { const on = await push.enable(); if (!on) throw new Error("off"); } else await push.disable();
      setStatus(await push.status());
    } catch {
      haptics.error();
      setMessage(next ? "Could not turn on push notifications." : "Could not turn off push notifications on this device.");
      push.status().then(setStatus).catch(() => {});
    } finally { setBusy(false); }
  }
  if (status === null) return null;
  return (
    <View accessibilityLabel="Push notifications" style={{ gap: 4 }}>
      <ToggleRow testID="preferences-push" label="Push notifications on this device" value={status === "on"} disabled={busy || status === "denied" || status === "unavailable"} onChange={toggle} />
      <Text variant="caption">{status === "unavailable" ? "Push notifications aren't available on this device yet." : "Sent for the updates you get by instant email."}</Text>
      {status === "denied" ? <Text variant="small" accessibilityRole="alert">Notifications are blocked in your device settings.</Text> : null}
      {message ? <Text variant="small" accessibilityRole="alert">{message}</Text> : null}
    </View>
  );
}

/** Email and push preferences: `inbox.preferences` / `inbox.preferences.save`. */
export function NotificationPreferencesForm({ onSaved }: { onSaved?: () => void }) {
  const { colors } = useTheme();
  const client = useQueryClient();
  const query = useApiQuery<Preferences>("inbox.preferences");
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const prefs = draft ?? query.data ?? null;
  const save = useMutation({
    mutationFn: (value: Preferences) => api.post<Preferences>("inbox.preferences.save", {
      emailAnnouncements: value.emailAnnouncements, emailMessages: value.emailMessages, emailApplications: value.emailApplications, emailInterviews: value.emailInterviews,
      emailInvitations: value.emailInvitations, emailTasks: value.emailTasks, emailPlatform: value.emailPlatform, emailFrequency: value.emailFrequency,
    }),
    onMutate: () => setMessage(null),
    onSuccess: saved => { client.setQueryData(["inbox.preferences", null], saved); setDraft(null); setMessage({ text: "Preferences saved.", error: false }); haptics.confirm(); onSaved?.(); },
    onError: error => { setMessage({ text: errorMessage(error, "Could not save preferences."), error: true }); haptics.error(); },
  });
  const change = (patch: Partial<Preferences>) => { if (prefs) { setMessage(null); setDraft({ ...prefs, ...patch }); } };

  return (
    <View style={{ gap: 14 }} accessibilityLabel="Email notification preferences">
      <PushRow />
      <Divider />
      <Text variant="small">Choose the updates you want by email. In-app updates and security emails are always available. Daily summaries go out once a day, in the evening, US Eastern time.</Text>
      {prefs ? (
        <>
          <View>
            {fields.map(([key, label], index) => (
              <View key={key}>
                {index ? <Divider /> : null}
                <ToggleRow testID={`preferences-${key}`} label={label} value={prefs[key]} disabled={save.isPending} onChange={value => change({ [key]: value })} />
              </View>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            <Text variant="smallStrong">Frequency</Text>
            <Segmented label="Frequency" options={frequencies} value={prefs.emailFrequency} onChange={value => { if (!save.isPending) change({ emailFrequency: value }); }} />
            {prefs.emailFrequency === "OFF" ? <Text variant="caption">Email updates are off. Security emails still arrive.</Text> : null}
          </View>
          <Button full size="large" testID="preferences-save" label={save.isPending ? "Saving…" : "Save preferences"} loading={save.isPending} disabled={!draft} onPress={() => save.mutate(prefs)} />
        </>
      ) : query.isError ? (
        <View style={{ gap: 10 }}>
          <Text variant="small" color={colors.destructive} accessibilityRole="alert">{errorMessage(query.error, "Could not load preferences.")}</Text>
          <Button variant="secondary" label="Retry" onPress={() => query.refetch()} />
        </View>
      ) : (
        <View accessibilityLabel="Loading notification settings…" accessibilityRole="progressbar" style={{ gap: 18, paddingVertical: 8 }}>
          <Skeleton width="72%" height={18} /><Skeleton width="84%" height={18} /><Skeleton width="60%" height={18} />
        </View>
      )}
      {message ? <Text testID="preferences-message" variant="small" color={message.error ? colors.destructive : colors.foreground} accessibilityRole={message.error ? "alert" : "text"} accessibilityLiveRegion="polite">{message.text}</Text> : null}
    </View>
  );
}

/** "Notification settings", opened from the Inbox header (web: /inbox?tab=preferences). */
export function NotificationPreferencesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { height } = useWindowDimensions();
  return (
    <Sheet open={open} onClose={onClose} title="Notification settings" testID="preferences-sheet">
      <ScrollView style={{ maxHeight: height * 0.68 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* The sheet unmounts its content after it closes, so the form stays while it slides away. */}
        <NotificationPreferencesForm />
      </ScrollView>
    </Sheet>
  );
}
