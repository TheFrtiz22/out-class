import { useIsFocused, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { Clock, ExternalLink, MapPin } from "~/components/icons";
import { InterviewNotes } from "~/components/leader/interview-notes";
import { type InterviewEntry, entryCandidate, entryLabel, entryStatus, interviewClock, interviewDay, interviewWebHref, openable, shortDay, timeRange } from "~/components/leader/interviews";
import { Text } from "~/components/text";
import { Button, Card, Chip, type ChipTone, Divider, EmptyState, ErrorState, Press, Row, ScreenScroll, SectionHeader, Skeleton, SkeletonRows } from "~/components/ui";
import { ApiError } from "~/lib/api";
import { easternDateKey, formatDateKey } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { useApiQuery } from "~/lib/query";
import { fonts, useTheme } from "~/lib/theme";

const tones: Record<string, ChipTone> = { "Scheduled now": "success", "In progress": "interview", Upcoming: "info", "Review submitted": "neutral", Cancelled: "neutral", "Scheduled time has ended": "warning", "Not booked": "neutral", "Ended unbooked": "neutral" };
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Interview day: the interviewer's own assigned interviews for today in Eastern time, the next
 * interviewee with a countdown from the interview's own start and end, and private notes through
 * the interview room's session. Questions, scores and submitting the review are in the room on the web.
 */
export default function InterviewDay() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const top = useHeaderInset();
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [now, setNow] = useState(Date.now());
  const [openId, setOpenId] = useState<string | null>(null);
  const rooms = useApiQuery<InterviewEntry[]>("leader.interviewRooms", { clubId }, { scope: "leader", staleTime: 0, refetchInterval: focused ? 60_000 : false });
  // The schedule's statuses move by the minute; only the focus card's countdown ticks every second (FocusCard).
  useEffect(() => {
    if (!focused) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [focused]);
  // A refusal (access removed, 4xx) clears the schedule and shows the server's answer, as the voting room does.
  // A dropped or slow connection, an outage or a rate limit keeps the last schedule under "Couldn't refresh".
  const failure = rooms.error instanceof ApiError ? rooms.error : null;
  const reconnecting = rooms.isError && !!failure && (failure.unreachable || failure.status >= 500 || failure.status === 429) && !!rooms.data;
  const data = rooms.isError && !reconnecting ? undefined : rooms.data;

  const rows = data ?? [];
  const day = interviewDay(rows, now);
  const selected = rows.find(row => row.id === openId) ?? null;
  const focus = selected ?? day.next;
  const enter = (row: InterviewEntry) => { haptics.tick(); setOpenId(current => current === row.id ? null : row.id); };

  const line = (row: InterviewEntry, withDay = false) => {
    const candidate = entryCandidate(row), status = entryStatus(row, now), current = focus?.id === row.id;
    const body = (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 52, paddingVertical: 12 }}>
        <View style={{ width: 92 }}>
          <Text variant="smallStrong" style={{ fontVariant: ["tabular-nums"] }} color={current ? colors.brandInk : colors.foreground}>{timeRange(row).replace("–", "–\n")}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2} color={candidate ? colors.foreground : colors.mutedForeground}>{candidate ?? "Open time slot"}</Text>
          <Text variant="small" numberOfLines={2}>{[withDay ? shortDay(row) : "", row.roundName, row.location || row.roomName].filter(Boolean).join(" · ")}</Text>
          <View style={{ marginTop: 4 }}><Chip label={status} tone={tones[status] ?? "neutral"} /></View>
        </View>
      </View>
    );
    return openable(row)
      ? <Press key={row.id} large testID={`interview-row-${row.id}`} onPress={() => enter(row)} accessibilityLabel={`${entryLabel(row, now)} · ${candidate ?? row.roomName}, ${timeRange(row)}, ${status}`} accessibilityState={{ selected: current }}>{body}</Press>
      : <View key={row.id} accessible accessibilityLabel={`${candidate ?? "Open time slot"}, ${timeRange(row)}, ${status}`}>{body}</View>;
  };
  const list = (items: InterviewEntry[], withDay = false) => items.map((row, index) => <View key={row.id}>{index ? <Divider /> : null}{line(row, withDay)}</View>);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="interview-day" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" onRefresh={() => rooms.refetch()}>
        {/* The page's name is in the bar ("Interview day"); the day it covers is the one line above the schedule. */}
        <Text variant="eyebrow">{formatDateKey(easternDateKey(now), { weekday: "long", month: "long", day: "numeric" })} · Eastern Time</Text>
        {rooms.isPending ? (
          <View accessibilityLabel="Loading your interviews…" accessibilityRole="progressbar" style={{ gap: 12 }}>
            <Card style={{ gap: 12 }}><Skeleton width="30%" height={12} /><Skeleton width="68%" height={30} /><Skeleton width="50%" /><Skeleton width="44%" height={44} /></Card>
            <SkeletonRows count={3} avatar={false} />
          </View>
        ) : rooms.isError && !data ? (
          <Card><ErrorState offline={!!failure?.offline} message={failure && (failure.unreachable || (failure.status >= 400 && failure.status < 500)) ? failure.message : "Couldn’t load your interviews. Check your current interview access and retry."} onRetry={() => rooms.refetch()} /></Card>
        ) : !rows.length ? (
          <Card><EmptyState title="My interviews" body="You aren’t assigned to any interviews yet. Club leaders add you when they schedule interviews." /></Card>
        ) : (
          <>
            {/* A failed background refresh keeps the schedule (and an open notes editor) on screen. */}
            {rooms.isError ? <Text variant="small" accessibilityRole="alert" testID="interview-refresh-failed">Couldn’t refresh · showing your last schedule</Text> : null}
            {focus ? <FocusCard key={focus.id} row={focus} live={focused} next={focus.id === day.next?.id} notes={openId === focus.id} onEnter={() => enter(focus)} /> : (
              <Card testID="interview-next-none"><Text variant="small">Nothing here right now. Past time slots nobody booked are hidden.</Text></Card>
            )}

            <View style={{ gap: 10 }}>
              <SectionHeader title="Today" action={<Text variant="small">{day.booked.length ? plural(day.booked.length, "interview") : "No bookings yet"}</Text>} />
              {day.booked.length ? <Card padded={false} style={{ paddingHorizontal: 16 }} testID="interview-today">{list(day.booked)}</Card> : null}
              {day.openTimes ? <Text variant="small">{day.booked.length ? `${plural(day.openTimes, "more open time")} nobody has booked yet` : `${plural(day.openTimes, "open time")}, none booked yet`}</Text> : null}
            </View>

            {day.needsNotes.filter(row => !day.booked.includes(row)).length ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title={`Needs notes · ${day.needsNotes.filter(row => !day.booked.includes(row)).length}`} />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>{list(day.needsNotes.filter(row => !day.booked.includes(row)), true)}</Card>
              </View>
            ) : null}

            {day.later.length ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Up next" />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>{list(day.later, true)}</Card>
              </View>
            ) : null}

            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="My interviews" detail="Open on web" onPress={() => { openOnWeb(`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=interviews&interviewTab=rooms`); }} />
            </Card>
          </>
        )}
      </ScreenScroll>
      <Header title="Interview day" back />
    </View>
  );
}

/** The interviewee in focus: name, time and place, the countdown, and (once entered) the private notes. */
function FocusCard({ row, live, next, notes, onEnter }: { row: InterviewEntry; live: boolean; next: boolean; notes: boolean; onEnter: () => void }) {
  const { colors } = useTheme();
  // The countdown's own 1 s clock: only this card re-renders every second, never the whole schedule.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [live]);
  const timer = interviewClock(row, now);
  const low = timer.phase === "during" && +new Date(row.endTime) - now <= 60_000;
  const candidate = entryCandidate(row);
  return (
    <Card testID="interview-next" style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text variant="eyebrow">{next ? "Next interviewee" : entryStatus(row, now)}</Text>
        <Text variant="display" accessibilityRole="header" testID="interview-next-name" style={{ fontSize: 28, lineHeight: 34 }}>{candidate ?? row.roomName}</Text>
        <Text variant="small">{row.roundName}{row.interviewers.length ? ` · With ${row.interviewers.join(", ")}` : ""}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Clock size={18} color={colors.mutedForeground} /><Text variant="body">{shortDay(row)} · {timeRange(row)}</Text></View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><MapPin size={18} color={colors.mutedForeground} /><Text variant="body" style={{ flex: 1 }}>{row.location || row.roomName}</Text></View>
      </View>
      <View accessible accessibilityRole="timer" accessibilityLabel={`${timer.label} ${timer.phase === "after" ? "" : timer.digits}`} style={{ backgroundColor: colors.contentSoft, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 2 }}>
        <Text variant="caption">{timer.label}</Text>
        <Text testID="interview-timer" maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.sansSemibold, fontSize: 44, lineHeight: 50, fontVariant: ["tabular-nums"], color: low || timer.phase === "after" ? colors.destructive : colors.foreground }}>{timer.digits}</Text>
      </View>
      {openable(row) ? (
        notes ? (
          <>
            <Divider />
            <InterviewNotes key={row.id} entry={row} />
          </>
        ) : <Button full size="large" testID="interview-enter" label={entryLabel(row, now)} onPress={onEnter} />
      ) : null}
      <Divider />
      <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Open the interview room" detail="Open on web" onPress={() => { openOnWeb(interviewWebHref(row)); }} />
    </Card>
  );
}
