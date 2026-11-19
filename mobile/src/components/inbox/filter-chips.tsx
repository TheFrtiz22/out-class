import { ScrollView } from "react-native";
import { Text } from "~/components/text";
import { Press } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

/** A horizontally scrolling single-choice filter (the web's PillSelect options laid out for touch). */
export function FilterChips<T extends string>({ label, options, value, onChange, testID }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; testID?: string }) {
  const { colors, radius } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} style={{ marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Press key={option.value} testID={testID ? `${testID}-${option.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : undefined} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={option.label}
            onPress={() => { if (!active) { haptics.tick(); onChange(option.value); } }}
            style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: radius.full, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }}>
            <Text variant="smallStrong" color={active ? colors.primaryForeground : colors.foreground}>{option.label}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}
