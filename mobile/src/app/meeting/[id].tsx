import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AlumniBanner, useIsAlumni } from "~/components/alumni-banner";
import { Header, useHeaderInset } from "~/components/header";
import { ArrowUpRight, CalendarDays, CalendarPlus, MapPin, QrCode } from "~/components/icons";
import { Text } from "~/components/text";
import { Button, Card, Divider, EmptyState, ErrorState, Press, ScreenScroll, Skeleton, TARGET } from "~/components/ui";
import { ApiError, errorMessage } from "~/lib/api";
import { addToCalendar, easternDateTime } from "~/lib/eastern";
import { openExternal } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";
import type { Meeting, MeetingResource } from "~/lib/types";

/** Resources a club attached (lib/meetings.ts `resourceSchema`); anything else is ignored. */
function resources(value: unknown): MeetingResource[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is MeetingResource => !!item && typeof item === "object" && typeof (item as MeetingResource).label === "string" && typeof (item as MeetingResource).url === "string" && /^https?:\/\//i.test((item as MeetingResource).url));
}

/** A meeting as the web's /meetings/[id] shows it: when, where, description, agenda, recap, resources. */
export default function MeetingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const top = useHeaderInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const meeting = useApiQuery<Meeting>("meetings.meeting", { meetingId: id }, { enabled: valid });
  const alumni = useIsAlumni();
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const data = meeting.data;
  const links = resources(data?.resources);
  const upcoming = data ? +new Date(data.endDate || data.date) >= Date.now() : false;

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} refreshing={meeting.isRefetching} onRefresh={() => meeting.refetch()} testID="meeting-screen">
        {!valid ? (
          <Card><EmptyState icon={CalendarDays} title="Meeting unavailable" body="This link doesn’t point to a meeting. Check the link or ask the club for a new one." /></Card>
        ) : meeting.isPending ? (
          <>
            <View style={{ gap: 10 }}><Skeleton width="45%" /><Skeleton width="80%" height={30} /><Skeleton width="70%" /></View>
            <Card style={{ gap: 10 }}><Skeleton width="30%" height={18} /><Skeleton /><Skeleton width="85%" /></Card>
            <Card style={{ gap: 10 }}><Skeleton width="30%" height={18} /><Skeleton /><Skeleton width="60%" /></Card>
          </>
        ) : meeting.isError ? (
          <ErrorState message={errorMessage(meeting.error)} offline={meeting.error instanceof ApiError && meeting.error.offline} onRetry={() => meeting.refetch()} />
        ) : data ? (
          <>
            <View style={{ gap: 8 }}>
              <Text variant="small">{data.club.name} · {data.audience === "MEMBERS" ? "Member meeting" : "Recruitment / Interest"}</Text>
              <Text variant="display" accessibilityRole="header">{data.title}</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View style={{ marginTop: 2 }}><CalendarDays size={18} color={colors.foreground} /></View>
                <Text variant="bodyStrong" style={{ flex: 1 }}>{easternDateTime(data.date)}{data.endDate ? ` – ${easternDateTime(data.endDate)}` : ""}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                <View style={{ marginTop: 2 }}><MapPin size={18} color={colors.foreground} /></View>
                <Text variant="body" style={{ flex: 1 }}>{data.location}</Text>
              </View>
              {data.description ? <Text variant="body" selectable>{data.description}</Text> : null}
            </View>

            <View style={{ gap: 10 }}>
              <Button full variant="secondary" icon={CalendarPlus} testID="meeting-add-calendar" label="Add to Calendar" loading={adding}
                onPress={async () => {
                  if (adding) return;
                  setAdding(true); setNote("");
                  try {
                    const result = await addToCalendar({ title: data.title, start: data.date, end: data.endDate, location: data.location, notes: [data.club.name, data.description].filter(Boolean).join("\n") });
                    setNote(result === "unavailable" ? "Couldn’t open your calendar. Check that this device has a calendar set up." : result === "saved" ? "Added to your calendar." : "");
                  } finally { setAdding(false); }
                }} />
              {note ? <Text variant="small" color={colors.foreground} accessibilityRole="alert">{note}</Text> : null}
            </View>

            {(["agenda", "recap"] as const).map(key => (
              <Card key={key} style={{ gap: 8 }} testID={`meeting-${key}`}>
                <Text variant="section" accessibilityRole="header">{key === "agenda" ? "Agenda" : "Recap"}</Text>
                <Text variant="body" selectable color={data[key]?.trim() ? colors.foreground : colors.mutedForeground}>{data[key]?.trim() ? data[key] : `No ${key} has been added yet.`}</Text>
              </Card>
            ))}

            <Card style={{ gap: 4 }} testID="meeting-resources">
              <Text variant="section" accessibilityRole="header">Resources</Text>
              {links.length ? links.map((resource, index) => (
                <View key={resource.id ?? index}>
                  {index ? <Divider /> : null}
                  <Press large accessibilityRole="link" accessibilityLabel={`${resource.label}, ${String(resource.kind).toLowerCase()}`} accessibilityHint="Opens in the browser" onPress={() => { openExternal(resource.url); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: TARGET + 4 }}>
                    <Text variant="body" style={{ flex: 1 }}>{resource.label} · {String(resource.kind).toLowerCase()}</Text>
                    <ArrowUpRight size={18} color={colors.mutedForeground} />
                  </Press>
                </View>
              )) : <Text variant="small" style={{ marginTop: 4 }}>No resources added yet.</Text>}
            </Card>

            {/* Attendance is recorded by scanning the leader's current code; the server decides whether it counts. */}
            {alumni ? <AlumniBanner action="checkIn" /> : upcoming ? (
              <Card style={{ gap: 10 }} testID="meeting-check-in">
                <Text variant="section" accessibilityRole="header">Meeting check-in</Text>
                <Text variant="small">Scan the QR displayed by the meeting leader. Codes expire quickly to protect attendance.</Text>
                <Button icon={QrCode} testID="meeting-scan" label="Scan a code" onPress={() => router.push("/scan")} />
              </Card>
            ) : null}
          </>
        ) : null}
      </ScreenScroll>
      <Header title="Meeting" back />
    </View>
  );
}
