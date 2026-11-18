import { type ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { IconComponent } from "~/components/icon-factory";
import { Check, Search, X } from "~/components/icons";
import { Text } from "~/components/text";
import { DOCK_CLEARANCE, TARGET } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";

/** A value that follows its source after a pause, so typing does not filter or fetch on every key. */
export function useDebounced<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/** The pill search field of Explore and Events (components/ui/search-field.tsx): icon, text, clear. */
export function SearchField({ label, placeholder, value, onChangeText, testID }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void; testID?: string }) {
  const { colors, radius, text } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: radius.full, borderWidth: focused ? 2 : 1, borderColor: focused ? colors.ring : colors.input, backgroundColor: colors.card, paddingLeft: focused ? 13 : 14 }}>
      <Search size={18} color={colors.mutedForeground} />
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
        style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 0, fontFamily: fonts.sans, fontSize: Math.max(16, text.body), color: colors.foreground }}
      />
      {value ? (
        <Pressable testID={testID ? `${testID}-clear` : undefined} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={6} onPress={() => onChangeText("")} style={{ width: TARGET, height: TARGET, alignItems: "center", justifyContent: "center" }}>
          <X size={16} color={colors.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** One selectable filter chip (components/ui/filter-chips.tsx): icon, label and count; filled when selected. */
export function FilterChip({ label, count, icon: Icon, selected, onPress, testID }: { label: string; count?: number; icon?: IconComponent; selected: boolean; onPress: () => void; testID?: string }) {
  const { colors, radius } = useTheme();
  const ink = selected ? colors.primaryForeground : colors.foreground;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      onPress={() => { haptics.tick(); onPress(); }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }}>
      {Icon ? <Icon size={16} weight={selected ? "fill" : "regular"} color={ink} /> : null}
      <Text variant="smallStrong" color={ink} numberOfLines={1}>{label}</Text>
      {count === undefined ? null : <Text variant="caption" color={selected ? colors.primaryForeground : colors.mutedForeground}>{count}</Text>}
    </Pressable>
  );
}

/** One choice in a filter sheet: a full-width row with a check when selected. */
export function OptionRow({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected, checked: selected }} accessibilityLabel={label}
      onPress={() => { if (!selected) haptics.tick(); onPress(); }}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: TARGET + 4, paddingVertical: 6 }}>
      <Text variant={selected ? "bodyStrong" : "body"} style={{ flex: 1 }}>{label}</Text>
      {selected ? <Check size={18} color={colors.brandInk} /> : null}
    </Pressable>
  );
}

/** A small uppercase label above a group of options. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text variant="eyebrow" accessibilityRole="header" style={{ marginTop: 6 }}>{children}</Text>;
}

/**
 * A short message that rises above the content and leaves by itself: the server's refusal after an
 * optimistic change was rolled back, or a brief confirmation ("Link copied."). Announced to screen readers.
 */
export function useNotice({ dock = false }: { dock?: boolean } = {}) {
  const [notice, setNotice] = useState<{ id: number; text: string; tone: "error" | "ok" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function show(text: string, tone: "error" | "ok" = "error") {
    if (timer.current) clearTimeout(timer.current);
    setNotice({ id: Date.now(), text, tone });
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => setNotice(null), 4500);
  }
  const element = notice ? <NoticeBar key={notice.id} text={notice.text} tone={notice.tone} dock={dock} onDismiss={() => setNotice(null)} /> : null;
  return { show, element };
}

function NoticeBar({ text, tone, dock, onDismiss }: { text: string; tone: "error" | "ok"; dock: boolean; onDismiss: () => void }) {
  const { colors, radius, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + (dock ? DOCK_CLEARANCE : 16), zIndex: 30 }}
    >
      <Pressable testID="notice" accessibilityRole="alert" accessibilityLabel={text} onPress={onDismiss}
        style={{ borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: tone === "error" ? colors.destructive : colors.border, shadowColor: colors.schoolPrimary, shadowOpacity: dark ? 0 : 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
        <Text variant="smallStrong" color={tone === "error" ? colors.destructive : colors.foreground}>{text}</Text>
      </Pressable>
    </View>
  );
}
