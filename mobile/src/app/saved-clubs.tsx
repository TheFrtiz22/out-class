import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CLUB_CARD_GAP, ClubCard, ClubCardSkeleton, clubCardHeight } from "~/components/explore/club-card";
import { useIsAlumni } from "~/components/alumni-banner";
import { usePrefetchClub, useSavedClubs } from "~/components/explore/hooks";
import { useNotice } from "~/components/explore/parts";
import { Header, useHeaderInset } from "~/components/header";
import { useRefetchOnFocus } from "~/components/inbox/use-refetch-on-focus";
import { ArrowRight, Bookmark, X } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, EmptyState, ErrorState, usePullControl } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { useTheme } from "~/lib/theme";
import type { PublicClub, SavedClubs } from "~/lib/types";

type Item = SavedClubs["items"][number];
const Separator = () => <View style={{ height: CLUB_CARD_GAP }} />;
const keyOf = (item: Item) => item.club.id;
const REMOVE_WIDTH = 92;

/** Saved clubs (components/views/saved-clubs-view.tsx). Removing needs no confirmation, as on the web: swipe a card, or use its bookmark. */
export default function SavedClubsScreen() {
  const theme = useTheme();
  const { colors, radius } = theme;
  const router = useRouter();
  const top = useHeaderInset();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const notice = useNotice();
  const { query, items, setSaved } = useSavedClubs(notice.show);
  useRefetchOnFocus(query);
  const prefetch = usePrefetchClub();
  // Alumni keep their saved clubs but can't change them (the server refuses too): no swipe to remove, a locked bookmark.
  const alumni = useIsAlumni();
  const [now] = useState(() => Date.now());
  const height = clubCardHeight(theme, fontScale);

  const open = useCallback((club: PublicClub) => router.push({ pathname: "/club/[id]", params: { id: club.id } }), [router]);
  const pressIn = useCallback((club: PublicClub) => prefetch(club.id), [prefetch]);
  const renderItem = useCallback(({ item, index }: { item: Item; index: number }) => (
    <Swipeable
      enabled={!alumni}
      friction={1.6}
      rightThreshold={REMOVE_WIDTH / 2}
      overshootRight={false}
      renderRightActions={() => alumni ? null : (
        <Pressable testID={`saved-remove-${index}`} accessibilityRole="button" accessibilityLabel={`Remove ${item.club.name} from saved clubs`} onPress={() => setSaved(item.club, false)}
          style={{ width: REMOVE_WIDTH, height, marginLeft: 8, borderRadius: radius.lg, backgroundColor: colors.destructive, alignItems: "center", justifyContent: "center", gap: 4 }}>
          <X size={20} color={colors.destructiveForeground} />
          <Text variant="smallStrong" color={colors.destructiveForeground}>Remove</Text>
        </Pressable>
      )}
    >
      <ClubCard club={item.club} saved height={height} now={now} onOpen={open} onPressIn={pressIn} onToggleSaved={setSaved} saveLocked={alumni} testID={`saved-club-${index}`} />
    </Swipeable>
  ), [colors, radius, height, now, open, pressIn, setSaved, alumni]);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: height + CLUB_CARD_GAP, offset: (height + CLUB_CARD_GAP) * index, index }), [height]);

  const header = (
    <View style={{ gap: 6, paddingBottom: 14 }}>
      <Text variant="small">Saving a club doesn’t apply, join or subscribe you.</Text>
      {items.length ? <Text variant="small" accessibilityLiveRegion="polite" testID="saved-count" style={{ marginTop: 6 }}>{items.length} saved {items.length === 1 ? "club" : "clubs"}</Text> : null}
    </View>
  );
  const empty = query.isPending ? (
    <View accessibilityLabel="Loading Saved clubs…" accessibilityRole="progressbar" style={{ gap: CLUB_CARD_GAP }}>
      {Array.from({ length: 4 }, (_, index) => <ClubCardSkeleton key={index} height={height} />)}
    </View>
  ) : query.isError && !query.data ? (
    <ErrorState message={errorMessage(query.error, "Couldn’t load your saved clubs.")} offline={query.error instanceof ApiError && query.error.offline} onRetry={() => query.refetch()} />
  ) : (
    // Back to the tabs underneath, on Explore: a replace would stack a second tab shell.
    <EmptyState icon={Bookmark} title="No saved clubs yet." body="Save a club from Explore or its profile, and you’ll find it here." action={<Button icon={ArrowRight} label="Browse clubs" testID="saved-browse" onPress={() => router.dismissTo("/explore")} />} />
  );

  const pullControl = usePullControl(() => query.refetch(), top);
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        testID="saved-clubs-screen"
        data={items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: top + theme.space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior="never"
        scrollIndicatorInsets={{ top }}
        refreshControl={pullControl}
      />
      <Header title="Saved clubs" back />
      {notice.element}
    </View>
  );
}
