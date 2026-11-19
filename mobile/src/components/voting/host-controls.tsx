import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Field } from "~/components/field";
import { Check, ExternalLink, MoreHorizontal, Pause, XIcon } from "~/components/icons";
import { type ConfirmRequest, Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Divider, Row } from "~/components/ui";
import { type Choice, type CommandResult, type RoomEntry, type RoomSnapshot, type SummaryLabels, SESSION_ENDED, applicantLabel, leadingChoice, outcomeLabels, savedOutcomeLabels, webRoomPath } from "~/components/voting/room";
import { ApiError, api } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { openOnWeb } from "~/lib/links";
import { useTheme } from "~/lib/theme";

type Action = "START" | "OPEN_VOTING" | "CLOSE_VOTING" | "ADVANCE" | "NEXT_PASS" | "END" | "DECIDE_AND_ADVANCE" | "DECIDE_WITHOUT_VOTE_AND_ADVANCE" | "UNDO_DECISION";
type Command = { clubId: string; sessionId: string; requestId: string; revision: number; action: Action; [extra: string]: unknown };
const icons = { ACCEPT: Check, HOLD: Pause, REJECT: XIcon } as const;
/** One sheet at a time: the confirm sheet opens once the More sheet has left the screen. */
const sheetClosed = () => new Promise<void>(resolve => setTimeout(resolve, 380));

/**
 * The session leader's controls, as components/live-voting/room-meeting.tsx offers them for each
 * state. Every command carries the snapshot's `revision` and its own `requestId` (a retry after a
 * lost connection is the same command); opening and closing a ballot also carry the snapshot's
 * signed `viewedAt`/`viewToken`. The server decides what is allowed and its refusal is shown as is.
 * Correcting an outcome, slide preparation and finalizing decisions stay on the web.
 */
export function HostControls({ room, entry, labels, next, refresh, confirm }: { room: RoomSnapshot; entry: RoomEntry | undefined; labels: SummaryLabels["labels"] | undefined; next: string | null; refresh: () => Promise<unknown>; confirm: (request: ConfirmRequest) => Promise<boolean> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Command | null>(null);
  const [confirmedRevision, setConfirmedRevision] = useState(0);
  const [staleRevision, setStaleRevision] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const lock = useRef(false);
  const applicantKey = `${room.passNumber}:${room.currentApplicantId}`;
  useEffect(() => { setReason(""); }, [applicantKey]);
  useEffect(() => { if (staleRevision === null) return; const timer = setTimeout(() => setStaleRevision(null), 4000); return () => clearTimeout(timer); }, [staleRevision]);

  async function send(action: Action, extra: Record<string, unknown> = {}, retry = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const body: Command = retry && pending ? pending : { clubId: room.clubId, sessionId: room.id, requestId: Crypto.randomUUID(), revision: room.revision, action, ...extra };
    setPending(body);
    try {
      const response = await api.post<CommandResult>("voting.command", body);
      if (!response.ok) {
        haptics.error(); setPending(null);
        if (response.code === "STALE_STATE") setStaleRevision(body.revision);
        setError(response.code === "STALE_STATE" && action === "UNDO_DECISION" ? "Newer room activity prevents Undo. The latest state is shown below; use Correct an outcome to return the applicant to Hold."
          : response.code === "STALE_STATE" ? "The room changed since this view loaded. The latest state is shown below; check it and try again." : response.message);
        await refresh(); return;
      }
      haptics.save();
      setConfirmedRevision(response.result.revision); setPending(null); setMore(false);
      if (body.action === "CLOSE_VOTING") setReason("");
      await refresh();
    } catch (failure) {
      haptics.error();
      // A refusal the server put into words (signed out, rate limited, access removed) is shown as written.
      setError(failure instanceof ApiError && failure.status >= 400 && failure.status < 500 ? failure.message : "Command could not be confirmed. Reconnecting before retry; your decision may already be saved.");
      await refresh().catch(() => undefined);
    } finally { lock.current = false; setBusy(false); }
  }

  const saved = room.undo;
  const waitingForSnapshot = room.revision < confirmedRevision || (staleRevision !== null && room.revision <= staleRevision);
  const locked = busy || !!pending || waitingForSnapshot || !!room.finalizedAt;
  // Counts as the server sends them: the session's decision totals and the room's participation.
  const { hold, unreviewed } = room.targetSummary.decisions;
  const missing = Math.max(0, room.participation.eligible - room.participation.voted);
  const label = (id: string) => applicantLabel(room, labels, id);
  const scope = { applicationId: room.currentApplicantId, passNumber: room.passNumber };
  const view = { viewedAt: room.viewedAt, viewToken: room.viewToken ?? undefined };
  const leading = entry?.totals ? leadingChoice(entry.totals) : null;
  const confirmEnd = () => confirm({ title: "End voting?", description: `${hold} Hold and ${unreviewed} Unreviewed applicants will remain unresolved. No messages will be sent.`, confirmLabel: "End voting now", destructive: true });
  const end = async () => { if (await confirmEnd()) void send("END", { confirmed: true }); };
  const undo = () => { if (saved) void send("UNDO_DECISION", { applicationId: saved.applicationId, passNumber: saved.passNumber, undoRequestId: saved.requestId }); };
  const decide = (choice: Choice) => { void send("DECIDE_AND_ADVANCE", { ...scope, choice, reason: reason.trim() || undefined }); };
  const totalsLine = entry?.totals ? `Pass ${entry.totals.ACCEPT} · Hold ${entry.totals.HOLD} · Do not pass ${entry.totals.REJECT} · ${missing} missing` : null;
  const ballotState = entry?.ballotState;
  const canDecideWithoutVote = room.status === "OPEN" && (ballotState === "PENDING" || ballotState === "OPEN") && room.permissions.canDecideWithoutVote;
  const canEndFromMore = room.permissions.canEnd && (room.status === "DRAFT" || room.status === "OPEN");
  const hasMore = canDecideWithoutVote || canEndFromMore || room.permissions.canCorrect;

  async function start() {
    const early = !!room.meeting?.plannedAt && +new Date(room.meeting.plannedAt) > Date.now();
    if (!early || await confirm({ title: "Start this session early?", description: "It is scheduled for later. Voting begins only when you open a ballot.", confirmLabel: "Start early" })) void send("START", { confirmed: early });
  }
  async function close(recount = false) {
    if (!missing || await confirm({ title: "Close voting early?", description: `${missing} ${missing === 1 ? "ballot is" : "ballots are"} missing from members in the room. Missing ballots are not Do not pass votes.`, confirmLabel: "Close voting now" }))
      void send("CLOSE_VOTING", { confirmed: true, ...scope, ...view, ...(recount ? { resolveElectorate: true, reason: reason.trim() } : {}) });
  }
  async function nextPass() {
    if (room.status !== "COMPLETED" || await confirm({ title: "Resume to review held applicants?", description: "Only held applicants are reviewed. Unreviewed applicants remain unresolved.", confirmLabel: "Resume with held applicants" })) void send("NEXT_PASS");
  }
  async function decideWithoutVote(choice: "ACCEPT" | "REJECT") {
    const cast = room.ballotsReceived, open = ballotState === "OPEN";
    setMore(false); await sheetClosed();
    if (await confirm({
      title: `${choice === "ACCEPT" ? "Pass" : "Do not pass"} ${label(room.currentApplicantId!)} without a vote?`,
      description: `${open ? `Voting closes now; ${cast} ballot${cast === 1 ? "" : "s"} already cast will be kept but won’t decide this outcome.` : "No ballots will be created."} This is not a final recruitment decision and sends no messages.`,
      confirmLabel: choice === "ACCEPT" ? "Pass, no vote" : "Do not pass, no vote", destructive: choice === "REJECT",
    })) void send("DECIDE_WITHOUT_VOTE_AND_ADVANCE", { ...scope, choice, reason: reason.trim(), confirmed: true });
  }

  return (
    <Card testID="voting-host-controls" accessibilityLabel="Leader controls" style={{ gap: 12 }}>
      {error ? (
        <View accessibilityRole="alert" style={{ gap: 8 }}>
          <Text variant="small" color={colors.destructive} testID="voting-host-error">{error}</Text>
          {pending && !busy ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button label="Retry command" variant="secondary" size="compact" testID="voting-host-retry" onPress={() => { void send(pending.action, {}, true); }} />
              {/* The room's own snapshot shows whether it was saved; dismissing never sends anything. */}
              <Button label="Dismiss" variant="ghost" size="compact" testID="voting-host-dismiss" onPress={() => { setPending(null); setError(""); void refresh().catch(() => undefined); }} />
            </View>
          ) : null}
        </View>
      ) : null}

      {room.status === "DRAFT" ? <Button full size="large" testID="voting-start" label="Start session" loading={busy && pending?.action === "START"} disabled={locked} onPress={() => { void start(); }} /> : null}
      {room.status === "OPEN" && ballotState === "PENDING" ? <Button full size="large" testID="voting-open" label="Open voting" loading={busy && pending?.action === "OPEN_VOTING"} disabled={locked} onPress={() => { void send("OPEN_VOTING", { ...scope, ...view }); }} /> : null}
      {room.status === "OPEN" && ballotState === "OPEN" ? (
        <>
          <Button full size="large" testID="voting-close" label="Close vote" loading={busy && pending?.action === "CLOSE_VOTING"} disabled={locked} onPress={() => { void close(); }} />
          <Text variant="small">{room.rule?.mode === "THRESHOLD" ? `After you close the vote, the rule decides (${room.rule.description}) and the result shows on the projector.` : "After you close the vote, the totals show on the projector and you confirm Pass, Hold or Do not pass."}</Text>
          {room.electorateChange ? (
            <View style={{ gap: 10 }} testID="voting-electorate-change">
              <Text variant="small" color={colors.warning}>{room.electorateChange.removed} voter{room.electorateChange.removed === 1 ? "" : "s"} can no longer vote, so voting is paused. Recount without {room.electorateChange.removed === 1 ? "this voter" : "them"} and give a reason to close, or restore {room.electorateChange.removed === 1 ? "their" : "those voters'"} access to continue.</Text>
              <Field label="Reason for recounting" testID="voting-recount-reason" value={reason} onChangeText={setReason} maxLength={1000} />
              <Button full variant="secondary" testID="voting-recount-close" label="Recount and close vote" disabled={locked || !reason.trim()} onPress={() => { void close(true); }} />
            </View>
          ) : null}
        </>
      ) : null}

      {room.status === "OPEN" && ballotState === "CLOSED" && room.ruleResult ? (
        <View accessibilityLabel="Confirm rule outcome" style={{ gap: 10 }}>
          <Text variant="section" accessibilityRole="header">Voting rule result</Text>
          {totalsLine ? <Text variant="body" testID="voting-totals">{totalsLine}</Text> : null}
          <Text variant="small">{room.ruleResult.summary}</Text>
          {room.ruleResult.outcome ? (
            <Button full size="large" testID="voting-confirm-rule" icon={icons[room.ruleResult.outcome]} label={`Confirm ${outcomeLabels[room.ruleResult.outcome]}`} disabled={locked} onPress={() => { void send("DECIDE_AND_ADVANCE", { ...scope, choice: room.ruleResult!.outcome }); }} />
          ) : (
            <>
              <Text variant="small">Hold the applicant for another vote, or decide explicitly with a reason.</Text>
              <Field label="Decision reason" testID="voting-reason" value={reason} onChangeText={setReason} maxLength={1000} />
              {(["HOLD", "ACCEPT", "REJECT"] as const).map(choice => (
                <Button key={choice} full testID={`voting-decide-${choice.toLowerCase()}`} variant={choice === "HOLD" ? "primary" : "secondary"} icon={icons[choice]} label={choice === "HOLD" ? "Hold for another vote" : outcomeLabels[choice]} disabled={locked || (choice !== "HOLD" && !reason.trim())} onPress={() => decide(choice)} />
              ))}
            </>
          )}
        </View>
      ) : null}
      {room.status === "OPEN" && ballotState === "CLOSED" && !room.ruleResult ? (
        <View accessibilityLabel="Confirm applicant outcome" style={{ gap: 10 }}>
          <Text variant="section" accessibilityRole="header">Confirm outcome</Text>
          {totalsLine ? <Text variant="body" testID="voting-totals">{totalsLine}</Text> : null}
          <Text variant="small">{leading ? `Leading choice: ${outcomeLabels[leading]}` : "Tie or no ballots. Choose an outcome and record a reason."}</Text>
          <Field label="Decision reason" testID="voting-reason" value={reason} onChangeText={setReason} maxLength={1000} />
          {(["ACCEPT", "HOLD", "REJECT"] as const).map(choice => (
            <Button key={choice} full testID={`voting-decide-${choice.toLowerCase()}`} variant={choice === leading ? "primary" : "secondary"} icon={icons[choice]} label={outcomeLabels[choice]} disabled={locked || (choice !== leading && !reason.trim())} onPress={() => decide(choice)} />
          ))}
        </View>
      ) : null}

      {(room.status === "PAUSED" || room.status === "COMPLETED") && hold > 0 ? <Button full size="large" testID="voting-next-pass" label="Review held applicants" disabled={locked} onPress={() => { void nextPass(); }} /> : null}
      {room.permissions.canEnd && room.status === "PAUSED" ? <Button full testID="voting-end" variant="secondary" label="End voting" disabled={locked} onPress={() => { void end(); }} /> : null}

      {room.status === "OPEN" ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View>
            <Button testID="voting-previous" variant="secondary" label="Previous" accessibilityHint={saved ? `Undo ${label(saved.applicationId)} ${savedOutcomeLabels[saved.choice]}` : undefined} disabled={locked || !saved || !room.permissions.canCorrect} onPress={undo} />
          </View>
          <View style={{ flex: 1 }}>
            <Button full testID="voting-next" variant="secondary" label={next ? `Next: ${next}` : "Next"} disabled={locked || ballotState !== "CONFIRMED"} onPress={() => { void send("ADVANCE", scope); }} />
          </View>
        </View>
      ) : null}

      {waitingForSnapshot && !busy ? <Text variant="small" accessibilityLiveRegion="polite">Updating…</Text> : null}
      {saved ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text variant="small" color={colors.foreground} style={{ flex: 1 }} testID="voting-decision-saved">{label(saved.applicationId)} {savedOutcomeLabels[saved.choice]}{saved.decidedBy ? ` by ${saved.decidedBy}` : ""}</Text>
          {room.permissions.canCorrect ? <Button label="Undo" variant="ghost" size="compact" testID="voting-undo" disabled={locked} onPress={undo} /> : null}
        </View>
      ) : null}

      {room.status === "COMPLETED" ? <Text variant="small">{SESSION_ENDED}</Text> : null}
      {room.finalizedAt ? <Text variant="small">Decisions finalized. Finalization did not send applicant messages.</Text> : null}
      {room.status === "COMPLETED" && room.permissions.canFinalize && !room.finalizedAt ? (
        <><Divider /><Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Finalize decisions" detail="Open on web" onPress={() => { openOnWeb(webRoomPath(room.clubId, room.id, "leader")); }} /></>
      ) : null}

      {hasMore && !room.finalizedAt ? (
        <Button testID="voting-more" variant="ghost" size="compact" icon={MoreHorizontal} label="More actions" disabled={busy} onPress={() => setMore(true)} />
      ) : null}
      <Sheet open={more} onClose={() => setMore(false)} title="More actions" testID="voting-more-sheet">
        <View style={{ gap: 14, paddingBottom: 8 }}>
          {canDecideWithoutVote ? (
            <View accessibilityLabel="Decide without a vote" style={{ gap: 10 }}>
              <Text variant="small">{ballotState === "OPEN" ? "Closes voting now. Ballots already cast are kept but don’t decide this outcome." : "No ballots are created."} This sets the voting-session outcome only.</Text>
              <Field label="Reason for deciding without a vote" value={reason} onChangeText={setReason} maxLength={1000} />
              <Button full variant="secondary" icon={Check} label="Pass without vote" disabled={locked || !reason.trim()} onPress={() => { void decideWithoutVote("ACCEPT"); }} />
              <Button full variant="secondary" icon={XIcon} label="Do not pass without vote" disabled={locked || !reason.trim()} onPress={() => { void decideWithoutVote("REJECT"); }} />
              <Divider />
            </View>
          ) : null}
          {canEndFromMore ? <Button full variant="secondary" testID="voting-end-more" label="End voting" disabled={locked} onPress={() => { setMore(false); void sheetClosed().then(end); }} /> : null}
          {room.permissions.canCorrect ? <Row leading={<ExternalLink size={22} color={colors.mutedForeground} />} title="Correct an outcome" detail="Open on web" onPress={() => { setMore(false); openOnWeb(webRoomPath(room.clubId, room.id, "leader")); }} /> : null}
        </View>
      </Sheet>
    </Card>
  );
}
