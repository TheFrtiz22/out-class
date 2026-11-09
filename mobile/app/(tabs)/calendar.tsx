import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "@/components/screen";
import { ScreenHeader, SectionTitle, Surface } from "@/components/ui";
import { font, navyGradient, radius, space, text, useTheme } from "@/theme/tokens";

/** Calendar: this week's strip and the day's events, interviews and meetings. Data arrives with the calendar endpoint. */
export default function Calendar() {
  const t = useTheme();
  const days = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, []);
  const today = new Date().toDateString();
  const [selected, setSelected] = useState(today);
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <Screen>
      <ScreenHeader title={month.split(" ")[0]} eyebrow={month.split(" ")[1]} subtitle="Events, interviews and meetings from your clubs. Eastern Time." />
      <View style={[styles.week, { backgroundColor: t.surface, borderColor: t.edge, boxShadow: t.shadow }]}>
        {days.map((d) => {
          const on = d.toDateString() === selected;
          return (
            <Pressable key={d.toISOString()} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSelected(d.toDateString())} style={styles.day}>
              {on ? <LinearGradient colors={navyGradient} style={[StyleSheet.absoluteFill, { borderRadius: 16 }]} /> : null}
              <Text style={[text.small, { fontSize: 12, fontFamily: font.textSemibold, color: on ? "rgba(255,249,241,0.75)" : t.muted }]}>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</Text>
              <Text style={{ fontFamily: font.display, fontSize: 22, color: on ? "#fff9f1" : t.ink }}>{d.getDate()}</Text>
              {d.toDateString() === today && !on ? <View style={[styles.todayDot, { backgroundColor: t.accent }]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <SectionTitle title={new Date(selected).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} />
      <Surface>
        <Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>Nothing scheduled. </Text>Club events, interview slots and coffee chats you book will appear here.</Text>
      </Surface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: "row", padding: 6, borderRadius: radius.lg, borderWidth: 1 },
  day: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 2, borderRadius: 16, overflow: "hidden" },
  todayDot: { position: "absolute", bottom: 5, width: 5, height: 5, borderRadius: 3 },
});
