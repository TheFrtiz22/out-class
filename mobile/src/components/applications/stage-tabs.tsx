import { Pressable, ScrollView, View } from "react-native";
import { Text } from "~/components/text";
import { TARGET } from "~/components/ui";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

/** Underlined text tabs with counts ("Drafts 1"), as the web's UnderlineTabs: no filled pill; a zero count fades. */
export function StageTabs<T extends string>({ label, items, value, onChange }: { label: string; items: { id: T; label: string; count: number }[]; value: T; onChange: (value: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: -16 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel={label} contentContainerStyle={{ paddingHorizontal: 16, gap: 22 }}>
        {items.map(item => {
          const selected = item.id === value;
          return (
            <Pressable key={item.id} testID={`applications-tab-${item.id}`} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={`${item.label}, ${item.count}`}
              onPress={() => { if (!selected) { haptics.tick(); onChange(item.id); } }}
              style={{ minHeight: TARGET, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 2, borderBottomColor: selected ? colors.foreground : "transparent", marginBottom: -1, opacity: item.count || selected ? 1 : 0.55 }}>
              <Text variant={selected ? "bodyStrong" : "body"} color={selected ? colors.foreground : colors.mutedForeground}>{item.label}</Text>
              <Text variant="small" color={colors.mutedForeground} style={{ fontVariant: ["tabular-nums"] }}>{item.count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
