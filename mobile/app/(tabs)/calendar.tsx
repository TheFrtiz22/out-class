import { LinearGradient } from "expo-linear-gradient";
import { MapPin } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/screen";
import { Pill, ScreenHeader, SectionTitle, Surface } from "@/components/ui";
import type { CalendarEvent } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { font, hit, navyGradient, radius, space, text, useTheme } from "@/theme/tokens";

const easternDate = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const typeLabel: Record<string, string> = { Interview: "Interview", "Interest Meeting": "Interest meeting", "Coffee Chat": "Coffee chat", Deadline: "Deadline" };
const isInterview = (type: string) => type === "Interview";

/** Calendar: a week at a time, with every event, interview and meeting from your clubs (Eastern Time). */
export default function Calendar() {
  const t = useTheme();
  const { data, error, loading, refresh } = useApi<{ events: CalendarEvent[] }>("/api/v1/calendar");
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => {
    const start = new Date(); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - start.getDay() + offset * 7);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
  }, [offset]);
  const today = easternDate(new Date());
  const [selected, setSelected] = useState(today);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of data?.events ?? []) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    for (const list of map.values()) list.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    return map;
  }, [data]);
  const dayEvents = byDay.get(selected) ?? [];
  const upcoming = (data?.events ?? []).filter((e) => e.date > selected).slice(0, 4);
  const month = days[3].toLocaleDateString("en-US", { month: "long" });
  const year = days[3].getFullYear();

  return (
    <Screen refreshing={loading && !!data} onRefresh={refresh}>
      <ScreenHeader title={month} eyebrow={String(year)} subtitle="Events, interviews and meetings from your clubs." />
      {error ? <Text accessibilityRole="alert" style={[text.body, { color: t.danger, marginBottom: space.md }]}>{error}</Text> : null}
      <View style={styles.weekNav}>
        <Pressable accessibilityRole="button" onPress={() => setOffset(offset - 1)} hitSlop={12}><Text style={[text.label, { color: t.info }]}>‹ Previous</Text></Pressable>
        {offset !== 0 ? <Pressable accessibilityRole="button" onPress={() => { setOffset(0); setSelected(today); }} hitSlop={12}><Text style={[text.label, { color: t.ink }]}>This week</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => setOffset(offset + 1)} hitSlop={12}><Text style={[text.label, { color: t.info }]}>Next ›</Text></Pressable>
      </View>
      <View style={[styles.week, { backgroundColor: t.surface, borderColor: t.edge, boxShadow: t.shadow }]}>
        {days.map((d) => {
          const key = easternDate(d); const on = key === selected; const has = byDay.has(key);
          return (
            <Pressable key={key} accessibilityRole="button" accessibilityLabel={d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} accessibilityState={{ selected: on }}
              onPress={() => setSelected(key)} hitSlop={hit(50)} style={styles.day}>
              {on ? <LinearGradient colors={navyGradient} style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} /> : null}
              <Text style={[text.small, { fontSize: 11, fontFamily: font.textSemibold, color: on ? "rgba(255,249,241,0.75)" : t.muted }]}>{d.toLocaleDateString("en-US", { weekday: "narrow" })}</Text>
              <Text style={{ fontFamily: font.display, fontSize: 19, color: on ? "#fff9f1" : key === today ? t.accentInk : t.ink }}>{d.getDate()}</Text>
              <View style={[styles.mark, { backgroundColor: has ? (on ? "#fff9f1" : t.accent) : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>

      <SectionTitle title={new Date(`${selected}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} />
      {dayEvents.length === 0 ? (
        <Surface><Text style={[text.body, { color: t.muted }]}><Text style={[text.bodyStrong, { color: t.ink }]}>Nothing scheduled. </Text>Club events, interview slots and meetings appear here.</Text></Surface>
      ) : (
        <Surface padded={false}>{dayEvents.map((e, i) => <EventRow key={e.id} e={e} divider={i > 0} />)}</Surface>
      )}

      {upcoming.length ? (
        <>
          <SectionTitle title="Later" />
          <Surface padded={false}>{upcoming.map((e, i) => <EventRow key={e.id} e={e} divider={i > 0} showDate />)}</Surface>
        </>
      ) : null}
      <Text style={[text.small, { color: t.faint, textAlign: "center", marginTop: space.lg }]}>Times shown in Eastern Time</Text>
    </Screen>
  );
}

function EventRow({ e, divider, showDate }: { e: CalendarEvent; divider?: boolean; showDate?: boolean }) {
  const t = useTheme();
  const start = e.allDay || !e.startTime ? "All day" : clock(e.startTime);
  const end = !e.allDay && e.endTime ? clock(e.endTime) : null;
  return (
    <View style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: t.hairline }]}>
      <View style={styles.time}>
        {showDate ? <Text style={[text.label, { color: t.ink }]}>{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text> : null}
        <Text style={[showDate ? text.small : text.label, { color: showDate ? t.muted : t.ink }]}>{start}</Text>
        {end && !showDate ? <Text style={[text.small, { color: t.faint }]}>{end}</Text> : null}
      </View>
      <View style={[styles.rule, { backgroundColor: isInterview(e.type) ? t.accent : t.navy }]} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={[text.bodyStrong, { color: t.ink }]}>{e.title}</Text>
        <Text numberOfLines={1} style={[text.small, { color: t.muted }]}>{e.club}</Text>
        {e.location ? <View style={styles.meta}><MapPin size={12} color={t.faint} /><Text numberOfLines={1} style={[text.small, { color: t.faint, flex: 1 }]}>{e.location}</Text></View> : null}
      </View>
      {typeLabel[e.type] ? <Pill label={typeLabel[e.type]} tone={isInterview(e.type) ? "accent" : "outline"} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm },
  week: { flexDirection: "row", padding: 4, borderRadius: radius.lg, borderWidth: 1 },
  day: { flex: 1, alignItems: "center", paddingVertical: 7, gap: 1, borderRadius: 14, overflow: "hidden" },
  mark: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  row: { flexDirection: "row", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 12, alignItems: "flex-start" },
  time: { width: 62 },
  rule: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
});
