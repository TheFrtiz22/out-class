/**
 * Decide (formerly Decisions): an Overview, then two ordered steps for the selected round.
 *   Overview (`decisionTab=overview`, the default) — decisions, target, sessions and letters at a glance.
 *   1. Vote  (`decisionTab=voting`)  — the Voting room: scheduled, active and past sessions.
 *   2. Send  (`decisionTab=letters`) — decision letters by outcome, sessions ready to send, scheduled sends.
 * The internal URL values stay `tool=decisions` and `decisionTab=voting|letters`, so stored links keep working.
 * Pure helpers only: the page, tests and redirects share them.
 */
export type DecideTab = "overview" | "voting" | "letters"
export type DecideStep = Exclude<DecideTab, "overview">
export const decideSteps: { id: DecideStep; label: string }[] = [{ id: "voting", label: "Vote" }, { id: "letters", label: "Send" }]
/** Every Decide tab in order: Overview first, then the numbered steps. */
export const decideTabs: { id: DecideTab; label: string }[] = [{ id: "overview", label: "Overview" }, ...decideSteps]

export type DecideRoom = { roundId: string; roundName: string; state: string; mode?: string | null; publishedAt?: string | Date | null; applicantCount: number }

function tabAllowed(tab: DecideTab, access: { canVote: boolean; canSend: boolean }) {
  return tab === "overview" ? access.canVote || access.canSend : tab === "voting" ? access.canVote : access.canSend
}

/** The tab to show: the requested one when this member may open it, else Overview (null without any Decide access). */
export function decideTab(requested: string | null | undefined, access: { canVote: boolean; canSend: boolean }): DecideTab | null {
  const allowed = decideTabs.filter(tab => tabAllowed(tab.id, access)).map(tab => tab.id)
  return allowed.find(tab => tab === requested) ?? allowed[0] ?? null
}

/** A closed voting room whose outcomes have not been sent to applicants yet. Board sessions are read-only history and are never sent from here. */
export function readyToSend(room: DecideRoom) {
  return room.state === "COMPLETED" && !room.publishedAt && room.mode !== "LEGACY"
}

/**
 * Tab counts for the selected round (rooms are already filtered to it by the server read):
 * Vote = sessions still to run or running; Send = applicants in closed sessions waiting to be sent.
 */
export function decideCounts(rooms: DecideRoom[]) {
  return {
    voting: rooms.filter(room => room.state !== "COMPLETED").length,
    letters: rooms.filter(readyToSend).reduce((total, room) => total + room.applicantCount, 0),
  }
}

/** Rounds that have voting sessions, in first-seen order: the picker for members who can't read the round list. */
export function roundsFromRooms(rooms: Pick<DecideRoom, "roundId" | "roundName">[]) {
  const seen = new Map<string, string>()
  for (const room of rooms) if (!seen.has(room.roundId)) seen.set(room.roundId, room.roundName)
  return [...seen].map(([id, name]) => ({ id, name }))
}

export type OverviewRoom = DecideRoom & { view?: "leader" | "present" | "member"; meeting?: { status?: string | null } | null }

/**
 * Overview's session list, with the same grouping as the Voting room: Scheduled = a draft with a scheduled
 * meeting; Active = open or paused. Board (LEGACY) sessions, cancelled meetings and unscheduled drafts are left out.
 */
export function overviewSessionGroup(room: OverviewRoom): "active" | "scheduled" | null {
  if (room.mode !== "LIVE" || room.meeting?.status === "CANCELLED") return null
  if (room.state === "DRAFT") return room.meeting?.status === "SCHEDULED" ? "scheduled" : null
  return room.state === "OPEN" || room.state === "PAUSED" ? "active" : null
}

/** The session's action, as the Voting room labels it: a leader resumes, a voter joins; otherwise view details. */
export function overviewSessionAction(room: OverviewRoom): "Resume" | "Join" | "View details" {
  if (overviewSessionGroup(room) !== "active") return "View details"
  return room.view === "leader" ? "Resume" : room.view === "member" ? "Join" : "View details"
}

/** Sessions ready to send and already sent (LIVE only), each with its applicant count. */
export function overviewSendCounts(rooms: DecideRoom[]) {
  const ready = rooms.filter(readyToSend), sent = rooms.filter(room => room.mode !== "LEGACY" && room.state === "COMPLETED" && !!room.publishedAt)
  const applicants = (list: DecideRoom[]) => list.reduce((total, room) => total + room.applicantCount, 0)
  return { ready: { sessions: ready.length, applicants: applicants(ready) }, sent: { sessions: sent.length, applicants: applicants(sent) } }
}
