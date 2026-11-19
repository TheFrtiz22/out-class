import { Image } from "expo-image";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { EASTERN, clubImage, eventDateLabel, eventScheduleLabel } from "~/components/explore/directory";
import type { IconComponent } from "~/components/icon-factory";
import { Bookmark, CalendarPlus, Clock, MapPin } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Press, Skeleton } from "~/components/ui";
import { config } from "~/lib/config";
import { fonts, useTheme } from "~/lib/theme";
import type { CampusEvent } from "~/lib/types";

const month = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short" });
const day = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, day: "2-digit" });
export const BookmarkFilled: IconComponent = props => <Bookmark {...props} weight="fill" />;

type Props = { event: CampusEvent; saved: boolean; saveReady: boolean; onOpen: (event: CampusEvent) => void; onToggleSaved: (eventId: string, saved: boolean) => void; onAddToCalendar: (event: CampusEvent) => void; testID?: string };

/** One event on the board's list (components/events/smart-event-card.tsx): date, host, title, when, where, save and calendar. */
export const EventCard = memo(function EventCard({ event, saved, saveReady, onOpen, onToggleSaved, onAddToCalendar, testID }: Props) {
  const { colors, radius, dark } = useTheme();
  const flyer = clubImage(event.flyerUrl, config.apiUrl);
  const when = eventScheduleLabel(event);
  const rsvp = !event.rsvpEnabled ? "" : event.capacity !== null && event.rsvpCount >= event.capacity ? "Event full" : event.rsvpRequired ? "RSVP required · Register in event details" : "RSVP available in event details";
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", shadowColor: colors.schoolPrimary, shadowOpacity: dark ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <Press large testID={testID} accessibilityRole="link" accessibilityLabel={`View event: ${event.title}, ${when}, ${event.location}, hosted by ${event.clubName}`} onPress={() => onOpen(event)}>
        {flyer ? <Image source={{ uri: flyer }} accessibilityLabel={`${event.title} event poster`} contentFit="cover" transition={150} style={{ width: "100%", aspectRatio: 16 / 9 }} /> : null}
        <View style={{ flexDirection: "row", gap: 12, padding: 14, paddingBottom: 10 }}>
          <View accessible accessibilityLabel={eventDateLabel(event.date)} style={{ width: 50, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.brandSubtle, alignItems: "center", alignSelf: "flex-start" }}>
            <Text variant="eyebrow" color={colors.brandInk} maxFontSizeMultiplier={1.3}>{month.format(new Date(event.date))}</Text>
            <Text variant="metric" color={colors.brandInk} maxFontSizeMultiplier={1.3} style={{ fontSize: 22, lineHeight: 26 }}>{day.format(new Date(event.date))}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" numberOfLines={1}><Text variant="caption" color={colors.foreground} style={{ fontFamily: fonts.sansSemibold }}>{event.clubName}</Text>{event.category ? ` · ${event.category}` : ""}</Text>
            <Text variant="card" numberOfLines={2}>{event.title}</Text>
            <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}><View style={{ marginTop: 2 }}><Clock size={14} color={colors.mutedForeground} /></View><Text variant="small" style={{ flex: 1 }}>{when}</Text></View>
            <View style={{ flexDirection: "row", gap: 6 }}><View style={{ marginTop: 2 }}><MapPin size={14} color={colors.mutedForeground} /></View><Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{event.location}</Text></View>
            {event.description ? <Text variant="small" color={colors.foreground} numberOfLines={2} style={{ marginTop: 2 }}>{event.description}</Text> : null}
            {rsvp ? <Text variant="caption" style={{ marginTop: 2 }}>{rsvp}</Text> : null}
          </View>
        </View>
      </Press>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
        <View style={{ flex: 1 }}><Button full size="compact" variant={saved ? "accent" : "secondary"} icon={saved ? BookmarkFilled : Bookmark} label={saved ? "Saved" : "Save"} accessibilityHint={event.title} disabled={!saveReady} testID={testID ? `${testID}-save` : undefined} onPress={() => onToggleSaved(event.id, !saved)} /></View>
        <View style={{ flex: 1.4 }}><Button full size="compact" variant="secondary" icon={CalendarPlus} label="Add to Calendar" accessibilityHint={event.title} testID={testID ? `${testID}-calendar` : undefined} onPress={() => onAddToCalendar(event)} /></View>
      </View>
    </View>
  );
});

export function EventCardSkeleton() {
  const { colors, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Skeleton width={50} height={56} radius={10} />
        <View style={{ flex: 1, gap: 9 }}><Skeleton width="46%" height={11} /><Skeleton width="80%" height={18} /><Skeleton width="72%" /><Skeleton width="54%" /></View>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}><Skeleton width="40%" height={44} radius={22} /><Skeleton width="56%" height={44} radius={22} /></View>
    </View>
  );
}
