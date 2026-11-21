import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Check, Pause, XIcon } from "~/components/icons";
import { type BallotResult, type Choice, OWN_APPLICATION_MESSAGE, type RoomEntry, type RoomSnapshot, outcomeLabels } from "~/components/voting/room";
import { Sheet } from "~/components/sheet";
import { Text } from "~/components/text";
import { Button, Card, Press, TARGET } from "~/components/ui";
import { api } from "~/lib/api";
import { haptics } from "~/lib/haptics";
import { useTheme } from "~/lib/theme";

type Ballot = { clubId: string; sessionId: string; requestId: string; applicationId: string; passNumber: number; choice: Choice; ballotRevision: number | null };
const choices: Choice[] = ["ACCEPT", "HOLD", "REJECT"];
const icons = { ACCEPT: Check, HOLD: Pause, REJECT: XIcon } as const;

/**
 * The member's ballot, as the web's "Your vote" view casts it (components/live-voting/room-view.tsx):
 * one idempotent request per choice (`requestId`), sent with the revision of the ballot it replaces.
 * The pressed choice shows as selected at once and returns to the server's recorded choice if the
 * server refuses it. A lost connection keeps the same request so Retry cannot cast a second vote.
 */
export function BallotPanel({ room, entry, refresh }: { room: RoomSnapshot; entry: RoomEntry | undefined; refresh: () => Promise<unknown> }) {
  const { colors, radius } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Ballot | null>(null);
  const [pending, setPending] = useState<Ballot | null>(null);
  const [ack, setAck] = useState<{ key: string; choice: Choice; revision: number } | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const lock = useRef(false);
  const key = `${room.passNumber}:${room.currentApplicantId}`;
  const open = room.status === "OPEN" && entry?.ballotState === "OPEN";
  // A vote whose answer was lost belongs to the ballot it was cast on. Once the room moves to another
  // applicant or closes that ballot, it can no longer count: drop it (so the next ballot isn't locked)
  // and say whether it was saved, from the server's own record.
  const pendingKey = pending ? `${pending.passNumber}:${pending.applicationId}` : null;
  const unconfirmed = !busy && !!pending && (pendingKey !== key || !open);
  useEffect(() => {
    if (!unconfirmed || !pending) return;
    const savedChoice = pendingKey === key ? entry?.ownBallot?.choice : undefined;
    setPending(null); setAttempt(null);
    setError(savedChoice === pending.choice ? "" : "Voting moved on before your vote was confirmed. It may not have been recorded.");
  }, [unconfirmed, pending, pendingKey, key, entry?.ownBallot?.choice]);

  // A refusal or "moved on" note belongs to the applicant it was about: the next one starts clean. Kept: a
  // vote still unconfirmed (its Retry; the effect above reports it once the move is seen), and a refusal
  // whose own refresh is what moved the room.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const settledAt = useRef(0);
  useEffect(() => { if (!pendingRef.current && !lock.current && Date.now() - settledAt.current > 1000) setError(""); }, [key]);

  async function vote(choice?: Choice) {
    if (lock.current || (!entry && !pending)) return;
    lock.current = true; setBusy(true); setError("");
    const ownRevision = ack?.key === key ? Math.max(ack.revision, entry?.ownBallot?.revision ?? -1) : entry?.ownBallot?.revision ?? null;
    const body = pending ?? { clubId: room.clubId, sessionId: room.id, requestId: Crypto.randomUUID(), applicationId: room.currentApplicantId!, passNumber: room.passNumber, choice: choice!, ballotRevision: ownRevision };
    setPending(body); setAttempt(body);
    try {
      const response = await api.post<BallotResult>("voting.ballot", body);
      if (!response.ok) {
        // Refused: drop the optimistic choice and show the server's reason beside the recorded state.
        haptics.error(); setPending(null); setAttempt(null); setError(response.message); await refresh(); return;
      }
      haptics.vote();
      setAck({ key: `${body.passNumber}:${body.applicationId}`, choice: body.choice, revision: response.result.ballotRevision });
      setPending(null); setAttempt(null); await refresh();
    } catch {
      haptics.error(); setAttempt(null);
      setError("Your vote could not be confirmed. Retry sends the same vote safely.");
    } finally { lock.current = false; settledAt.current = Date.now(); setBusy(false); }
  }

  const recorded = ack?.key === key && ack.revision >= (entry?.ownBallot?.revision ?? -1) ? ack.choice : entry?.ownBallot?.choice;
  const selected = attempt && `${attempt.passNumber}:${attempt.applicationId}` === key ? attempt.choice : recorded;
  const status = busy ? `Saving ${attempt ? outcomeLabels[attempt.choice] : "vote"}…`
    : room.status === "OPEN" && room.ownApplicant ? OWN_APPLICATION_MESSAGE
    : open && room.votingPaused ? "Voting paused · The leader is reviewing a change in who can vote"
    : recorded && recorded !== "UNREVIEWED" ? `Vote recorded · ${outcomeLabels[recorded]}`
    : open ? "Choose your vote"
    : room.status === "COMPLETED" ? "Voting ended"
    : room.status === "DRAFT" || room.status === "PAUSED" ? "Waiting for the leader"
    : room.status === "OPEN" && entry?.ballotState === "PENDING" ? "Waiting for the leader to open voting" : "Voting closed · Waiting for the leader";
  const waiting = !busy && !!recorded && recorded !== "UNREVIEWED" && entry?.ballotState !== "CONFIRMED" && room.status === "OPEN" && !room.ownApplicant && !(open && room.votingPaused);
  const disabled = busy || room.votingPaused || !!pending || !room.permissions.voter || !open;

  return (
    <Card testID="voting-ballot" style={{ gap: 12 }}>
      <View accessibilityLiveRegion="polite" style={{ gap: 2 }}>
        <Text variant="card" testID="voting-ballot-status">{status}</Text>
        {waiting ? <Text variant="small">Waiting for the group decision</Text> : null}
      </View>
      {error ? (
        <View accessibilityRole="alert" style={{ gap: 8 }}>
          <Text variant="small" color={colors.destructive}>{error}</Text>
          {pending ? <Button label="Retry vote" variant="secondary" size="compact" disabled={busy} testID="voting-retry-vote" onPress={() => { void vote(); }} />
            : <Button label="Try again" variant="secondary" size="compact" onPress={() => { setError(""); void refresh(); }} />}
        </View>
      ) : null}
      {open && !room.ownApplicant ? (
        <View accessibilityLabel="Your ballot" style={{ gap: 10 }}>
          {choices.map(choice => {
            const Icon = icons[choice], on = selected === choice;
            return (
              <Press key={choice} large testID={`voting-choice-${choice.toLowerCase()}`} disabled={disabled} onPress={() => { void vote(choice); }}
                accessibilityLabel={outcomeLabels[choice]} accessibilityState={{ selected: on, disabled }}
                style={{ minHeight: TARGET + 12, borderRadius: radius.lg, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Icon size={20} weight={on ? "fill" : "regular"} color={on ? colors.primaryForeground : colors.foreground} />
                <Text variant="button" color={on ? colors.primaryForeground : colors.foreground}>{outcomeLabels[choice]}</Text>
              </Press>
            );
          })}
        </View>
      ) : null}
      {open ? <Text variant="small">{room.targetSummary.pass.label}</Text> : null}
      {open ? (
        <View style={{ gap: 2 }}>
          <Text variant="small">Your choice is hidden from club members and leaders.</Text>
          <Press onPress={() => setPrivacy(true)} accessibilityLabel="Who can see ballots" style={{ minHeight: TARGET, justifyContent: "center", alignSelf: "flex-start" }}>
            <Text variant="smallStrong" style={{ textDecorationLine: "underline" }}>Who can see ballots</Text>
          </Press>
        </View>
      ) : null}
      <Sheet open={privacy} onClose={() => setPrivacy(false)} title="Who can see ballots">
        <View style={{ gap: 10, paddingBottom: 8 }}>
          {[
            "You can see your own choice and change it while voting is open.",
            "Everyone else, including session leaders, sees only how many ballots are in while voting is open, and only the Pass, Hold and Do not pass totals after it closes.",
            "In a small group, totals or outcomes can still let people work out how someone voted.",
            "Your ballot is stored with your account so OutClass can keep one vote per person. OutClass platform administrators can technically see stored ballots, through direct database access or an audited support session that views the app as you. Club leaders cannot.",
            "Leaders’ final decisions, overrides, interview comments and observations remain attributed to their authors.",
          ].map(line => <Text key={line} variant="small" color={colors.foreground}>{line}</Text>)}
        </View>
      </Sheet>
    </Card>
  );
}

/** A closed ballot's totals: present only once the server has closed voting on this applicant. */
export function ClosedTotals({ room, entry }: { room: RoomSnapshot; entry: RoomEntry | undefined }) {
  if (!entry?.totals) return null;
  return (
    <Card testID="voting-closed-totals" accessibilityLabel="Closed ballot totals" style={{ gap: 6 }}>
      <Text variant="section" accessibilityRole="header">Closed voting</Text>
      <Text variant="body">Pass {entry.totals.ACCEPT} · Hold {entry.totals.HOLD} · Do not pass {entry.totals.REJECT}</Text>
      {room.ruleResult ? <Text variant="small">{room.ruleResult.summary}{room.ruleResult.outcome ? " The leader confirms the rule’s outcome." : ""}</Text> : null}
    </Card>
  );
}
