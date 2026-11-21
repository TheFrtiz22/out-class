import { type InfiniteData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import { useIsAlumni } from "~/components/alumni-banner";
import { addEventToCalendar, addedToCalendar, calendarMessages, type CalendarOutcome } from "~/components/explore/calendar";
import { clubImage, eventDateLabel, eventScheduleLabel, eventSharePath, eventTimeLabel } from "~/components/explore/directory";
import { BookmarkFilled } from "~/components/explore/event-card";
import { usePrefetchClub, useSavedEvents } from "~/components/explore/hooks";
import { useNotice } from "~/components/explore/parts";
import { Header, useHeaderInset } from "~/components/header";
import { Bookmark, CalendarPlus, Check, Share } from "~/components/icons";
import { ShareSheet } from "~/components/share-sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { config } from "~/lib/config";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CampusEvent, EventBoard, EventRsvpResult } from "~/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One campus event (the web board's detail dialog): facts, RSVP, save, Add to Calendar, share. */
export default function EventDetail() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === "string" && UUID.test(params.id) ? params.id : "";
  const alumni = useIsAlumni();
  const { colors, radius } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const queryClient = useQueryClient();
  const notice = useNotice();
  const saves = useSavedEvents(notice.show);
  const prefetchClub = usePrefetchClub();
  const key = ["events.event", { eventId: id }] as const;
  // The board the student came from already holds this event: show it while the fresh copy loads.
  const fromBoard = () => queryClient.getQueriesData<InfiniteData<EventBoard>>({ queryKey: ["events.board"] }).flatMap(([, data]) => data?.pages ?? []).flatMap(page => page.events).find(item => item.id === id);
  const detail = useQuery<CampusEvent | null>({ queryKey: key, queryFn: ({ signal }) => api.get<CampusEvent | null>("events.event", { eventId: id }, { signal }), placeholderData: () => fromBoard(), enabled: !!id });
  const event = detail.data ?? null;
  const [sharing, setSharing] = useState(false);
  const [calendar, setCalendar] = useState<CalendarOutcome | "failed" | null>(null);
  const [adding, setAdding] = useState(false);
  const [now] = useState(() => Date.now());

  const refresh = () => Promise.all([detail.refetch(), saves.query.refetch(), queryClient.invalidateQueries({ queryKey: ["events.rsvp", { eventId: id }] })]);
  async function addToCalendar(item: CampusEvent) {
    setAdding(true);
    try {
      const outcome = await addEventToCalendar(item);
      if (outcome === "added") haptics.confirm(); else haptics.warning();
      setCalendar(outcome);
    } catch { haptics.error(); setCalendar("failed"); }
    finally { setAdding(false); }
  }

  let body;
  if (!id) body = <EmptyState title="This event is no longer available." action={<Button variant="secondary" label="Browse all events" onPress={() => router.replace("/events")} />} />;
  else if (!event && detail.isPending) body = <EventSkeleton />;
  else if (!event && detail.isError) body = <ErrorState message={errorMessage(detail.error, "We couldn’t load this event. Please try again.")} offline={detail.error instanceof ApiError && detail.error.offline} onRetry={refresh} />;
  else if (!event) body = <EmptyState title="This event is no longer available." action={<Button variant="secondary" label="Browse all events" onPress={() => router.replace("/events")} />} />;
  else {
    const flyer = clubImage(event.flyerUrl, config.apiUrl);
    const saved = saves.ids.has(event.id);
    const when = eventScheduleLabel(event);
    body = (
      <>
        <View style={{ gap: 6 }}>
          <Text variant="eyebrow">{event.category ? `${event.category} · Event` : "Event"}</Text>
          <Text variant="title" accessibilityRole="header" testID="event-title">{event.title}</Text>
          <Press accessibilityRole="link" accessibilityLabel={`Hosted by ${event.clubName}`} onPressIn={() => prefetchClub(event.clubId)} onPress={() => router.push({ pathname: "/club/[id]", params: { id: event.clubId } })} style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
            <Text color={colors.mutedForeground}>Hosted by <Text variant="bodyStrong" color={colors.brandInk}>{event.clubName}</Text></Text>
          </Press>
        </View>
        {flyer ? <Image source={{ uri: flyer }} accessibilityLabel={`${event.title} event poster`} contentFit="cover" transition={150} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg }} /> : null}
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <Fact label="Date & time" value={when} />
          <Divider />
          <Fact label="Location" value={event.location?.trim() || "Location not announced"} />
          <Divider />
          <Fact label="Students going" value={`${event.rsvpCount}${event.capacity !== null ? ` / ${event.capacity} capacity · ${Math.max(0, event.capacity - event.rsvpCount)} remaining` : ""}`} testID="event-going">
            {event.capacity !== null ? (
              <View accessibilityRole="progressbar" accessibilityLabel="RSVP capacity" accessibilityValue={{ min: 0, max: event.capacity, now: Math.min(event.rsvpCount, event.capacity) }} style={{ height: 6, borderRadius: 3, backgroundColor: colors.muted, marginTop: 8, overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${event.capacity ? Math.min(100, (event.rsvpCount / event.capacity) * 100) : 0}%` }} />
              </View>
            ) : null}
          </Fact>
        </Card>
        {event.description ? <Text>{event.description}</Text> : null}
        <View style={{ gap: 4 }}>
          {event.contact ? <Text variant="small" color={colors.foreground}>Contact: {event.contact}</Text> : null}
          {event.rsvpDeadline ? <Text variant="small">RSVP by {eventDateLabel(event.rsvpDeadline)} · {eventTimeLabel(event.rsvpDeadline)}</Text> : null}
          <Text variant="small" color={colors.foreground}>{event.rsvpRequired ? "RSVP required" : event.rsvpEnabled ? "RSVP optional" : "No RSVP required"}</Text>
        </View>
        <RsvpControls event={event} now={now} alumni={alumni} />
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Button full variant={saved ? "accent" : "secondary"} testID="event-save" icon={saved ? BookmarkFilled : Bookmark} label={saved ? "Saved" : "Save"} accessibilityHint={event.title} disabled={!saves.ready || alumni} onPress={() => saves.setSaved(event.id, !saved)} /></View>
            <View style={{ flex: 1 }}><Button full variant="secondary" testID="event-share" icon={Share} label="Share" onPress={() => setSharing(true)} /></View>
          </View>
          {/* Added once already (here or on the board): another tap would write a duplicate entry. */}
          <Button full variant="secondary" testID="event-calendar" icon={calendar === "added" || addedToCalendar(event.id) ? Check : CalendarPlus} loading={adding} label={addedToCalendar(event.id) ? "Added to Calendar" : "Add to Calendar"} disabled={addedToCalendar(event.id)} accessibilityHint={event.title} onPress={() => void addToCalendar(event)} />
          {calendar ? (
            <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
              <Text variant="small" testID="event-calendar-status" color={calendar === "added" ? colors.foreground : colors.mutedForeground}>{calendar === "failed" ? "We couldn’t add this event to your calendar. Try again." : calendarMessages[calendar]}</Text>
              {calendar === "blocked" ? <Button variant="ghost" size="compact" label="Open Settings" onPress={() => { void Linking.openSettings(); }} /> : null}
            </View>
          ) : null}
        </View>
        <ShareSheet open={sharing} onClose={() => setSharing(false)} target={{ path: eventSharePath(event.id), title: event.title, text: `${event.title} (${when}), hosted by ${event.clubName}`, subtitle: `Hosted by ${event.clubName} · ${when}` }} />
      </>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} onRefresh={refresh} testID="event-screen">{body}</ScreenScroll>
      <Header title="Event" back />
      {notice.element}
    </View>
  );
}

function Fact({ label, value, children, testID }: { label: string; value: string; children?: React.ReactNode; testID?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ paddingVertical: 12, gap: 2 }}>
      <Text variant="caption">{label}</Text>
      <Text variant="bodyStrong" testID={testID}>{value}</Text>
      {children}
    </View>
  );
}

/** RSVP (RsvpControls on the web): the new state shows at once; the server's answer (capacity, deadline, alumni) confirms or restores it. */
function RsvpControls({ event, now, alumni }: { event: CampusEvent; now: number; alumni: boolean }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const key = ["events.rsvp", { eventId: event.id }] as const;
  const rsvp = useApiQuery<{ going: boolean }>("events.rsvp", { eventId: event.id });
  const [error, setError] = useState("");
  const change = useMutation({
    mutationFn: (going: boolean) => api.post<EventRsvpResult>("events.rsvp.set", { eventId: event.id, going }),
    onMutate: async going => {
      setError("");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ going: boolean }>(key);
      queryClient.setQueryData(key, { going });
      return { previous };
    },
    onSuccess: (result, _going, context) => {
      if (!result.ok) { queryClient.setQueryData(key, context?.previous); haptics.error(); setError(result.error); return; }
      haptics.confirm();
      queryClient.setQueryData(key, { going: result.going });
      queryClient.setQueryData<CampusEvent | null>(["events.event", { eventId: event.id }], current => current ? { ...current, rsvpCount: result.count } : current);
      void queryClient.invalidateQueries({ queryKey: ["events.board"] });
      void queryClient.invalidateQueries({ queryKey: ["events.myRsvps"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar.view"] });
      void queryClient.invalidateQueries({ queryKey: ["home.view"] });
    },
    onError: (cause, _going, context) => { queryClient.setQueryData(key, context?.previous); haptics.error(); setError(errorMessage(cause, "Could not update RSVP.")); },
  });
  const going = rsvp.data?.going ?? false;
  const loading = rsvp.isPending;
  const unavailable = rsvp.isError;
  const closed = !event.rsvpEnabled || +new Date(event.date) <= now || (!!event.rsvpDeadline && +new Date(event.rsvpDeadline) <= now);
  const full = event.capacity !== null && event.rsvpCount >= event.capacity;
  // Alumni accounts cannot RSVP or cancel (the server refuses too), as on the web.
  if (alumni && !loading) return going
    ? <View accessible accessibilityRole="text" accessibilityLabel="You’re going" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text variant="bodyStrong" color={colors.success}>You’re going</Text><Check size={16} color={colors.success} /></View>
    : <Text variant="small">Alumni accounts can’t RSVP.</Text>;
  // An event that takes no RSVPs already says so above; a disabled button would only repeat it.
  if (!event.rsvpEnabled && !going && !loading) return null;
  return (
    <View style={{ gap: 8 }} accessibilityState={{ busy: change.isPending || loading }}>
      {going ? (
        <>
          <View accessible accessibilityRole="text" accessibilityLabel="You’re going" style={{ flexDirection: "row", alignItems: "center", gap: 6 }} testID="event-going-status">
            <Text variant="bodyStrong" color={colors.success}>You’re going</Text><Check size={16} color={colors.success} />
          </View>
          <Button full size="large" variant="secondary" testID="event-rsvp-cancel" label="Cancel RSVP" disabled={change.isPending || loading} onPress={() => change.mutate(false)} />
        </>
      ) : (
        <Button full size="large" testID="event-rsvp" label={loading ? "Loading RSVP…" : closed ? "RSVP closed" : full ? "Event full" : "RSVP"} disabled={change.isPending || loading || unavailable || closed || full} onPress={() => change.mutate(true)} />
      )}
      {error ? <Text variant="small" color={colors.destructive} accessibilityRole="alert" testID="event-rsvp-error">{error}</Text> : null}
      {unavailable ? (
        <>
          <Text variant="small" color={colors.destructive} accessibilityRole="alert">{rsvp.error instanceof ApiError && rsvp.error.offline ? errorMessage(rsvp.error) : "Could not load your RSVP. Retry before continuing."}</Text>
          <Button variant="secondary" label="Retry RSVP" onPress={() => { void rsvp.refetch(); }} />
        </>
      ) : null}
    </View>
  );
}

function EventSkeleton() {
  return (
    <View accessibilityLabel="Opening linked event…" accessibilityRole="progressbar" style={{ gap: 16 }}>
      <Skeleton width="34%" height={11} /><Skeleton width="86%" height={30} /><Skeleton width="50%" />
      <Card style={{ gap: 14 }}><Skeleton width="70%" height={18} /><Skeleton width="56%" height={18} /><Skeleton width="40%" height={18} /></Card>
      <Skeleton /><Skeleton width="92%" /><Skeleton height={48} radius={24} />
    </View>
  );
}
