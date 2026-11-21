import { useState } from "react";
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import type { IconComponent } from "~/components/icon-factory";
import { Check, LayoutGrid, Search, X } from "~/components/icons";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Press, TARGET } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { fonts, useTheme } from "~/lib/theme";

export type PickerOption<T extends string = string> = { value: T; label: string; count?: number; icon?: IconComponent };

/** Beyond this many options the "More" sheet gets a search box. */
export const PICKER_SEARCH_AFTER = 8;
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "none";

/**
 * Which options sit on the screen and how many wait in the sheet. Everything shows when one "More"
 * chip would only hide a single option; otherwise the first `inline` stay, with the chosen one
 * swapped in for the last of them when it would otherwise be hidden, so the current choice is always visible.
 */
export function pickerLayout<T extends string>(options: readonly PickerOption<T>[], value: T, inline: number) {
  if (options.length <= inline + 1) return { visible: [...options], hidden: 0 };
  const visible = options.slice(0, inline);
  const chosen = options.find(option => option.value === value);
  if (chosen && !visible.includes(chosen)) visible[visible.length - 1] = chosen;
  return { visible, hidden: options.length - visible.length };
}

/** Options whose label contains every typed word, ignoring case and accents. */
export function matchOptions<T extends string>(options: readonly PickerOption<T>[], query: string) {
  const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.length ? options.filter(option => words.every(word => fold(option.label).includes(word))) : [...options];
}

/** A–Z by label, with the "everything" option (if any) kept on top. */
export function sheetOrder<T extends string>(options: readonly PickerOption<T>[], first?: T) {
  return [...options].sort((a, b) => Number(b.value === first) - Number(a.value === first) || a.label.localeCompare(b.label, "en-US"));
}

function OptionChip({ option, selected, onPress, testID }: { option: PickerOption; selected: boolean; onPress: () => void; testID?: string }) {
  const { colors, radius } = useTheme();
  const ink = selected ? colors.primaryForeground : colors.foreground;
  const Icon = option.icon;
  return (
    <Press testID={testID} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`} onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET, maxWidth: "100%", paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }}>
      {Icon ? <Icon size={16} weight={selected ? "fill" : "regular"} color={ink} /> : null}
      <Text variant="smallStrong" color={ink} numberOfLines={1} style={{ flexShrink: 1 }}>{option.label}</Text>
      {option.count === undefined ? null : <Text variant="caption" color={selected ? colors.primaryForeground : colors.mutedForeground} style={{ fontVariant: ["tabular-nums"] }}>{option.count}</Text>}
    </Press>
  );
}

/**
 * A single-choice filter that never scrolls sideways: a few options wrap onto the screen and the
 * rest wait behind a "More" chip that opens a sheet listing every option (searchable when the list is
 * long), with counts. One component for every chip filter in the app.
 */
export function OptionPicker<T extends string>({ label, options, value, onChange, inline = 4, moreLabel = "More", sheetTitle, searchPlaceholder, deselectTo, alphabetical, testID }: {
  label: string;
  options: readonly PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** How many options stay on screen before the rest move into the sheet. */
  inline?: number;
  moreLabel?: string;
  sheetTitle?: string;
  searchPlaceholder?: string;
  /** Pressing the chosen chip again picks this (Explore's categories go back to "All"); otherwise it does nothing. */
  deselectTo?: T;
  /** List the sheet A–Z (the `deselectTo` option stays first), for long lists the screen ranks by count. */
  alphabetical?: boolean;
  testID?: string;
}) {
  const { colors, radius, text } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { visible, hidden } = pickerLayout(options, value, inline);
  const searchable = options.length > PICKER_SEARCH_AFTER;
  const matches = matchOptions(alphabetical ? sheetOrder(options, deselectTo) : options, query);
  const id = (option: PickerOption<T>) => (testID ? `${testID}-${slug(option.value)}` : undefined);

  function pick(next: T) {
    if (next === value) { if (deselectTo !== undefined && deselectTo !== value) { haptics.tick(); onChange(deselectTo); } return; }
    haptics.tick();
    onChange(next);
  }
  const close = () => { setOpen(false); setQuery(""); };

  return (
    <>
      <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {visible.map(option => <OptionChip key={option.value} testID={id(option)} option={option} selected={option.value === value} onPress={() => pick(option.value)} />)}
        {hidden ? (
          <Press testID={testID ? `${testID}-more` : undefined} accessibilityRole="button" accessibilityLabel={`${moreLabel}, ${options.length} options`} accessibilityHint="Opens the full list"
            onPress={() => { haptics.tick(); setOpen(true); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: TARGET, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
            <LayoutGrid size={16} color={colors.foreground} />
            <Text variant="smallStrong" numberOfLines={1}>{moreLabel}</Text>
            <Text variant="caption" style={{ fontVariant: ["tabular-nums"] }}>+{hidden}</Text>
          </Press>
        ) : null}
      </View>

      <Sheet open={open} onClose={close} title={sheetTitle ?? label} testID={testID ? `${testID}-sheet` : undefined}>
        <View style={{ gap: 10 }}>
          {searchable ? (
            <View style={{ flexDirection: "row", alignItems: "center", minHeight: 48, borderRadius: radius.full, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.card, paddingLeft: 14 }}>
              <Search size={18} color={colors.mutedForeground} />
              <TextInput testID={testID ? `${testID}-search` : undefined} accessibilityLabel={`Search ${label.toLowerCase()}`} placeholder={searchPlaceholder ?? "Search"} placeholderTextColor={colors.mutedForeground}
                value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search"
                style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 0, fontFamily: fonts.sans, fontSize: Math.max(16, text.body), color: colors.foreground }} />
              {query ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery("")} style={{ width: TARGET, height: TARGET, alignItems: "center", justifyContent: "center" }}>
                  <X size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: height * 0.55 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View accessibilityRole="radiogroup" accessibilityLabel={label}>
              {matches.map((option, index) => {
                const selected = option.value === value;
                const Icon = option.icon;
                return (
                  <Press key={option.value} testID={testID ? `${testID}-sheet-${slug(option.value)}` : undefined} accessibilityRole="radio" accessibilityState={{ selected }}
                    accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
                    onPress={() => { if (!selected) { haptics.tick(); onChange(option.value); } close(); }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 4, paddingVertical: 8, borderTopWidth: index ? 0.5 : 0, borderTopColor: colors.border }}>
                    {Icon ? <Icon size={20} weight={selected ? "fill" : "regular"} color={selected ? colors.brandInk : colors.foreground} /> : null}
                    <Text variant={selected ? "bodyStrong" : "body"} numberOfLines={2} style={{ flex: 1 }}>{option.label}</Text>
                    {option.count === undefined ? null : <Text variant="small" style={{ fontVariant: ["tabular-nums"] }}>{option.count}</Text>}
                    <View style={{ width: 20, alignItems: "center" }}>{selected ? <Check size={18} color={colors.brandInk} /> : null}</View>
                  </Press>
                );
              })}
              {matches.length ? null : <Text variant="small" style={{ paddingVertical: 12 }} accessibilityLiveRegion="polite">Nothing matches “{query.trim()}”.</Text>}
            </View>
          </ScrollView>
        </View>
      </Sheet>
    </>
  );
}
