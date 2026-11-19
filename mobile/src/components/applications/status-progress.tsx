import { View } from "react-native";
import { Text } from "~/components/text";
import { useTheme } from "~/lib/theme";
import type { StudentApplication } from "~/lib/types";

/** The club's recruitment stages with the applicant's position (web: ApplicationStatusProgress). */
export function StatusProgress({ application }: { application: StudentApplication }) {
  const { colors } = useTheme();
  const { stages, current, previous } = application.statusProgress;
  return (
    <View accessibilityRole="list" accessibilityLabel={`Recruitment stages for ${application.club.name}`} style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
      {stages.map(stage => {
        const isCurrent = stage.id === current, done = previous.includes(stage.id);
        return (
          <View key={stage.id} accessible accessibilityLabel={`${stage.name}${isCurrent ? ", current stage" : done ? ", earlier stage" : ""}`} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isCurrent ? colors.brandInk : done ? colors.mutedForeground : "transparent", borderWidth: 1.5, borderColor: isCurrent ? colors.brandInk : done ? colors.mutedForeground : colors.border }} />
            <Text variant={isCurrent ? "smallStrong" : "small"} color={isCurrent ? colors.foreground : colors.mutedForeground}>{stage.name}</Text>
          </View>
        );
      })}
    </View>
  );
}
