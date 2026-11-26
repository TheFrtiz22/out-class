import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * The live voting room as the server projects it for this viewer (lib/voting-room-projection.ts,
 * actions/voting-room.ts getLiveVotingRoom). The app renders these values as they arrive: tallies
 * exist only on entries the server has closed, and nothing here is counted from ballots.
 */
export type Choice = "ACCEPT" | "HOLD" | "REJECT";
export type Outcome = Choice | "UNREVIEWED";
export type Totals = Record<Choice, number>;
export type RoomEntry = { applicationId: string; position: number; ballotState: "PENDING" | "OPEN" | "CLOSED" | "CONFIRMED" | (string & {}); outcome: Outcome; withoutVote?: boolean; ownBallot: { choice: Outcome; revision: number } | null; totals?: Totals };
export type RoomUndo = { requestId: string; applicationId: string; passNumber: number; choice: Choice; nextApplicationId: string | null; withoutVote: boolean; decidedBy: string | null };
export type RoomSnapshot = {
  id: string; clubId: string; cycleId: string | null; roundId: string; revision: number;
  status: "DRAFT" | "OPEN" | "PAUSED" | "COMPLETED" | (string & {});
  meeting: { name?: string; plannedAt?: string | null; location?: string | null; status?: string } | null;
  currentApplicantId: string | null; passNumber: number; ballotsReceived: number; finalizedAt: string | null;
  targetSummary: { pass: { kind: string; label: string }; decisions: { pass: number; hold: number; notPass: number; unreviewed: number; total: number } };
  permissions: { leader: boolean; voter: boolean; observer: boolean; canEnd: boolean; canFinalize: boolean; canCorrect: boolean; canDecideWithoutVote: boolean };
  outcomes: { applicationId: string; passNumber: number; outcome: Outcome }[];
  history: { number: number; status: string; candidates: RoomEntry[] }[];
  roundName: string | null; cycleName: string | null; nextRoundName: string | null;
  undo: RoomUndo | null;
  rule: { mode: string; description: string } | null;
  ruleResult: { outcome: Choice | null; summary: string } | null;
  accessVersion: string; ownApplicant: boolean; joinedSelf: boolean;
  participation: { voted: number; eligible: number };
  votingPaused: boolean; viewedAt: string; viewToken: string | null;
  electorateChange: { removed: number } | null;
  joinedParticipants: { id: string; label: string; joined: boolean }[];
};
export type RoomView = "leader" | "member" | "present";
export type RoomListItem = {
  id: string; mode: string; clubId: string; cycleId: string | null; roundId: string; state: string; createdAt: string; updatedAt: string | null; finalizedAt: string | null;
  meeting: { name?: string; plannedAt?: string | null; timeZone?: string; status?: string; location?: string | null } | null;
  roundName: string; cycleName: string; applicantCount: number; view: RoomView; joined: boolean;
};
export type JoinInfo = { status: "READY" | "JOINED" | "DENIED" | "ENDED" | "EXPIRED"; meeting?: { name: string; plannedAt: string | null; location?: string | null } | null };
export type CommandResult = { ok: true; result: { revision: number } } | { ok: false; code: string; message: string };
export type BallotResult = { ok: true; result: { accepted: true; ballotRevision: number } } | { ok: false; code: string; message: string };
export type SummaryLabels = { revision: number; rounds: { id: string; name: string }[]; labels: { id: string; label: string }[] };

// The web's wording (lib/voting-room.ts, lib/voting-room-subscription.ts, components/live-voting).
export const outcomeLabels = { ACCEPT: "Pass", HOLD: "Hold", REJECT: "Do not pass", UNREVIEWED: "Unreviewed" } as const;
export const savedOutcomeLabels = { ACCEPT: "Passed", HOLD: "Held", REJECT: "Not passed" } as const;
export const OWN_APPLICATION_MESSAGE = "You’re the applicant on screen; you can’t see or vote on this one.";
export const ROOM_UNAVAILABLE = "Voting room unavailable. Reconnect or retry; your last command may already be saved.";
export const SESSION_ENDED = "Voting ended. Unresolved applicants and saved votes are preserved. No applicant notifications were sent.";

export const currentPass = (room: RoomSnapshot) => room.history.find(pass => pass.number === room.passNumber);
export const currentEntry = (room: RoomSnapshot) => currentPass(room)?.candidates.find(candidate => candidate.applicationId === room.currentApplicantId);
/** "Applicant 8 of 12" (or "Applicant 1 of 3 · Pass 2"), as the web's applicantPosition. */
export function applicantPosition(room: RoomSnapshot) {
  const pass = currentPass(room), entry = currentEntry(room);
  return entry && pass ? `Applicant ${entry.position + 1} of ${pass.candidates.length}${room.passNumber > 1 ? ` · Pass ${room.passNumber}` : ""}` : "";
}
export const roundLine = (room: RoomSnapshot) => [room.roundName, room.cycleName].filter(Boolean).join(" · ");
/** The applicant's name where the leader's summary releases it, otherwise their number in the session. */
export function applicantLabel(room: RoomSnapshot, labels: SummaryLabels["labels"] | undefined, id: string) {
  return labels?.find(item => item.id === id)?.label ?? `Applicant ${room.outcomes.findIndex(outcome => outcome.applicationId === id) + 1}`;
}
export function nextLabel(room: RoomSnapshot, labels: SummaryLabels["labels"] | undefined) {
  const pass = currentPass(room), entry = currentEntry(room);
  if (!pass || !entry) return null;
  const next = [...pass.candidates].sort((a, b) => a.position - b.position).find(candidate => candidate.position > entry.position);
  return next ? labels?.find(item => item.id === next.applicationId)?.label ?? `Applicant ${next.position + 1}` : null;
}
/** The room's status line (components/live-voting/vote-status.tsx). */
export function voteStatusLabel(room: RoomSnapshot, entry: RoomEntry | undefined) {
  const open = room.status === "OPEN" && entry?.ballotState === "OPEN";
  return room.status === "COMPLETED" ? "Voting ended" : room.status === "DRAFT" ? "Voting has not started" : room.status === "PAUSED" ? "Waiting for the leader"
    : open && room.votingPaused ? "Voting paused" : open ? "Voting open" : entry?.ballotState === "CLOSED" || entry?.ballotState === "CONFIRMED" ? "Vote closed" : "Waiting for voting";
}
/** The single leading choice of a closed ballot's totals, as the web's leadingBallotChoice (null on a tie or no ballots). */
export function leadingChoice(totals: Totals): Choice | null {
  const highest = Math.max(totals.ACCEPT, totals.HOLD, totals.REJECT);
  const leaders = (Object.keys(totals) as Choice[]).filter(choice => totals[choice] === highest);
  return highest > 0 && leaders.length === 1 ? leaders[0]! : null;
}
/** The list's state chip, as the Voting room lists sessions (components/live-voting/room-landing.tsx). */
export function roomListStatus(room: RoomListItem) {
  if (room.mode !== "LIVE") return room.state === "OPEN" ? "Open" : room.state === "PAUSED" ? "Paused" : room.state === "COMPLETED" || room.state === "COMPLETE" ? "Closed" : "Draft";
  if (room.meeting?.status === "CANCELLED") return "Cancelled";
  if (room.state === "DRAFT") return room.meeting?.status === "SCHEDULED" ? "Scheduled" : "Draft";
  if (room.state === "COMPLETED") return room.finalizedAt ? "Closed · Finalized" : "Closed · Provisional";
  return room.state === "PAUSED" ? "Paused" : "Open";
}
export type RoomGroup = "draft" | "scheduled" | "active" | "past";
/** One group per session (lib/decide.ts votingSessionGroup). */
export function roomGroup(room: RoomListItem): RoomGroup | null {
  if (room.state === "COMPLETED" || room.mode !== "LIVE" || room.meeting?.status === "CANCELLED") return "past";
  if (room.state === "DRAFT") return room.meeting?.status === "SCHEDULED" ? "scheduled" : "draft";
  return room.state === "OPEN" || room.state === "PAUSED" ? "active" : null;
}
export const webRoomPath = (clubId: string, sessionId: string, view: RoomView) => `/voting/rooms/${encodeURIComponent(sessionId)}?clubId=${encodeURIComponent(clubId)}&view=${view}`;

/** True while this screen is the one on top and the app is in the foreground: the only time the room polls. */
export function useLive() {
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  return focused && active;
}
export const POLL_MS = 5000;
