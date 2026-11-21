import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlumniBanner } from "~/components/alumni-banner";
import { Header, useHeaderInset } from "~/components/header";
import { Archive, Bell, CheckCheck, ExternalLink, Mail, MailOpen, Settings } from "~/components/icons";
import { useInbox, useInboxActions } from "~/components/inbox/data";
import { FilterChips } from "~/components/inbox/filter-chips";
import { useRefetchOnFocus } from "~/components/inbox/use-refetch-on-focus";
import { NotificationPreferencesSheet } from "~/components/inbox/preferences";
import { clubName, ctaLabel, filterRows, fullDate, groupRows, opensInPlace, type ReadFilter, senderTitle, type TypeFilter, typeFilters, typeLabel } from "~/components/inbox/presentation";
import { InboxListRow } from "~/components/inbox/row";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, ClubMark, DOCK_CLEARANCE, EmptyState, ErrorState, IconButton, Segmented, SkeletonRows, StaleNote, usePullControl } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openOnWeb, resolveHref } from "~/lib/links";
import { useTabScrollToTop } from "~/lib/scroll-to-top";
import { useTheme } from "~/lib/theme";
import type { InboxRow } from "~/lib/types";

export default function Inbox() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useHeaderInset();
  const params = useLocalSearchParams<{ tab?: string }>();
  const inbox = useInbox();
  useRefetchOnFocus(inbox);
  const { read, archive, readAll } = useInboxActions();
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [preferences, setPreferences] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [actionFailed, setActionFailed] = useState(false);
  const opening = useRef(false);
  const list = useRef<SectionList<InboxRow>>(null);
  useTabScrollToTop(list);

  // Emails and the web link to /inbox?tab=preferences; the same address opens the sheet here.
  useEffect(() => { if (params.tab === "preferences") setPreferences(true); }, [params.tab]);
  // Relative times move with the minute clock while the list is on screen.
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  // A failed refresh (or "load more") keeps the loaded list; only a first load that failed shows the error.
  const failed = inbox.isError && !inbox.data;
  const items = inbox.data?.pages.flatMap(page => page.items) ?? [];
  const unread = inbox.data?.pages[0]?.unread ?? 0;
  const filtering = readFilter !== "all" || typeFilter !== "All";
  const showFilters = items.length >= 5 || filtering;
  const filtered = filterRows(items, readFilter, typeFilter);
  const sections = groupRows(filtered);
  const countSection = sections.find(section => section.title === "Club updates")?.title ?? sections[0]?.title;
  const selected = items.find(item => item.id === selectedId) ?? null;
  const fail = () => setActionFailed(true);

  const setRead = (ids: string[], value: boolean) => { setActionFailed(false); read.mutate({ ids, read: value }, { onError: fail }); };
  const dismiss = (ids: string[]) => { setActionFailed(false); if (selectedId && ids.includes(selectedId)) setSelectedId(null); archive.mutate({ ids }, { onError: fail }); };

  async function open(item: InboxRow) {
    // A booking link waits for a lookup; a second tap meanwhile must not open the screen twice.
    if (opening.current) return;
    opening.current = true;
    try {
      if (!item.readAt) setRead([item.id], true);
      // Updates that target the inbox itself are read in place; the rest open their own screen.
      const route = opensInPlace(item) ? null : await resolveHref(item.href);
      if (route && route.pathname !== "/inbox") { router.push(route as never); return; }
      setSelectedId(item.id);
    } finally { opening.current = false; }
  }

  const header = (
    <View style={{ gap: space.content - 4, paddingBottom: 4 }}>
      <AlumniBanner />
      {inbox.isRefetchError ? <StaleNote /> : null}
      {actionFailed ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">Couldn’t update notifications.</Text> : null}
      {showFilters ? (
        <View style={{ gap: 10 }}>
          <Segmented label="Read status" value={readFilter} onChange={setReadFilter} options={[{ value: "all", label: "All" }, { value: "unread", label: unread ? `Unread (${unread})` : "Unread" }, { value: "read", label: "Read" }]} />
          <FilterChips label="Notification type" testID="inbox-type" value={typeFilter} onChange={setTypeFilter} options={typeFilters.map(value => ({ value, label: value }))} />
        </View>
      ) : null}
    </View>
  );

  const pullControl = usePullControl(() => inbox.refetch(), top);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        ref={list}
        testID="inbox-screen"
        sections={inbox.isPending || failed ? [] : sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: top + space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + DOCK_CLEARANCE }}
        scrollIndicatorInsets={{ top, bottom: DOCK_CLEARANCE }}
        refreshControl={pullControl}
        onEndReachedThreshold={0.4}
        onEndReached={() => { if (inbox.hasNextPage && !inbox.isFetchingNextPage) inbox.fetchNextPage(); }}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: 16, paddingBottom: 8, gap: 2 }}>
            <Text variant="card" accessibilityRole="header">{section.title}</Text>
            {section.title === countSection ? <Text variant="caption" accessibilityLiveRegion="polite">{unread} unread · {items.length} {inbox.hasNextPage ? "loaded" : items.length === 1 ? "notification" : "notifications"}</Text> : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <InboxListRow item={item} now={now} first={index === 0} last={index === section.data.length - 1} onOpen={() => open(item)} onRead={value => setRead([item.id], value)} onArchive={() => dismiss([item.id])} />
        )}
        ListEmptyComponent={
          inbox.isPending ? <View style={{ paddingTop: 12 }}><SkeletonRows count={5} /></View>
            : failed ? <ErrorState message={errorMessage(inbox.error)} offline={inbox.error instanceof ApiError && inbox.error.offline} onRetry={() => inbox.refetch()} />
              : items.length ? <EmptyState icon={Bell} title="No matching notifications" body="Your filters hide every notification." action={<Button variant="secondary" label="Clear filters" onPress={() => { setReadFilter("all"); setTypeFilter("All"); }} />} />
                : <EmptyState icon={Bell} title="No notifications yet" body="Nothing has been sent to you yet. Choose which updates you want by email." action={<Button variant="secondary" testID="inbox-empty-settings" label="Notification settings" onPress={() => setPreferences(true)} />} />
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? <View accessibilityLabel="Loading…" style={{ paddingVertical: 20 }}><ActivityIndicator color={colors.mutedForeground} /></View>
            : inbox.isFetchNextPageError ? <View style={{ paddingVertical: 16, gap: 8, alignItems: "center" }}><Text variant="small" color={colors.destructive} accessibilityRole="alert">Could not load more updates. Please try again.</Text><Button variant="secondary" label="Load older updates" onPress={() => inbox.fetchNextPage()} /></View>
              : undefined
        }
      />
      <Header
        title="Inbox"
        actions={<>
          {unread > 0 ? <IconButton icon={CheckCheck} label={`Mark all ${unread} updates as read`} testID="inbox-mark-all" onPress={() => { if (!readAll.isPending) { setActionFailed(false); readAll.mutate(undefined, { onError: fail }); } }} /> : null}
          <IconButton icon={Settings} label="Notification settings" testID="inbox-settings" onPress={() => setPreferences(true)} />
        </>}
      />

      <Sheet open={!!selected} onClose={() => setSelectedId(null)} testID="inbox-detail">
        {selected ? (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 14, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <ClubMark name={clubName(selected)} color={selected.club?.color} logoUrl={selected.club?.logoUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{clubName(selected)}</Text>
                <Text variant="caption">{senderTitle(selected)}</Text>
              </View>
            </View>
            <View style={{ gap: 4 }}>
              <Text variant="caption">{typeLabel(selected)} · {fullDate(selected.createdAt)}</Text>
              <Text variant="section" accessibilityRole="header">{selected.title}</Text>
            </View>
            <Text variant="body" selectable>{selected.body}</Text>
            <View style={{ gap: 10 }}>
              {selected.href && !opensInPlace(selected) ? (
                <Button full icon={ExternalLink} testID="inbox-open-web" variant="secondary" label="Open on web" accessibilityHint={ctaLabel(selected)} onPress={() => { openOnWeb(selected.href!); }} />
              ) : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}><Button full variant="secondary" testID="inbox-detail-read" icon={selected.readAt ? Mail : MailOpen} label={selected.readAt ? "Mark unread" : "Mark read"} onPress={() => setRead([selected.id], !selected.readAt)} /></View>
                <View style={{ flex: 1 }}><Button full variant="ghost" testID="inbox-detail-archive" icon={Archive} label="Dismiss" onPress={() => { haptics.save(); dismiss([selected.id]); }} /></View>
              </View>
            </View>
          </ScrollView>
        ) : null}
      </Sheet>
      <NotificationPreferencesSheet open={preferences} onClose={() => { setPreferences(false); if (params.tab) router.setParams({ tab: undefined }); }} />
    </View>
  );
}
