import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Header, useHeaderInset } from "~/components/header";
import { ExternalLink } from "~/components/icons";
import { ShareSheet } from "~/components/share-sheet";
import { useConfirm } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, ErrorState, Row, ScreenScroll, Segmented, Skeleton } from "~/components/ui";
import { ApplicantSlide } from "~/components/voting/applicant-slide";
import { BallotPanel, ClosedTotals } from "~/components/voting/ballot";
import { HostControls } from "~/components/voting/host-controls";
import {
  type JoinInfo, POLL_MS, ROOM_UNAVAILABLE, type RoomEntry, type RoomSnapshot, type SummaryLabels, applicantLabel, applicantPosition, currentEntry, currentPass, nextLabel,
  roundLine, savedOutcomeLabels, useLive, voteStatusLabel, webRoomPath,
} from "~/components/voting/room";
import { ApiError, api } from "~/lib/api";
import { EASTERN } from "~/lib/eastern";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { shouldRetry, useApiQuery } from "~/lib/query";
import { useTheme } from "~/lib/theme";

type Mode = "leader" | "member";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// One retry at most, and only of what the app retries at all: a refusal clears the room at once.
const once = (count: number, error: unknown) => count < 1 && shouldRetry(count, error);
const plannedTime = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

/**
 * The live voting room (the web's /voting/rooms/<id>): a voter's ballot and, for the session's
 * leaders, the host controls. Everything shown is the server's snapshot for this viewer, re-read
 * every 5 s while the screen is in front; it is held in memory only (query scope "leader").
 */
export default function VotingRoomScreen() {
  const params = useLocalSearchParams<{ sessionId: string; clubId?: string; view?: string }>();
  const { sessionId, clubId } = params;
  const valid = !!clubId && UUID.test(clubId) && !!sessionId && UUID.test(sessionId);
  const top = useHeaderInset();
  const { colors, radius } = useTheme();
  const live = useLive();
  const { confirm, sheet } = useConfirm();
  const scope = { clubId, sessionId };
  const [chosen, setChosen] = useState<Mode | null>(params.view === "member" ? "member" : null);
  const [joinQr, setJoinQr] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [pulling, setPulling] = useState(false);

  const roomQuery = useApiQuery<RoomSnapshot>("voting.room", scope, { scope: "leader", enabled: valid, staleTime: 0, gcTime: 60_000, refetchInterval: live ? POLL_MS : false, retry: once });
  // A refused read clears what was on screen, as the web's subscription does. A dropped or slow connection,
  // an outage or a rate limit keeps the last snapshot under a reconnecting notice (every ballot and command is
  // checked again by the server), so a blip on the room's Wi-Fi doesn't wipe a leader's half-typed reason.
  const failure = roomQuery.error instanceof ApiError ? roomQuery.error : null;
  const reconnecting = roomQuery.isError && !!failure && (failure.unreachable || failure.status >= 500 || failure.status === 429) && !!roomQuery.data;
  const room = roomQuery.isError && !reconnecting ? undefined : roomQuery.data;
  const leader = !!room?.permissions.leader;
  const mode: Mode | "present" | null = room ? (leader ? chosen ?? "leader" : room.permissions.voter ? "member" : "present") : roomQuery.isError ? "member" : null;
  const refresh = () => roomQuery.refetch();

  // The voter's way in (MemberJoin): eligibility and the join state are the server's, checked every 5 s until joined.
  const [joinedHere, setJoined] = useState(false);
  const joined = joinedHere || !!room?.joinedSelf;
  const join = useApiQuery<JoinInfo>("voting.joinInfo", scope, { scope: "leader", enabled: valid && mode === "member" && !joined, staleTime: 0, gcTime: 0, refetchInterval: live ? POLL_MS : false, retry: once });
  const joinStatus = join.data?.status;
  useEffect(() => { if (joinStatus === "JOINED" || joinStatus === "ENDED") setJoined(true); }, [joinStatus]);
  const joinNow = useMutation({
    mutationFn: () => api.post<{ joined: boolean }>("voting.join", scope),
    onMutate: () => setJoinError(""),
    onSuccess: async () => { haptics.confirm(); await Promise.all([join.refetch(), roomQuery.refetch()]); },
    onError: () => { haptics.error(); setJoinError("Couldn't join. Your eligibility will be checked again on retry."); },
  });

  const labels = useApiQuery<SummaryLabels>("voting.summary", scope, { scope: "leader", enabled: valid && leader, staleTime: 60_000, retry: false }).data?.labels;

  // A tick when the room moves to another applicant, a new pass or its end (never on the first snapshot).
  const place = room ? `${room.status}:${room.passNumber}:${room.currentApplicantId}` : null;
  const lastPlace = useRef<string | null>(null);
  useEffect(() => {
    if (!place) return;
    if (lastPlace.current && lastPlace.current !== place) haptics.tick();
    lastPlace.current = place;
  }, [place]);

  const entry = room ? currentEntry(room) : undefined;
  const pass = room ? currentPass(room) : undefined;
  const title = mode === "leader" ? "Lead voting" : mode === "member" && !joined ? "Join live voting" : mode === "member" ? "Your vote" : "Live voting";
  const gate = mode === "member" && !joined;

  const stage = (current: RoomSnapshot, current_entry: RoomEntry | undefined) => (
    <>
      {current.status === "DRAFT" ? (
        <Card testID="voting-waiting" accessibilityLabel="Waiting room" style={{ gap: 4 }}>
          <Text variant="section" accessibilityRole="header">Ready when your leader is</Text>
          <Text variant="small">Voting has not started.</Text>
        </Card>
      ) : null}
      {current.status === "OPEN" && current.currentApplicantId ? (
        <ApplicantSlide room={current} applicationId={current.currentApplicantId} position={applicantPosition(current)} live={live} onStale={refresh}
          result={current_entry?.ballotState === "CONFIRMED" && current_entry.outcome !== "UNREVIEWED" && !current.ownApplicant ? (current_entry.outcome === "HOLD" ? "Held for another vote" : current_entry.withoutVote ? `${savedOutcomeLabels[current_entry.outcome]} without a vote` : savedOutcomeLabels[current_entry.outcome]) : null} />
      ) : null}
      {current.status === "PAUSED" || current.status === "COMPLETED" ? <Intermission room={current} leader={mode === "leader"} /> : null}
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll top={top} testID="voting-room" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" refreshing={pulling} onRefresh={() => { setPulling(true); Promise.all([roomQuery.refetch(), gate ? join.refetch() : null]).finally(() => setPulling(false)); }}>
        {valid && leader && room?.permissions.voter ? (
          <Segmented label="Voting view" value={mode === "member" ? "member" : "leader"} onChange={value => setChosen(value)} options={[{ value: "leader", label: "Lead voting" }, { value: "member", label: "Your vote" }]} />
        ) : null}
        {reconnecting ? (
          <Card tone="warm" accessibilityRole="alert" testID="voting-reconnecting" style={{ gap: 2 }}>
            <Text variant="smallStrong">Reconnecting…</Text>
            <Text variant="small">{failure?.offline ? "You're offline. " : ""}This may be out of date. Your last vote or command may already be saved.</Text>
          </Card>
        ) : null}
        {!valid ? <Card><ErrorState message="This session link is expired or unavailable." /></Card>
          : gate ? (
            <Card testID="voting-join" style={{ gap: 12 }}>
              {join.isError && !join.data ? (
                <View accessibilityRole="alert" style={{ gap: 10 }}>
                  <Text variant="body">{join.error instanceof ApiError && join.error.unreachable ? join.error.message : "Couldn't check this session. Retry when connected."}</Text>
                  <Button label="Retry" variant="secondary" onPress={() => join.refetch()} />
                </View>
              ) : !join.data ? (
                <View accessibilityLabel="Checking session and membership…" accessibilityRole="progressbar" style={{ gap: 10 }}><Skeleton width="60%" height={18} /><Skeleton width="90%" /><Skeleton width="40%" height={40} radius={20} /></View>
              ) : join.data.status === "READY" ? (
                <>
                  {join.data.meeting ? (
                    <View accessibilityLabel="Session details" style={{ gap: 2 }}>
                      <Text variant="section" accessibilityRole="header">{join.data.meeting.name}</Text>
                      {join.data.meeting.plannedAt ? <Text variant="small">{`Scheduled start · ${plannedTime(join.data.meeting.plannedAt)} Eastern Time`}</Text> : null}
                      {join.data.meeting.location ? <Text variant="small">{join.data.meeting.location}</Text> : null}
                    </View>
                  ) : null}
                  <Text variant="body">You can vote. Join and wait for the leader to start.</Text>
                  {joinError ? <Text variant="small" color={colors.destructive} accessibilityRole="alert">{joinError}</Text> : null}
                  <Button full size="large" testID="voting-join-button" label={joinNow.isPending ? "Joining…" : "Join session"} loading={joinNow.isPending} onPress={() => joinNow.mutate()} />
                </>
              ) : join.data.status === "DENIED" ? <Text variant="body" accessibilityRole="alert" testID="voting-join-denied">You can’t vote in this session. Ask a club leader if you think that’s wrong.</Text>
                : join.data.status === "EXPIRED" ? <Text variant="body" testID="voting-join-expired">This session link is expired or unavailable.</Text>
                : <View style={{ gap: 10 }}><Skeleton width="60%" height={18} /><Skeleton width="90%" /></View>}
            </Card>
          ) : !room ? (
            roomQuery.isError ? (
              <Card><ErrorState offline={!!failure?.offline} message={failure?.unreachable ? failure.message : ROOM_UNAVAILABLE} onRetry={() => roomQuery.refetch()} /></Card>
            ) : (
              <View accessibilityLabel="Restoring voting session…" accessibilityRole="progressbar" style={{ gap: 12 }}>
                <Skeleton width="50%" height={12} />
                <Card style={{ gap: 10 }}><Skeleton width="40%" height={16} /><Skeleton width="70%" /></Card>
                <Card style={{ gap: 12 }}><Skeleton width="34%" height={12} /><Skeleton width="70%" height={30} /><Skeleton width="100%" height={48} /></Card>
                <Card style={{ gap: 10 }}><Skeleton width="100%" height={52} radius={26} /></Card>
              </View>
            )
          ) : (
            <>
              {room.meeting?.name || roundLine(room) ? (
                <View style={{ gap: 2 }}>
                  {roundLine(room) ? <Text variant="eyebrow" numberOfLines={2}>{roundLine(room)}</Text> : null}
                  {room.meeting?.name ? <Text variant="title" accessibilityRole="header" numberOfLines={3}>{room.meeting.name}</Text> : null}
                </View>
              ) : null}
              {room.meeting?.status === "CANCELLED" ? <Card tone="soft"><Text variant="small">This session was cancelled. Saved votes and outcomes are kept.</Text></Card> : null}

              <Card testID="voting-status" accessibilityLabel="Session progress" style={{ gap: 8 }}>
                <Text variant="card" testID="voting-status-label">{mode === "leader" ? voteStatusLabel(room, entry) : room.status === "COMPLETED" ? "Session ended" : entry?.ballotState === "OPEN" ? "Voting open" : entry?.ballotState === "CLOSED" || entry?.ballotState === "CONFIRMED" ? "Voting closed" : "Waiting for voting"}</Text>
                {room.status === "OPEN" && entry?.ballotState === "OPEN" ? (
                  <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: "hidden" }}>
                    <View style={{ height: 6, borderRadius: radius.full, backgroundColor: colors.brandInk, width: `${room.participation.eligible ? Math.min(100, room.participation.voted * 100 / room.participation.eligible) : 0}%` }} />
                  </View>
                ) : null}
                <Text variant="body" testID="voting-participation" accessibilityLiveRegion="polite">{room.participation.voted} of {room.participation.eligible} in the room voted</Text>
                {mode === "leader" ? (applicantPosition(room) ? <Text variant="small">{applicantPosition(room)}</Text> : null)
                  : <Text variant="small">Reviewed {pass?.candidates.filter(candidate => candidate.ballotState === "CONFIRMED").length ?? 0} of {pass?.candidates.length ?? room.outcomes.length} this pass · Pass {room.passNumber || 1}</Text>}
              </Card>

              {stage(room, entry)}

              {mode === "leader" ? (
                <>
                  {room.meeting?.status !== "CANCELLED" ? <HostControls room={room} entry={entry} labels={labels} next={nextLabel(room, labels)} refresh={refresh} confirm={confirm} /> : null}
                  <InRoom room={room} onShowQr={room.status !== "COMPLETED" ? () => setJoinQr(true) : undefined} />
                  <Queue room={room} labels={labels} />
                  <Card padded={false} style={{ paddingHorizontal: 16 }}>
                    <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Prepare slides" detail="Open on web" onPress={() => { openOnWeb(`/voting/rooms/${encodeURIComponent(room.id)}/prepare?clubId=${encodeURIComponent(room.clubId)}`); }} />
                    <Divider />
                    <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Show on projector" detail="Open on web" onPress={() => { openOnWeb(webRoomPath(room.clubId, room.id, "present")); }} />
                  </Card>
                </>
              ) : (
                <>
                  {room.status === "COMPLETED" ? <Text variant="small">Session ended. Unresolved applicants and saved votes are preserved. No applicant notifications were sent.</Text> : null}
                  {mode === "member" ? <BallotPanel room={room} entry={entry} refresh={refresh} /> : null}
                  {!room.ownApplicant ? <ClosedTotals room={room} entry={entry} /> : null}
                </>
              )}
            </>
          )}
      </ScreenScroll>
      <Header title={title} back />
      {sheet}
      {valid ? <ShareSheet open={joinQr} onClose={() => setJoinQr(false)} target={{ path: webRoomPath(clubId!, sessionId, "member"), title: "Join this voting session", text: "Join this voting session", qrDescription: "Sign in with your club account.", shortLink: true }} /> : null}
    </View>
  );
}

/** What the stage shows when no applicant is current: between passes and once voting has ended. */
function Intermission({ room, leader }: { room: RoomSnapshot; leader: boolean }) {
  // Counts are the session's decision totals as the server sends them.
  const { pass, hold, notPass, unreviewed } = room.targetSummary.decisions;
  const counts = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
      {([["Passed", pass], ["Held", hold], ["Not passed", notPass], ["Unreviewed", unreviewed]] as const).map(([name, count]) => (
        <View key={name} accessible accessibilityLabel={`${name} ${count}`} style={{ minWidth: 64 }}><Text variant="metric" style={{ fontSize: 24, lineHeight: 30 }}>{count}</Text><Text variant="caption">{name}</Text></View>
      ))}
    </View>
  );
  if (room.status === "COMPLETED") {
    return (
      <Card testID="voting-intermission" accessibilityLabel={leader ? "Voting result" : "Voting summary"} style={{ gap: 8 }}>
        <Text variant="eyebrow">Voting ended</Text>
        <Text variant="title" accessibilityRole="header">{pass ? `${pass} passed` : "No applicants passed"}</Text>
        {counts}
      </Card>
    );
  }
  return (
    <Card testID="voting-intermission" style={{ gap: 8 }}>
      <Text variant="eyebrow">Pass {room.passNumber} complete</Text>
      <Text variant="title" accessibilityRole="header">{hold ? "Review held applicants" : "Review complete"}</Text>
      <Text variant="small">{hold ? `${hold} held applicant${hold === 1 ? "" : "s"} remaining` : "No held applicants remain."}</Text>
      {counts}
    </Card>
  );
}

/** Who has joined the session (leaders only): the count, then the names, collapsed past a screenful. */
function InRoom({ room, onShowQr }: { room: RoomSnapshot; onShowQr?: () => void }) {
  const [all, setAll] = useState(false);
  const people = [...room.joinedParticipants].sort((a, b) => Number(b.joined) - Number(a.joined));
  const joined = people.filter(person => person.joined).length;
  const shown = all ? people : people.slice(0, 8);
  return (
    <Card testID="voting-in-room" style={{ gap: 8 }}>
      <Text variant="section" accessibilityRole="header">In the room</Text>
      <Text variant="body">{joined} {joined === 1 ? "member" : "members"} joined{people.length ? ` of ${people.length} who can vote` : ""}</Text>
      {shown.map(person => (
        <View key={person.id} style={{ flexDirection: "row", gap: 8 }}>
          <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>{person.label}</Text>
          <Text variant="small">{person.joined ? "Joined" : "Waiting"}</Text>
        </View>
      ))}
      {people.length > shown.length ? <Button label={`Show all ${people.length}`} variant="ghost" size="compact" onPress={() => setAll(true)} /> : null}
      {onShowQr ? <Button label="Show join QR" variant="secondary" size="compact" testID="voting-join-qr" onPress={onShowQr} /> : null}
    </Card>
  );
}

/** The leader's applicant queue for this pass: each recorded outcome, the one being voted on, and the next. */
function Queue({ room, labels }: { room: RoomSnapshot; labels: SummaryLabels["labels"] | undefined }) {
  const { colors } = useTheme();
  const list = [...(currentPass(room)?.candidates ?? [])].sort((a, b) => a.position - b.position);
  const current = list.findIndex(candidate => candidate.applicationId === room.currentApplicantId);
  const state = (candidate: RoomEntry, index: number) => candidate.ballotState === "CONFIRMED" && candidate.outcome !== "UNREVIEWED" ? savedOutcomeLabels[candidate.outcome]
    : index === current ? (room.status === "OPEN" ? "Voting now" : "Current") : index === current + 1 && current >= 0 ? "Up next" : "";
  return (
    <Card testID="voting-queue" style={{ gap: 8 }}>
      <Text variant="section" accessibilityRole="header">Applicants</Text>
      {!list.length ? <Text variant="small">{room.status === "DRAFT" ? `${room.outcomes.length} applicant${room.outcomes.length === 1 ? "" : "s"}` : "No applicants in this pass."}</Text> : list.map((candidate, index) => (
        <View key={candidate.applicationId} accessible accessibilityState={{ selected: index === current }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 }}>
          <Text variant={index === current ? "bodyStrong" : "body"} style={{ flex: 1 }} numberOfLines={1}>{candidate.position + 1} · {applicantLabel(room, labels, candidate.applicationId)}</Text>
          <Text variant="small" color={index === current ? colors.brandInk : undefined}>{state(candidate, index)}</Text>
        </View>
      ))}
    </Card>
  );
}
