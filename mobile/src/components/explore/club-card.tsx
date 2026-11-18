import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { clubImage, clubRecruitment, recruitmentDate } from "~/components/explore/directory";
import { Bookmark } from "~/components/icons";
import { Text } from "~/components/text";
import { ClubMark, IconButton, Press, Skeleton } from "~/components/ui";
import { config } from "~/lib/config";
import { type Theme, fonts, useTheme } from "~/lib/theme";
import type { PublicClub } from "~/lib/types";

const PADDING = 14;
const MARK = 48;
/** Space between cards in a list. */
export const CLUB_CARD_GAP = 10;

/**
 * The height of one club card at a font scale. Every line has a fixed line count (name 1, category 1,
 * pitch 2, recruitment 1, deadline 1), so the list can tell FlatList each row's position
 * (`getItemLayout`) and still grow with Dynamic Type.
 */
export function clubCardHeight(theme: Pick<Theme, "text" | "leading">, fontScale: number) {
  const scale = Math.min(Math.max(fontScale, 1), 2.2);
  const lines = theme.text.body * theme.leading.compact + 3 * theme.text.caption * theme.leading.compact + 2 * theme.text.small * theme.leading.compact;
  return Math.ceil(lines * scale) + 2 * PADDING + 16;
}

type Props = { club: PublicClub; saved: boolean; height: number; now: number; onOpen: (club: PublicClub) => void; onPressIn?: (club: PublicClub) => void; onToggleSaved?: (club: PublicClub, saved: boolean) => void; testID?: string };

/** One club in Explore and Saved clubs (components/clubs/discovery-card.tsx at list density). */
export const ClubCard = memo(function ClubCard({ club, saved, height, now, onOpen, onPressIn, onToggleSaved, testID }: Props) {
  const { colors, radius, dark } = useTheme();
  const recruitment = clubRecruitment(club, now);
  const deadline = recruitment.deadline ? `${recruitment.expired ? "Closed" : "Deadline"} · ${recruitmentDate(recruitment.deadline)}` : "Deadline not published";
  const label = onToggleSaved ? saved ? "Remove from saved clubs" : "Save to saved clubs" : "";
  return (
    <View style={{ height, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: colors.schoolPrimary, shadowOpacity: dark ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <Press large testID={testID} accessibilityLabel={`View ${club.name} club page`} accessibilityHint={`${club.category || "Student organization"}. ${recruitment.label}.`} onPressIn={() => onPressIn?.(club)} onPress={() => onOpen(club)}
        style={{ flex: 1, flexDirection: "row", gap: 12, padding: PADDING, paddingRight: onToggleSaved ? 52 : PADDING }}>
        <ClubMark name={club.name} color={club.color} logoUrl={clubImage(club.logoUrl, config.apiUrl)} size={MARK} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{club.name}</Text>
          <Text variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>{club.category || "Student organization"}</Text>
          <Text variant="small" color={colors.foreground} numberOfLines={2} style={{ marginTop: 6 }}>{club.pitch || club.description || "Get to know this club and explore its profile."}</Text>
          <Text variant="caption" numberOfLines={1} color={recruitment.available ? colors.success : colors.mutedForeground} style={{ marginTop: 6, fontFamily: fonts.sansSemibold }}>{recruitment.label}</Text>
          <Text variant="caption" numberOfLines={1}>{deadline}</Text>
        </View>
      </Press>
      {onToggleSaved ? (
        <View style={{ position: "absolute", top: 6, right: 6 }}>
          <IconButton testID={testID ? `${testID}-save` : undefined} icon={Bookmark} selected={saved} label={`${label}: ${club.name}`} onPress={() => onToggleSaved(club, !saved)} />
        </View>
      ) : null}
    </View>
  );
});

/** Loading placeholder with the card's own height and layout. */
export function ClubCardSkeleton({ height }: { height: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ height, flexDirection: "row", gap: 12, padding: PADDING, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>
      <Skeleton width={MARK} height={MARK} radius={12} />
      <View style={{ flex: 1, gap: 9 }}><Skeleton width="58%" height={16} /><Skeleton width="34%" height={11} /><Skeleton width="92%" /><Skeleton width="70%" /><Skeleton width="44%" height={11} /></View>
    </View>
  );
}
