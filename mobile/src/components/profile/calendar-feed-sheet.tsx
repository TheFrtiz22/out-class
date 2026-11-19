import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { View } from "react-native";
import { Copy } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button } from "~/components/ui";
import { api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openExternal } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CalendarFeedLinks, CalendarFeedStatus } from "~/lib/types";

/** "Add OutClass to your calendar" (components/calendar-subscribe.tsx): the private link is shown once. */
export function CalendarFeedSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colors, radius } = useTheme();
  const client = useQueryClient();
  const status = useApiQuery<CalendarFeedStatus>("calendarFeed", undefined, { enabled: open });
  const [links, setLinks] = useState<CalendarFeedLinks | null>(null);
  const [message, setMessage] = useState("");
  const active = status.data?.active ?? false;
  const failed = (error: unknown) => { setMessage(errorMessage(error, "Couldn’t update your calendar link. Try again.")); haptics.error(); };
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
            {status.isError ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">Couldn’t check whether you already have a calendar link. A new link replaces any old one.</Text> : null}
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
