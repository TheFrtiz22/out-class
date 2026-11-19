import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ChevronRight, ExternalLink } from "~/components/icons";
import { Text } from "~/components/text";
import { Card, Chip, type ChipTone, Divider, ErrorState, Press, Row, ScreenScroll, SectionHeader, SkeletonRows } from "~/components/ui";
import { type RoomGroup, type RoomListItem, roomGroup, roomListStatus } from "~/components/voting/room";
import { ApiError } from "~/lib/api";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";

// components/live-voting/room-landing.tsx: one section per group, so a session appears in exactly one list.
const headings: Record<RoomGroup, string> = { draft: "Not yet scheduled", scheduled: "Scheduled sessions", active: "Active sessions", past: "Past sessions" };
const empty: Record<RoomGroup, string> = { draft: "", scheduled: "No scheduled sessions.", active: "No active sessions.", past: "No past sessions." };
const tones: Record<string, ChipTone> = { Open: "success", Paused: "warning", Scheduled: "info", Draft: "neutral", Cancelled: "neutral", "Closed · Finalized": "neutral", "Closed · Provisional": "brand", Closed: "neutral" };
function dateTime(value: string, timeZone?: string) {
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };
  // A zone this phone's Intl doesn't know falls back to the phone's own instead of throwing.
  try { return new Date(value).toLocaleString("en-US", { ...options, ...(timeZone ? { timeZone } : {}) }); } catch { return new Date(value).toLocaleString("en-US", options); }
}
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** The club's voting sessions, grouped and labelled as the web's Voting room lists them. Setup stays on the web. */
export default function VotingRooms() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const top = useHeaderInset();
  const router = useRouter();
  const { colors } = useTheme();
  const [pulling, setPulling] = useState(false);
  const rooms = useApiQuery<RoomListItem[]>("voting.rooms", { clubId }, { scope: "leader", staleTime: 0 });

  const action = (room: RoomListItem, group: RoomGroup) => group === "past" ? (room.meeting?.status === "CANCELLED" && room.state !== "COMPLETED" ? "View details" : "View summary")
    : group !== "active" ? "View details" : room.view === "leader" ? "Resume" : room.view === "member" ? "Join" : "Open session";
  const open = (room: RoomListItem) => {
    // Board (non-live) sessions have a read-only history page on the web and no native room.
    if (room.mode !== "LIVE") { openOnWeb(`/voting/rooms/${encodeURIComponent(room.id)}/history?clubId=${encodeURIComponent(clubId)}`); return; }
    router.push({ pathname: "/voting/[sessionId]", params: { sessionId: room.id, clubId, ...(room.view === "member" ? { view: "member" } : {}) } } as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="voting-rooms" refreshing={pulling} onRefresh={() => { setPulling(true); rooms.refetch().finally(() => setPulling(false)); }}>
        <Text variant="title" accessibilityRole="header">Voting room</Text>
        {rooms.isPending ? <SkeletonRows count={3} avatar={false} /> : rooms.isError ? (
          <Card><ErrorState offline={rooms.error instanceof ApiError && rooms.error.offline} message={rooms.error instanceof ApiError && rooms.error.offline ? rooms.error.message : "Voting sessions could not be loaded. Check your current access and retry."} onRetry={() => rooms.refetch()} /></Card>
        ) : (["draft", "scheduled", "active", "past"] as const).map(kind => {
          const group = rooms.data.filter(room => roomGroup(room) === kind);
          if (kind === "draft" && !group.length) return null;
          return (
            <View key={kind} style={{ gap: 10 }}>
              <SectionHeader title={headings[kind]} />
              {!group.length ? <Text variant="small">{empty[kind]}</Text> : group.map(room => {
                const status = roomListStatus(room), name = room.meeting?.name ?? room.roundName;
                return (
                  <Press key={room.id} large testID={`voting-room-${room.id}`} onPress={() => open(room)} accessibilityLabel={`${action(room, kind)} · ${name}, ${status}`}>
                    <Card style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="card" numberOfLines={2}>{name}</Text>
                          {room.meeting?.plannedAt ? <Text variant="small" color={colors.foreground}>{dateTime(room.meeting.plannedAt, room.meeting.timeZone)}{room.meeting.timeZone ? ` · ${room.meeting.timeZone}` : ""}</Text> : null}
                          <Text variant="small" numberOfLines={2}>{room.cycleName} · {room.roundName} · {plural(room.applicantCount, "applicant")}</Text>
                        </View>
                        <Chip label={status} tone={tones[status] ?? "neutral"} />
                      </View>
                      <Divider />
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text variant="caption" style={{ flex: 1 }}>Last activity {dateTime(room.updatedAt ?? room.createdAt)}</Text>
                        <Text variant="smallStrong">{action(room, kind)}</Text>
                        <ChevronRight size={16} color={colors.mutedForeground} />
                      </View>
                    </Card>
                  </Press>
                );
              })}
            </View>
          );
        })}
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Start voting session" detail="Open on web" onPress={() => { openOnWeb(`/voting/rooms/new?clubId=${encodeURIComponent(clubId)}`); }} />
        </Card>
      </ScreenScroll>
      <Header title="Live voting" back />
    </View>
  );
}
