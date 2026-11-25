import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { CalendarPlus, ChevronRight, MapPin } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Card, Chip, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET, Toggle } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { addToCalendar, eastern, easternTime } from "~/lib/eastern";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";

/** One published panel assignment (utils/official-panel-schedule.ts `OwnPanelAssignment`). */
export type PanelAssignment = {
  id: string; clubId: string; clubName: string; roundId: string; roundName: string; roomName: string; location: string; timezone: string;
  startTime: string; endTime: string; buffer: number; version: number; availabilityOverridden?: boolean;
};

/** Room and place without repeating a place that matches the room name or is blank. */
const roomPlace = (panel: Pick<PanelAssignment, "roomName" | "location">) => {
  const room = panel.roomName.trim(), place = (panel.location ?? "").trim();
  return !place || place.toLowerCase() === room.toLowerCase() ? room : room ? `${room} · ${place}` : place;
};

const longDate = eastern({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
const caption = (panel: PanelAssignment) => ["Eastern Time", panel.buffer ? `${panel.buffer} minute buffer` : "", "Official assignment", panel.availabilityOverridden ? "Availability overridden" : "", panel.version ? `Published version ${panel.version}` : ""].filter(Boolean).join(" · ");

function PanelCard({ panel }: { panel: PanelAssignment }) {
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");
  const past = +new Date(panel.endTime) <= Date.now();
  return (
    <Card style={{ gap: 10, opacity: past ? 0.75 : 1 }} testID={`interview-panel-${panel.id}`}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Text variant="section" accessibilityRole="header" style={{ flex: 1 }}>{panel.clubName} · {panel.roundName}</Text>
        <Chip label={past ? "Past" : "Published"} tone={past ? "neutral" : "success"} />
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ marginTop: 2 }}><MapPin size={16} color={colors.foreground} /></View>
        <Text variant="bodyStrong" style={{ flex: 1 }} selectable>{roomPlace(panel)}</Text>
      </View>
      <Text variant="body">{longDate(panel.startTime)} · {easternTime(panel.startTime)}–{easternTime(panel.endTime)}</Text>
      <Text variant="caption">{caption(panel)}</Text>
      <Button variant="secondary" icon={CalendarPlus} testID={`interview-panel-${panel.id}-calendar`} label="Add to Calendar" loading={adding}
        onPress={async () => {
          if (adding) return;
          setAdding(true); setNote("");
          try {
            const result = await addToCalendar({ title: `${panel.clubName} interview panel`, start: panel.startTime, end: panel.endTime, location: panel.location, notes: `${panel.roundName} · ${panel.roomName}` });
            setNote(result === "unavailable" ? "Couldn’t open your calendar. Check that this device has a calendar set up." : result === "saved" ? "Added to your calendar." : "");
          } finally { setAdding(false); }
        }} />
      {note ? <Text variant="small" accessibilityRole="alert">{note}</Text> : null}
    </Card>
  );
}

/**
 * Settings → Interview schedule (web: app/(workspace)/settings/interviews, components/interviews/my-panel-schedule.tsx):
 * the interview panels a club published for you, across all your clubs.
 */
export default function InterviewScheduleSettings() {
  const top = useHeaderInset();
  const router = useRouter();
  const { colors } = useTheme();
  const query = useApiQuery<PanelAssignment[]>("interviews.panels");
  const [past, setPast] = useState(false);
  const panels = [...(query.data ?? [])].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));
  const visible = panels.filter(panel => past || +new Date(panel.endTime) > Date.now());

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="settings-interviews-screen" onRefresh={() => query.refetch()}>
        <Text variant="small">Your approved panel assignments across all your clubs.</Text>
        {query.data ? (
          <>
            {query.isError ? <Card tone="soft"><ErrorState message="Could not load your latest schedule." onRetry={() => { void query.refetch(); }} /></Card> : null}
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: TARGET + 12 }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>Include past interviews</Text>
              <Toggle testID="interviews-include-past" value={past} onValueChange={setPast} accessibilityLabel="Include past interviews" />
            </Card>
            {visible.length ? visible.map(panel => <PanelCard key={panel.id} panel={panel} />) : (
              <Card><EmptyState icon={CalendarPlus} title={past ? "No official panel assignments" : "No upcoming panels"} body="You have no upcoming official panel assignments. Draft suggestions appear here after the owner publishes them." /></Card>
            )}
          </>
        ) : query.isError ? (
          <Card><ErrorState message={errorMessage(query.error, "Couldn’t load your interview schedule.")} offline={query.error instanceof ApiError && query.error.unreachable} onRetry={() => { void query.refetch(); }} /></Card>
        ) : (
          <Card accessibilityLabel="Loading your interview schedule…" accessibilityRole="progressbar" style={{ gap: 12 }}>
            <Skeleton width="60%" height={20} /><Skeleton width="80%" /><Skeleton width="70%" /><Skeleton width="40%" height={TARGET} radius={22} />
          </Card>
        )}
        <Press testID="interviews-update-availability" accessibilityRole="link" onPress={() => router.push("/settings/availability" as never)}
          style={{ minHeight: TARGET + 4, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
          <Text variant="bodyStrong" color={colors.brandInk}>Update My Availability</Text>
          <ChevronRight size={18} color={colors.brandInk} />
        </Press>
      </ScreenScroll>
      <Header title="Interview schedule" back />
    </View>
  );
}
