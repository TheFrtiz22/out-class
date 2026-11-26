import { useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import type { IconComponent } from "~/components/icon-factory";
import { Archive, Check, ChevronRight, Clock, Mail } from "~/components/icons";
import { clubName, fullDate, isUrgent, preview, relativeTime, typeLabel, URGENT_RED } from "~/components/inbox/presentation";
import { Text } from "~/components/text";
import { ClubMark, Press } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";
import type { InboxRow } from "~/lib/types";

const ACTION_WIDTH = 84;

/** Urgent updates carry the same white-on-red pill as the web Inbox, in light and dark appearance. */
export function UrgentPill() {
  return (
    <View accessible={false} style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 22, paddingHorizontal: 9, borderRadius: 11, backgroundColor: URGENT_RED }}>
      <Clock size={12} color="#ffffff" />
      <Text variant="caption" color="#ffffff" style={{ fontFamily: fonts.sansSemibold }}>Urgent</Text>
    </View>
  );
}

function SwipeAction({ icon: Icon, label, background, color, onPress, testID }: { icon: IconComponent; label: string; background: string; color: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: ACTION_WIDTH, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: background }}>
      <Icon size={22} color={color} />
      <Text variant="caption" color={color} style={{ fontFamily: fonts.sansSemibold }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/**
 * One update: club, title, two lines of body, type and relative time, as the web's inbox row.
 * Swipe left for Mark read / Mark unread and Dismiss (archive); the same actions are exposed to
 * VoiceOver and TalkBack as custom actions.
 */
export function InboxListRow({ item, now, first, last, onOpen, onRead, onArchive }: { item: InboxRow; now: number; first: boolean; last: boolean; onOpen: () => void; onRead: (read: boolean) => void; onArchive: () => void }) {
  const { colors, radius } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const unread = !item.readAt;
  const readLabel = unread ? "Mark read" : "Mark unread";
  const corners = { borderTopLeftRadius: first ? radius.xl2 : 0, borderTopRightRadius: first ? radius.xl2 : 0, borderBottomLeftRadius: last ? radius.xl2 : 0, borderBottomRightRadius: last ? radius.xl2 : 0 };
  const act = (action: () => void) => { haptics.save(); swipe.current?.close(); action(); };

  return (
    <View style={[{ overflow: "hidden", backgroundColor: colors.card, borderColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: last ? StyleSheet.hairlineWidth : 0 }, corners]}>
      <ReanimatedSwipeable
        ref={swipe}
        friction={1.6}
        rightThreshold={ACTION_WIDTH * 0.6}
        overshootRight={false}
        onSwipeableWillOpen={() => haptics.tick()}
        renderRightActions={() => (
          <View style={{ flexDirection: "row" }}>
            <SwipeAction testID={`inbox-row-read-${item.id}`} icon={unread ? Check : Mail} label={readLabel} background={colors.secondary} color={colors.secondaryForeground} onPress={() => act(() => onRead(unread))} />
            <SwipeAction testID={`inbox-row-archive-${item.id}`} icon={Archive} label="Dismiss" background={colors.primary} color={colors.primaryForeground} onPress={() => act(onArchive)} />
          </View>
        )}
      >
        <Press
          large
          testID={`inbox-row-${item.type.toLowerCase()}`}
          onPress={onOpen}
          accessibilityLabel={`${unread ? "Unread. " : ""}${isUrgent(item) ? "Urgent. " : ""}${clubName(item)}. ${item.title}. ${typeLabel(item)}, ${relativeTime(item.createdAt, fullDate(item.createdAt), now)}`}
          accessibilityActions={[{ name: "read", label: readLabel }, { name: "archive", label: "Dismiss" }]}
          onAccessibilityAction={event => { if (event.nativeEvent.actionName === "read") onRead(unread); if (event.nativeEvent.actionName === "archive") onArchive(); }}
          style={{ backgroundColor: colors.card, paddingVertical: 12, paddingRight: 14, paddingLeft: 10, flexDirection: "row", alignItems: "flex-start", gap: 10 }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 16, backgroundColor: unread ? colors.primary : "transparent" }} />
          <ClubMark name={clubName(item)} color={item.club?.color} logoUrl={item.club?.logoUrl} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text variant="small" numberOfLines={1} style={{ flex: 1, color: colors.foreground, fontFamily: unread ? fonts.sansBold : fonts.sansMedium }}>{clubName(item)}</Text>
              <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>{relativeTime(item.createdAt, fullDate(item.createdAt), now)}</Text>
              <ChevronRight size={13} color={colors.mutedForeground} />
            </View>
            <Text variant={unread ? "bodyStrong" : "body"} numberOfLines={1}>{item.title}</Text>
            {item.body ? <Text variant="small" numberOfLines={2}>{preview(item)}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 }}>
              {isUrgent(item) ? <UrgentPill /> : null}
              <Text variant="caption">{typeLabel(item)}</Text>
            </View>
          </View>
        </Press>
      </ReanimatedSwipeable>
    </View>
  );
}
