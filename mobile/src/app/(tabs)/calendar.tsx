import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, SectionList, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, useHeaderInset } from "~/components/header";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, MapPin } from "~/components/icons";
import { FilterChips } from "~/components/inbox/filter-chips";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Chip, type ChipTone, DOCK_CLEARANCE, EmptyState, ErrorState, IconButton, Press, Segmented, SkeletonRows, TARGET } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { addDays, addToCalendar, easternDateKey, easternTime, formatDateKey } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";
import type { AgendaEvent, CalendarView, Me, MyApplicationSummary } from "~/lib/types";

// The web's event types and its "Club meetings" filter (components/views/calendar-view.tsx).
const MEETINGS_FILTER = "club-meetings";
const typeOptions = [{ value: "all", label: "All event types" }, { value: MEETINGS_FILTER, label: "Club meetings" }, ...["Other", "Deadline", "Interview", "Interest Meeting", "Coffee Chat"].map(type => ({ value: type, label: type }))];
const typeTone: Record<string, ChipTone> = { Interview: "interview", Deadline: "warning", "Interest Meeting": "info", "Coffee Chat": "brand", Other: "neutral" };
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOf = (event: AgendaEvent) => new Date(event.startTime);
const endOf = (event: AgendaEvent) => event.endTime ? new Date(event.endTime) : new Date(startOf(event).getTime() + (event.durationMinutes ?? (event.type === "Deadline" ? 0 : 60)) * 60_000);
const timeLabel = (event: AgendaEvent) => (event.allDay ? "All day" : easternTime(event.startTime));

/** The web's agenda groups (lib/student-agenda.ts): Eastern calendar boundaries, not 24-hour spans. */
function agendaGroups(events: AgendaEvent[], now: number, includePast: boolean) {
  const today = easternDateKey(now), tomorrow = addDays(today, 1), weekEnd = addDays(today, 7);
  const groups = new Map<string, AgendaEvent[]>();
  const sorted = events.filter(event => Number.isFinite(startOf(event).getTime())).sort((a, b) => startOf(a).getTime() - startOf(b).getTime());
  for (const event of sorted) {
    const past = endOf(event).getTime() < now;
    if (past && !includePast) continue;
    const label = past ? "Earlier" : event.date === today || (event.allDay && event.date < today) ? "Today" : event.date === tomorrow ? "Tomorrow" : event.date < weekEnd ? "Next 7 days" : "Later";
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }
  return ["Today", "Tomorrow", "Next 7 days", "Later", "Earlier"].filter(label => groups.has(label)).map(label => ({ title: label, data: groups.get(label)! }));
}

function EventRow({ event, first, last, onPress }: { event: AgendaEvent; first: boolean; last: boolean; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const status = event.response === "declined" ? " · Declined" : event.response === "confirmed" ? " · Confirmed" : "";
  return (
    <Press large testID={`calendar-event-${event.id.split("-")[0]}`} onPress={onPress}
      accessibilityLabel={`${event.title}. ${event.type}${status}. ${formatDateKey(event.date, { weekday: "long", month: "long", day: "numeric" })}, ${timeLabel(event)}. ${event.club}${event.location ? `, ${event.location}` : ""}`}
      style={{ flexDirection: "row", gap: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 0.5, borderBottomWidth: last ? 0.5 : 0, borderTopLeftRadius: first ? radius.lg : 0, borderTopRightRadius: first ? radius.lg : 0, borderBottomLeftRadius: last ? radius.lg : 0, borderBottomRightRadius: last ? radius.lg : 0 }}>
      <View style={{ width: 68 }}>
        <Text variant="smallStrong" style={{ fontVariant: ["tabular-nums"] }}>{timeLabel(event)}</Text>
        <Text variant="caption" style={{ marginTop: 2 }}>{formatDateKey(event.date, { month: "short", day: "numeric" })}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <Chip label={event.type} tone={typeTone[event.type] ?? "neutral"} />
          {status ? <Text variant="caption">{status.slice(3)}</Text> : null}
        </View>
        <Text variant="bodyStrong">{event.title}</Text>
        <Text variant="small">{event.club}{event.location ? ` · ${event.location}` : ""}</Text>
      </View>
      <View style={{ marginTop: 6 }}><ChevronRight size={18} color={colors.mutedForeground} /></View>
    </Press>
  );
}

/** A month grid in Eastern calendar dates; days with events carry a dot. */
function MonthGrid({ month, selected, today, eventDays, onSelect }: { month: string; selected: string; today: string; eventDays: Set<string>; onSelect: (key: string) => void }) {
  const { colors, radius } = useTheme();
  const first = `${month}-01`;
  const [year, monthNumber] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(year!, monthNumber! - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year!, monthNumber!, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, index) => addDays(first, index - lead));
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: 8 }}>
      <View style={{ flexDirection: "row" }}>
        {weekdays.map(day => <Text key={day} variant="caption" align="center" style={{ flex: 1, paddingVertical: 6 }} accessibilityElementsHidden importantForAccessibility="no">{day}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, week) => (
        <View key={week} style={{ flexDirection: "row" }}>
          {cells.slice(week * 7, week * 7 + 7).map(key => {
            const inMonth = key.startsWith(month), isSelected = key === selected, isToday = key === today, has = eventDays.has(key);
            return (
              <Pressable key={key} testID={isToday ? "calendar-day-today" : undefined} accessibilityRole="button" accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatDateKey(key, { weekday: "long", month: "long", day: "numeric" })}${has ? ", has events" : ""}${isToday ? ", today" : ""}`}
                onPress={() => { haptics.tick(); onSelect(key); }} style={{ flex: 1, minHeight: TARGET, alignItems: "center", justifyContent: "center", gap: 3 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: isSelected ? colors.primary : "transparent", borderWidth: isToday && !isSelected ? 1 : 0, borderColor: colors.primary }}>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: isSelected || isToday ? fonts.sansSemibold : fonts.sans, fontSize: 15, lineHeight: 20, color: isSelected ? colors.primaryForeground : inMonth ? colors.foreground : colors.mutedForeground, opacity: inMonth ? 1 : 0.55, fontVariant: ["tabular-nums"] }}>{Number(key.slice(8))}</Text>
                </View>
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: has ? colors.schoolAccent : "transparent" }} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export default function CalendarScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const top = useHeaderInset();
  const params = useLocalSearchParams<{ type?: string }>();
  const calendar = useApiQuery<CalendarView>("calendar.view");
  const me = useApiQuery<Me & { applications?: MyApplicationSummary[] }>("me", undefined, { staleTime: 5 * 60_000 });
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [filter, setFilter] = useState("all");
  const [includePast, setIncludePast] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const today = easternDateKey(now);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [calendarNote, setCalendarNote] = useState("");

  // `?type=meeting` (the web's old /clubs/meetings) opens Calendar filtered to club meetings.
  useEffect(() => { if (params.type === "meeting") setFilter(MEETINGS_FILTER); }, [params.type]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  const events = calendar.data?.events ?? [];
  const visible = events.filter(event => filter === "all" || (filter === MEETINGS_FILTER ? event.id.startsWith("meeting-") : event.type === filter));
  const sections = view === "agenda"
    ? agendaGroups(visible, now, includePast)
    : [{ title: formatDateKey(day, { weekday: "long", month: "long", day: "numeric" }), data: visible.filter(event => event.date === day).sort((a, b) => startOf(a).getTime() - startOf(b).getTime()) }];
  const eventDays = new Set(visible.map(event => event.date));
  const selected = events.find(event => event.id === selectedId) ?? null;
  const filtered = filter !== "all";

  function stepMonth(direction: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year!, monthNumber! - 1 + direction, 1)).toISOString().slice(0, 7);
    setMonth(next);
    setDay(next === today.slice(0, 7) ? today : `${next}-01`);
  }
  function openDetail(event: AgendaEvent) {
    setSelectedId(null);
    if (event.id.startsWith("meeting-")) { router.push({ pathname: "/meeting/[id]", params: { id: event.id.slice(8) } } as never); return; }
    // The server names the club of a booked interview; the person's application to that club is the interview screen's subject.
    const applications = (me.data?.applications ?? []).filter(application => application.clubId === event.clubId);
    const application = applications.find(item => item.status === "INTERVIEWING") ?? applications[0];
    if (application) router.push({ pathname: "/interview/[applicationId]", params: { applicationId: application.id } } as never);
  }
  const interviewTarget = (event: AgendaEvent) => event.id.startsWith("booking-") && (me.data?.applications ?? []).some(application => application.clubId === event.clubId);

  const header = (
    <View style={{ gap: space.content - 4, paddingBottom: 4 }}>
      <Text variant="display" accessibilityRole="header">Calendar</Text>
      {events.length > 0 ? (
        <>
          <Segmented label="Calendar view" value={view} onChange={setView} options={[{ value: "agenda", label: "Agenda" }, { value: "month", label: "Month" }]} />
          <FilterChips label="Filter event type" testID="calendar-type" value={filter} onChange={setFilter} options={typeOptions} />
          {view === "agenda" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET }}>
              <Text variant="body" style={{ flex: 1 }}>Include past events</Text>
              <Switch testID="calendar-include-past" accessibilityLabel="Include past events" accessibilityRole="switch" value={includePast} onValueChange={value => { haptics.tick(); setIncludePast(value); }} trackColor={{ true: colors.primary, false: colors.muted }} ios_backgroundColor={colors.muted} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconButton icon={ChevronLeft} label="Previous period" tone="surface" onPress={() => stepMonth(-1)} />
                <Text variant="section" accessibilityRole="header" align="center" style={{ flex: 1 }}>{formatDateKey(`${month}-01`, { month: "long", year: "numeric" })}</Text>
                <IconButton icon={ChevronRight} label="Next period" tone="surface" onPress={() => stepMonth(1)} />
                <Button variant="ghost" size="compact" label="Today" onPress={() => { setMonth(today.slice(0, 7)); setDay(today); }} />
              </View>
              <MonthGrid month={month} selected={day} today={today} eventDays={eventDays} onSelect={key => { setDay(key); if (!key.startsWith(month)) setMonth(key.slice(0, 7)); }} />
            </View>
          )}
        </>
      ) : null}
    </View>
  );

  const empty = calendar.isPending ? <View style={{ paddingTop: 12 }}><SkeletonRows count={4} avatar={false} /></View>
    : calendar.isError ? <ErrorState message={errorMessage(calendar.error)} offline={calendar.error instanceof ApiError && calendar.error.offline} onRetry={() => calendar.refetch()} />
      : <EmptyState icon={CalendarDays} title={filtered ? "No events match these filters" : "Nothing coming up"} body={filtered ? "Your search, type filter or hidden club calendars leave nothing to show." : "You have no interviews or RSVP’d events coming up."}
          action={filtered ? <Button variant="secondary" label="Clear filters" onPress={() => setFilter("all")} /> : <Button variant="secondary" label="Browse events" onPress={() => router.push("/events" as never)} />} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        testID="calendar-screen"
        sections={calendar.isPending || calendar.isError ? [] : sections.filter(section => view === "month" || section.data.length)}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: top + space.control, paddingHorizontal: 16, paddingBottom: insets.bottom + DOCK_CLEARANCE }}
        refreshControl={<RefreshControl refreshing={calendar.isRefetching} onRefresh={() => { calendar.refetch(); me.refetch(); }} tintColor={colors.mutedForeground} progressViewOffset={top} />}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => <Text variant="eyebrow" accessibilityRole="header" style={{ paddingTop: 16, paddingBottom: 8 }}>{section.title}</Text>}
        renderSectionFooter={({ section }) => (view === "month" && !section.data.length ? <Text variant="small" style={{ paddingVertical: 8 }}>{filtered ? "No events on this day match your filters." : "Nothing scheduled."}</Text> : null)}
        renderItem={({ item, index, section }) => <EventRow event={item} first={index === 0} last={index === section.data.length - 1} onPress={() => { setCalendarNote(""); setSelectedId(item.id); }} />}
        ListEmptyComponent={view === "agenda" || calendar.isPending || calendar.isError ? empty : undefined}
      />
      <Header title="Calendar" />

      <Sheet open={!!selected} onClose={() => setSelectedId(null)} title={selected?.title} testID="calendar-event-sheet">
        {selected ? (
          <View style={{ gap: 12 }}>
            <Text variant="small" style={{ marginTop: -6 }}>{selected.club} · {selected.type}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <View style={{ marginTop: 2 }}><CalendarDays size={18} color={colors.foreground} /></View>
              <Text variant="body" style={{ flex: 1 }}>{formatDateKey(selected.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {timeLabel(selected)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <View style={{ marginTop: 2 }}><MapPin size={18} color={colors.foreground} /></View>
              <Text variant="body" style={{ flex: 1 }}>{selected.location ?? (selected.type === "Deadline" ? "Online application" : "Location not announced")}</Text>
            </View>
            <Text variant="small">{selected.description ?? (selected.readOnly ? "Review your scheduled event details below." : selected.type === "Deadline" ? "Open your application to review your progress and next steps before this deadline." : "Review this club event and manage your attendance below.")}</Text>
            {selected.readOnly ? <Text variant="small">Contact the club if you need to change these arrangements.</Text> : null}
            {selected.response ? <Text variant="smallStrong" accessibilityLiveRegion="polite">{selected.response === "declined" ? "Attendance cancelled" : selected.response === "confirmed" ? "Interview confirmed" : "You're going"}</Text> : null}
            {calendarNote ? <Text variant="small" accessibilityRole="alert">{calendarNote}</Text> : null}
            <View style={{ gap: 10, marginTop: 4 }}>
              {selected.id.startsWith("meeting-") ? <Button full size="large" testID="calendar-open-meeting" label="Open agenda and recap" onPress={() => openDetail(selected)} /> : null}
              {interviewTarget(selected) ? <Button full size="large" testID="calendar-open-interview" label="View interview" onPress={() => openDetail(selected)} /> : null}
              <Button full size="large" variant="secondary" icon={CalendarPlus} testID="calendar-add" label="Add to Calendar"
                onPress={async () => {
                  const result = await addToCalendar({ title: selected.title, start: selected.startTime, end: endOf(selected), allDay: selected.allDay, location: selected.location, notes: [selected.club, selected.description].filter(Boolean).join("\n") });
                  setCalendarNote(result === "unavailable" ? "Couldn’t open your calendar. Check that this device has a calendar set up." : "");
                }} />
            </View>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
