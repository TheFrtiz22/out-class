import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CLUB_CARD_GAP, ClubCard, ClubCardSkeleton, clubCardHeight } from "~/components/explore/club-card";
import { type DirectoryFilters, categoryIcon, clubRecruitment, emptyDirectoryFilters, filterDirectory, rankedCategories, recruitmentOptions } from "~/components/explore/directory";
import { useDirectory, usePrefetchClub, useSavedClubs } from "~/components/explore/hooks";
import { FieldLabel, FilterChip, SearchField, useDebounced, useNotice } from "~/components/explore/parts";
import { Header, useHeaderInset } from "~/components/header";
import { Bookmark, CalendarDays, Compass, SlidersHorizontal, Users, X } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, DOCK_CLEARANCE, EmptyState, ErrorState, IconButton, Press } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { useTheme } from "~/lib/theme";
import type { PublicClub } from "~/lib/types";

const Separator = () => <View style={{ height: CLUB_CARD_GAP }} />;
const keyOf = (club: PublicClub) => club.id;
const sortOptions = [{ value: "name", label: "Name A–Z" }, { value: "deadline", label: "Next deadline" }];
const filterLabel = (key: keyof DirectoryFilters, value: string) => key === "query" ? `“${value}”` : key === "recruitment" ? recruitmentOptions.find(option => option.value === value)?.label ?? value
  : key === "time" ? `${value} hours / week` : key === "acceptance" ? `Acceptance up to ${value}%` : value;

export default function Explore() {
  const theme = useTheme();
  const { colors, radius } = theme;
  const router = useRouter();
  const top = useHeaderInset();
  const insets = useSafeAreaInsets();
  const { fontScale, height: screenHeight } = useWindowDimensions();
  const directory = useDirectory();
  const notice = useNotice({ dock: true });
  const saved = useSavedClubs(notice.show);
  const prefetch = usePrefetchClub();
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [sheet, setSheet] = useState(false);
  // One clock per visit, so a deadline does not flip a card's state mid-scroll.
  const [now, setNow] = useState(() => Date.now());
  const search = useDebounced(query, 180);

  const clubs = directory.data?.clubs;
  const filters = useMemo(() => ({ ...choices, query: search }), [choices, search]);
  const filtered = useMemo(() => filterDirectory(clubs ?? [], filters, now), [clubs, filters, now]);
  const categories = useMemo(() => rankedCategories(clubs ?? []), [clubs]);
  const recruitmentCounts = useMemo(() => {
    const matches = filterDirectory(clubs ?? [], { ...filters, recruitment: "all" }, now);
    return { all: matches.length, open: matches.filter(club => clubRecruitment(club, now).available).length, closed: matches.filter(club => !clubRecruitment(club, now).available).length, closing: matches.filter(club => clubRecruitment(club, now).closingSoon).length };
  }, [clubs, filters, now]);
  // Filters with fewer than two real options stay hidden; acceptance needs at least three clubs reporting a rate.
  const timeOptions = ["1-3", "3-5", "5+"].filter(time => clubs?.some(club => club.timeCommitment === time));
  const acceptanceReported = (clubs ?? []).filter(club => club.acceptanceRate != null).length >= 3;
  const active = (Object.keys(filters) as (keyof DirectoryFilters)[]).filter(key => key !== "sort" && filters[key] !== emptyDirectoryFilters[key]);
  const sheetActive = [choices.recruitment !== "all", choices.time !== "all", choices.acceptance !== "all", choices.sort !== "name"].filter(Boolean).length;

  const height = clubCardHeight(theme, fontScale);
  const change = (key: keyof DirectoryFilters, value: string) => { if (key === "query") setQuery(value); else setChoices(current => ({ ...current, [key]: value })); };
  const clear = () => { setQuery(""); setChoices(emptyDirectoryFilters); };
  const refresh = () => { setNow(Date.now()); directory.refetch(); saved.query.refetch(); };
  const open = useCallback((club: PublicClub) => router.push({ pathname: "/club/[id]", params: { id: club.id } }), [router]);
  const pressIn = useCallback((club: PublicClub) => prefetch(club.id), [prefetch]);
  const { setSaved, ids } = saved;
  const renderItem = useCallback(({ item, index }: { item: PublicClub; index: number }) => (
    <ClubCard club={item} saved={ids.has(item.id)} height={height} now={now} onOpen={open} onPressIn={pressIn} onToggleSaved={setSaved} testID={`explore-club-${index}`} />
  ), [ids, height, now, open, pressIn, setSaved]);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: height + CLUB_CARD_GAP, offset: (height + CLUB_CARD_GAP) * index, index }), [height]);

  const failed = directory.isError || !!directory.data?.error;
  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button full variant="secondary" icon={CalendarDays} label="Events" testID="explore-events" onPress={() => router.push("/events")} /></View>
        <View style={{ flex: 1 }}><Button full variant="secondary" icon={Bookmark} label="Saved clubs" testID="explore-saved" onPress={() => router.push("/saved-clubs")} /></View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <SearchField testID="explore-search" label="Search clubs, interests, or keywords" placeholder="Search clubs or interests" value={query} onChangeText={setQuery} />
        <View>
          <IconButton testID="explore-filter" tone="surface" icon={SlidersHorizontal} label={sheetActive ? `Filter clubs (${sheetActive} active)` : "Filter clubs"} selected={sheetActive > 0} onPress={() => setSheet(true)} />
        </View>
      </View>
      {clubs && categories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Browse categories" keyboardShouldPersistTaps="handled" style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <FilterChip testID="explore-category-all" label="All" count={clubs.length} icon={Users} selected={choices.category === "all"} onPress={() => change("category", "all")} />
          {categories.map(({ category, count }) => {
            const selected = choices.category.toLowerCase() === category.toLowerCase();
            // Choosing the selected category again returns to all interests, as on the web.
            return <FilterChip key={category} label={category} count={count} icon={categoryIcon(category)} selected={selected} onPress={() => change("category", selected ? "all" : category)} />;
          })}
        </ScrollView>
      ) : null}
      {active.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <Text variant="small">Filters applied</Text>
          {active.map(key => (
            <Press key={key} accessibilityLabel={`Remove filter: ${filterLabel(key, filters[key])}`} onPress={() => change(key, emptyDirectoryFilters[key])}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              <Text variant="smallStrong" numberOfLines={1} style={{ maxWidth: 200 }}>{filterLabel(key, filters[key])}</Text>
              <X size={14} color={colors.mutedForeground} />
            </Press>
          ))}
          <Button variant="ghost" size="compact" label="Clear all" testID="explore-clear" onPress={clear} />
        </View>
      ) : null}
      {choices.recruitment !== "all" ? <Text variant="caption">Availability reflects applications on OutClass. Check each club’s website for external recruitment.</Text> : null}
      {clubs && !failed ? (
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Text variant="section" accessibilityRole="header">{active.length ? "Search results" : "All clubs"}</Text>
          <Text variant="small" accessibilityLiveRegion="polite" testID="explore-count">{filtered.length} {filtered.length === 1 ? "club" : "clubs"}</Text>
        </View>
      ) : null}
    </View>
  );

  const empty = directory.isPending ? (
    <View accessibilityLabel="Loading clubs…" accessibilityRole="progressbar" style={{ gap: CLUB_CARD_GAP }}>
      {Array.from({ length: 5 }, (_, index) => <ClubCardSkeleton key={index} height={height} />)}
    </View>
  ) : failed ? (
    <ErrorState message={directory.data?.error ?? errorMessage(directory.error, "We couldn’t load the club directory. Please try again.")} offline={directory.error instanceof ApiError && directory.error.offline} onRetry={refresh} />
  ) : (
    <EmptyState icon={Compass}
      title={clubs?.length ? "No clubs match this search." : "No clubs available yet."}
      body={clubs?.length ? "No club fits the current keyword or filters." : "No club profiles are published at your school yet."}
      action={active.length ? <Button variant="secondary" label="Clear search and filters" onPress={clear} /> : <Button variant="secondary" label="See campus events" onPress={() => router.push("/events")} />} />
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="explore-screen"
        data={failed ? [] : filtered}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: top + theme.space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + DOCK_CLEARANCE }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        scrollIndicatorInsets={{ top, bottom: DOCK_CLEARANCE }}
        refreshControl={<RefreshControl refreshing={directory.isRefetching} onRefresh={refresh} tintColor={colors.mutedForeground} colors={[colors.primary]} progressBackgroundColor={colors.card} progressViewOffset={top} />}
      />
      <Header title="Explore" />
      {notice.element}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Filter clubs" testID="explore-filter-sheet">
        {/* Every group can be on screen at once; a small phone scrolls rather than hiding Done. */}
        <ScrollView style={{ maxHeight: screenHeight * 0.62 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }} showsVerticalScrollIndicator={false}>
          <FieldLabel>Availability</FieldLabel>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {recruitmentOptions.map(option => <FilterChip key={option.value} testID={`explore-availability-${option.value}`} label={`${option.label} (${recruitmentCounts[option.value]})`} selected={choices.recruitment === option.value} onPress={() => change("recruitment", option.value)} />)}
          </View>
          {timeOptions.length >= 2 ? (
            <>
              <FieldLabel>Time commitment</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[{ value: "all", label: "Any commitment" }, ...timeOptions.map(time => ({ value: time, label: `${time} hours / week` }))].map(option => <FilterChip key={option.value} label={option.label} selected={choices.time === option.value} onPress={() => change("time", option.value)} />)}
              </View>
            </>
          ) : null}
          {acceptanceReported ? (
            <>
              <FieldLabel>Club-reported acceptance</FieldLabel>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[{ value: "all", label: "Any / not reported" }, ...[5, 10, 25, 50, 100].map(value => ({ value: String(value), label: `Up to ${value}%` }))].map(option => <FilterChip key={option.value} label={option.label} selected={choices.acceptance === option.value} onPress={() => change("acceptance", option.value)} />)}
              </View>
            </>
          ) : null}
          <FieldLabel>Sort</FieldLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[...sortOptions, ...(acceptanceReported ? [{ value: "acceptance", label: "Reported acceptance rate" }] : [])].map(option => <FilterChip key={option.value} testID={`explore-sort-${option.value}`} label={option.label} selected={choices.sort === option.value} onPress={() => change("sort", option.value)} />)}
          </View>
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}><Button full size="large" variant="secondary" label="Reset" testID="explore-filter-reset" disabled={!sheetActive} onPress={() => setChoices(current => ({ ...emptyDirectoryFilters, category: current.category }))} /></View>
          <View style={{ flex: 1 }}><Button full size="large" label={`Show ${filtered.length} ${filtered.length === 1 ? "club" : "clubs"}`} testID="explore-filter-done" onPress={() => setSheet(false)} /></View>
        </View>
      </Sheet>
    </View>
  );
}
