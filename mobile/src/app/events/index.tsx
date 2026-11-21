import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsAlumni } from "~/components/alumni-banner";
import { addEventToCalendar, addedToCalendar, calendarMessages } from "~/components/explore/calendar";
import { type EventFilters, eventBoardEmpty, eventCategories, initialEventFilters } from "~/components/explore/directory";
import { EventCard, EventCardSkeleton } from "~/components/explore/event-card";
import { useSavedEvents } from "~/components/explore/hooks";
import { FieldLabel, FilterChip, SearchField, useDebounced, useNotice } from "~/components/explore/parts";
import { Header, useHeaderInset } from "~/components/header";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, EmptyState, ErrorState, IconButton, Press, Segmented, Skeleton, TARGET, Toggle } from "~/components/ui";
import { ApiError, api, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { CampusEvent, EventBoard, EventRsvpResult } from "~/lib/types";

const Separator = () => <View style={{ height: 12 }} />;
const keyOf = (event: CampusEvent) => event.id;
const periods: { value: EventFilters["period"]; label: string }[] = [{ value: "All", label: "Any time" }, { value: "Today", label: "Today" }, { value: "This Week", label: "This week" }, { value: "Weekend", label: "Weekend" }];
const sorts: { value: EventFilters["sort"]; label: string }[] = [{ value: "soonest", label: "Soonest" }, { value: "latest", label: "Latest" }, { value: "name", label: "Name A–Z" }];

/** The campus Events board (components/views/corkboard-view.tsx, list view): search, When, filters, saved events, your RSVPs. */
export default function EventsBoard() {
  const theme = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const top = useHeaderInset();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const notice = useNotice();
  const saves = useSavedEvents(notice.show);
  const alumni = useIsAlumni();
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<EventFilters>(initialEventFilters);
  const [sheet, setSheet] = useState(false);
  const search = useDebounced(query, 250);
  const filters = useMemo(() => ({ ...choices, query: search.trim() }), [choices, search]);

  const board = useInfiniteQuery({
    queryKey: ["events.board", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.get<EventBoard>("events.board", { ...filters, page: pageParam }, { signal }),
    getNextPageParam: (last, pages) => last.hasMore ? pages.length : undefined,
    placeholderData: previous => previous,
  });
  const events = useMemo(() => board.data?.pages.flatMap(page => page.events) ?? [], [board.data]);
  const total = board.data?.pages[0]?.total ?? 0;
  // A new filter keeps the last list on screen while it loads; say so rather than show the old count.
  const updating = board.isPlaceholderData && board.isFetching;
  const menuFilters = [choices.category, choices.required, choices.savedOnly, choices.sort !== "soonest"].filter(Boolean).length;
  const change = (patch: Partial<EventFilters>) => setChoices(current => ({ ...current, ...patch }));

  const open = useCallback((event: CampusEvent) => router.push({ pathname: "/events/[id]", params: { id: event.id } }), [router]);
  const { show } = notice;
  // Bumped when an event is added, so its card redraws with "Added".
  const [calendarAdds, setCalendarAdds] = useState(0);
  const addToCalendar = useCallback((event: CampusEvent) => {
    addEventToCalendar(event)
      .then(outcome => { if (outcome === "added") { haptics.confirm(); setCalendarAdds(count => count + 1); } else haptics.warning(); show(calendarMessages[outcome], outcome === "added" ? "ok" : "error"); })
      .catch(() => { haptics.error(); show("We couldn’t add this event to your calendar. Try again.") });
  }, [show]);
  const { ids, setSaved } = saves;
  // Alumni accounts keep their saved events but cannot change them (the server refuses too).
  const ready = saves.ready && !alumni;
  const renderItem = useCallback(({ item, index }: { item: CampusEvent; index: number }) => (
    <EventCard event={item} saved={ids.has(item.id)} saveReady={ready} onOpen={open} onToggleSaved={setSaved} onAddToCalendar={addToCalendar} addedToCalendar={addedToCalendar(item.id)} testID={`event-card-${index}`} />
    // eslint-disable-next-line react-hooks/exhaustive-deps -- calendarAdds is the signal that addedToCalendar() changed
  ), [ids, ready, open, setSaved, addToCalendar, calendarAdds]);
  const refresh = () => { void board.refetch(); void saves.query.refetch(); };

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <Text variant="small">Events on Grounds</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <SearchField testID="events-search" label="Search events" placeholder="Search events…" value={query} onChangeText={setQuery} />
        <View><IconButton testID="events-filter" tone="surface" icon={SlidersHorizontal} label={menuFilters ? `Event filters (${menuFilters} active)` : "Event filters"} selected={menuFilters > 0} onPress={() => setSheet(true)} /></View>
      </View>
      <Segmented label="When" options={periods} value={choices.period} onChange={period => change({ period })} />
      <Text variant="small" accessibilityLiveRegion="polite" testID="events-count">
        {board.isPending ? "Loading campus events…" : updating ? "Updating…" : board.isError ? "" : `${total} ${total === 1 ? "event" : "events"} · Times shown in Eastern Time`}
      </Text>
    </View>
  );
  const emptyCopy = eventBoardEmpty(filters);
  const empty = board.isPending ? (
    <View accessibilityLabel="Loading campus events…" accessibilityRole="progressbar" style={{ gap: 12 }}>{Array.from({ length: 4 }, (_, index) => <EventCardSkeleton key={index} />)}</View>
  ) : board.isError ? (
    <ErrorState message={errorMessage(board.error, "We couldn’t load campus events. Please try again.")} offline={board.error instanceof ApiError && board.error.offline} onRetry={refresh} />
  ) : (
    <EmptyState title={emptyCopy.title} body={emptyCopy.description}
      action={emptyCopy.action.kind === "explore-clubs"
        // Back to the tabs already underneath, on Explore: a replace or push would stack a second tab shell.
        ? <Button variant="secondary" testID="events-empty-explore" label={emptyCopy.action.label} onPress={() => router.dismissTo("/explore")} />
        : <Button variant="secondary" testID="events-empty-action" label={emptyCopy.action.label} onPress={() => { if (emptyCopy.action.kind === "clear-filters") { setQuery(""); setChoices({ ...initialEventFilters, savedOnly: choices.savedOnly, sort: choices.sort }); } else change({ savedOnly: false }); }} />} />
  );
  const footer = (
    <View style={{ gap: 14, paddingTop: 14 }}>
      {board.isFetchingNextPage ? <EventCardSkeleton /> : null}
      <MyRsvps onOpen={eventId => router.push({ pathname: "/events/[id]", params: { id: eventId } })} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="events-screen"
        data={board.isError ? [] : events}
        keyExtractor={keyOf}
        renderItem={renderItem}
        extraData={calendarAdds}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        onEndReached={() => { if (board.hasNextPage && !board.isFetchingNextPage) void board.fetchNextPage(); }}
        onEndReachedThreshold={0.6}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: top + theme.space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={5}
        windowSize={9}
        scrollIndicatorInsets={{ top }}
        refreshControl={<RefreshControl refreshing={board.isRefetching && !board.isFetchingNextPage && !board.isPlaceholderData} onRefresh={refresh} tintColor={colors.mutedForeground} colors={[colors.primary]} progressBackgroundColor={colors.card} progressViewOffset={top} />}
      />
      <Header title="Events" back />
      {notice.element}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Event filters" testID="events-filter-sheet">
        {/* Every group can be on screen at once; at large text sizes on a small phone it scrolls rather than hiding Done. */}
        <ScrollView style={{ maxHeight: screenHeight * 0.62 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          <ToggleRow testID="events-saved-only" label="Saved events" value={choices.savedOnly} onChange={savedOnly => change({ savedOnly })} />
          <FieldLabel>Category</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <FilterChip label="All categories" selected={!choices.category} onPress={() => change({ category: "" })} />
            {eventCategories.map(category => <FilterChip key={category} testID={`events-category-${category.toLowerCase()}`} label={category} selected={choices.category === category} onPress={() => change({ category })} />)}
          </View>
          <FieldLabel>Sort</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {sorts.map(option => <FilterChip key={option.value} label={option.label} selected={choices.sort === option.value} onPress={() => change({ sort: option.value })} />)}
          </View>
          <ToggleRow label="RSVP required" value={choices.required} onChange={required => change({ required })} />
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}><Button full size="large" variant="secondary" label="Reset filters" testID="events-filter-reset" onPress={() => { setQuery(""); setChoices(initialEventFilters); }} /></View>
          <View style={{ flex: 1 }}><Button full size="large" label="Done" testID="events-filter-done" onPress={() => setSheet(false)} /></View>
        </View>
      </Sheet>
    </View>
  );
}

function ToggleRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (value: boolean) => void; testID?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: TARGET, gap: 12 }}>
      <Text variant="bodyStrong" style={{ flex: 1 }}>{label}</Text>
      <Toggle testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

type MyRsvp = { eventId: string; title: string; available: boolean };

/** "Your RSVPs" (MyEventRsvps on the web board): cancel here even if an event was withdrawn or cancelled. */
function MyRsvps({ onOpen }: { onOpen: (eventId: string) => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rsvps = useApiQuery<MyRsvp[]>("events.myRsvps");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const cancel = useMutation({
    mutationFn: (eventId: string) => api.post<EventRsvpResult>("events.rsvp.set", { eventId, going: false }),
    // Optimistic: the row leaves at once and returns to its place if the server refuses.
    onMutate: async eventId => {
      setMessage(null);
      await queryClient.cancelQueries({ queryKey: ["events.myRsvps", null] });
      const previous = queryClient.getQueryData<MyRsvp[]>(["events.myRsvps", null]);
      queryClient.setQueryData<MyRsvp[]>(["events.myRsvps", null], rows => (rows ?? []).filter(row => row.eventId !== eventId));
      return { previous };
    },
    onSuccess: (result, eventId, context) => {
      if (!result.ok) { queryClient.setQueryData(["events.myRsvps", null], context?.previous); haptics.error(); setMessage({ tone: "error", text: result.error }); return; }
      haptics.confirm();
      setMessage({ tone: "ok", text: "Your RSVP was cancelled." });
      queryClient.setQueryData(["events.rsvp", { eventId }], { going: false });
      void queryClient.invalidateQueries({ queryKey: ["events.board"] });
      void queryClient.invalidateQueries({ queryKey: ["events.event", { eventId }] });
      void queryClient.invalidateQueries({ queryKey: ["calendar.view"] });
      void queryClient.invalidateQueries({ queryKey: ["home.view"] });
    },
    onError: (error, _eventId, context) => { queryClient.setQueryData(["events.myRsvps", null], context?.previous); haptics.error(); setMessage({ tone: "error", text: errorMessage(error, "Could not cancel. Please try again.") }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["events.myRsvps", null] }),
  });
  const rows = rsvps.data ?? [];
  return (
    <Card padded={false} style={{ paddingHorizontal: 16 }} testID="events-my-rsvps">
      <Press large testID="events-my-rsvps-toggle" accessibilityLabel={`Your RSVPs${rsvps.isSuccess ? ` (${rows.length})` : ""}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: TARGET + 8 }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>Your RSVPs{rsvps.isSuccess ? ` (${rows.length})` : ""}</Text>
        {open ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
      </Press>
      {open ? (
        <View style={{ gap: 10, paddingBottom: 14 }}>
          <Text variant="caption">You can cancel here even if an event has been withdrawn or cancelled.</Text>
          {message ? <Text variant="small" color={message.tone === "error" ? colors.destructive : colors.foreground} accessibilityRole={message.tone === "error" ? "alert" : undefined} accessibilityLiveRegion="polite">{message.text}</Text> : null}
          {rsvps.isPending ? <View accessibilityLabel="Loading your RSVPs…" accessibilityRole="progressbar" style={{ gap: 8 }}><Skeleton width="70%" /><Skeleton width="50%" /></View>
            : rsvps.isError ? <View style={{ gap: 8 }}><Text variant="small" accessibilityRole="alert">{errorMessage(rsvps.error, "Your RSVPs could not be loaded.")}</Text><Button variant="secondary" size="compact" label="Retry" onPress={() => { void rsvps.refetch(); }} /></View>
            : !rows.length ? <View style={{ gap: 4 }}><Text variant="small">You haven’t RSVP’d to an event. Events you RSVP to also appear on your calendar.</Text><Button variant="ghost" size="compact" testID="events-open-calendar" label="Open your calendar" onPress={() => router.dismissTo("/calendar")} /></View>
            : rows.map((row, index) => (
              <View key={row.eventId}>
                {index ? <Divider /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: index ? 10 : 0 }}>
                  {row.available
                    ? <Press accessibilityRole="link" accessibilityLabel={row.title} onPress={() => onOpen(row.eventId)} style={{ flex: 1, minHeight: TARGET, justifyContent: "center" }}><Text variant="bodyStrong" color={colors.brandInk}>{row.title}</Text></Press>
                    : <Text style={{ flex: 1 }}>{row.title}</Text>}
                  <Button variant="secondary" size="compact" label="Cancel RSVP" accessibilityHint={row.title} disabled={cancel.isPending} testID={`events-my-rsvp-cancel-${index}`} onPress={() => cancel.mutate(row.eventId)} />
                </View>
              </View>
            ))}
        </View>
      ) : null}
    </Card>
  );
}
