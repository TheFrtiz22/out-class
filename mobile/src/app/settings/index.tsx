import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowUpRight, CalendarPlus, ChevronRight, Copy } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, Press, ScreenScroll, TARGET } from "~/components/ui";
import { api } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openExternal, openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CalendarFeedLinks, CalendarFeedStatus } from "~/lib/types";

// The web's Settings overview (lib/settings-navigation.ts `personalSettingsSections`), same labels and descriptions.
const sections = [
  { id: "account", label: "Account & Security", description: "Your sign-in information and account security.", route: "/settings/account" },
  { id: "notifications", label: "Notifications", description: "Choose which club updates and reminders reach your email.", route: "/settings/notifications" },
  { id: "availability", label: "Availability", description: "Keep one availability schedule across all your clubs.", web: "/settings/availability" },
  { id: "interests", label: "Interests", description: "What you’re into, so we can suggest clubs. Only you see this.", web: "/settings/interests" },
  { id: "interviews", label: "Interview schedule", description: "Your approved interview panels across all your clubs.", web: "/settings/interviews" },
] as const;

/** "Add OutClass to your calendar" (components/calendar-subscribe.tsx): the private link is shown once. */
function CalendarFeedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors, radius } = useTheme();
  const client = useQueryClient();
  const status = useApiQuery<CalendarFeedStatus>("calendarFeed", undefined, { enabled: open });
  const [links, setLinks] = useState<CalendarFeedLinks | null>(null);
  const [message, setMessage] = useState("");
  const active = status.data?.active ?? false;
  const failed = () => { setMessage("Couldn’t update your calendar link. Try again."); haptics.error(); };
  const create = useMutation({
    mutationFn: () => api.post<CalendarFeedLinks>("calendarFeed.create"),
    onMutate: () => setMessage(""),
    onSuccess: value => { setLinks(value); client.setQueryData<CalendarFeedStatus>(["calendarFeed", null], current => ({ createdAt: null, lastUsedAt: null, ...current, active: true })); haptics.confirm(); },
    onError: failed,
  });
  const disable = useMutation({
    mutationFn: () => api.post("calendarFeed.disable"),
    onMutate: () => setMessage(""),
    onSuccess: () => { client.setQueryData<CalendarFeedStatus>(["calendarFeed", null], { active: false, createdAt: null, lastUsedAt: null }); setMessage("Calendar link turned off."); haptics.save(); },
    onError: failed,
  });
  const busy = create.isPending || disable.isPending;
  const close = () => { setLinks(null); setMessage(""); onClose(); };

  return (
    <Sheet open={open} onClose={close} title="Add OutClass to your calendar" testID="calendar-feed-sheet">
      <View style={{ gap: 12 }}>
        <Text variant="small" style={{ marginTop: -6 }}>Your meetings, interviews and RSVPs show up in Google, Apple or Outlook calendar and stay up to date.</Text>
        {links ? (
          <>
            <Button full size="large" testID="calendar-feed-apple" label="Open in Apple or Outlook calendar" onPress={() => { import("expo-linking").then(Linking => Linking.openURL(links.webcal)).catch(() => setMessage("Select the link and copy it.")); }} />
            <Button full size="large" variant="secondary" label="Add to Google Calendar" onPress={() => { openExternal(links.google); }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
              <Text accessibilityLabel="Private calendar link" variant="small" color={colors.foreground} numberOfLines={2} selectable style={{ flex: 1 }}>{links.https}</Text>
              <Button variant="ghost" size="compact" icon={Copy} testID="calendar-feed-copy" label="Copy link" onPress={() => { Clipboard.setStringAsync(links.https).then(() => { setMessage("Link copied."); haptics.save(); }).catch(() => setMessage("Select the link and copy it.")); }} />
            </View>
            <Text variant="caption">Keep this link private: anyone with it can see your OutClass schedule. This is the only time it’s shown.</Text>
          </>
        ) : (
          <>
            {active ? <Text variant="small">Your calendar is subscribed. A new link replaces the current one, which then stops updating.</Text> : null}
            <Button full size="large" testID="calendar-feed-create" loading={create.isPending} disabled={busy || status.isPending} label={active ? "Create a new link" : "Create my calendar link"} onPress={() => create.mutate()} />
            {active ? <Button full variant="ghost" testID="calendar-feed-disable" disabled={busy} label="Turn off calendar link" onPress={() => disable.mutate()} /> : null}
          </>
        )}
        {message ? <Text testID="calendar-feed-message" variant="small" accessibilityLiveRegion="polite">{message}</Text> : null}
      </View>
    </Sheet>
  );
}

export default function SettingsOverview() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const [feed, setFeed] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-screen">
        <Text variant="display" accessibilityRole="header">Settings</Text>
        <Card padded={false} style={{ paddingHorizontal: 16 }} accessibilityLabel="Settings overview">
          {sections.map((section, index) => {
            const web = "web" in section ? section.web : null;
            return (
              <View key={section.id}>
                {index ? <Divider /> : null}
                <Press large testID={`settings-${section.id}`} accessibilityRole={web ? "link" : "button"} accessibilityLabel={`${section.label}. ${section.description}`} accessibilityHint={web ? "Opens on the web" : undefined}
                  onPress={() => { if (web) openOnWeb(web); else router.push(("route" in section ? section.route : "/settings") as never); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyStrong">{section.label}</Text>
                    <Text variant="small">{section.description}</Text>
                    {web ? <Text variant="caption">Open on web</Text> : null}
                  </View>
                  {web ? <ArrowUpRight size={18} color={colors.mutedForeground} /> : <ChevronRight size={18} color={colors.mutedForeground} />}
                </Press>
              </View>
            );
          })}
        </Card>

        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <Press large testID="settings-calendar-feed" accessibilityLabel="Subscribe. Add OutClass to your calendar" onPress={() => setFeed(true)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: TARGET + 12 }}>
            <CalendarPlus size={22} color={colors.brandInk} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="bodyStrong">Subscribe</Text>
              <Text variant="small">Add OutClass to your calendar</Text>
            </View>
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Press>
        </Card>
      </ScreenScroll>
      <Header title="Settings" back />
      <CalendarFeedSheet open={feed} onClose={() => setFeed(false)} />
    </View>
  );
}
