/**
 * Decide (formerly Decisions): an Overview, then ordered steps for the selected round.
 *   Overview (`decisionTab=overview`, the default) — decisions, target, sessions and letters at a glance.
 *   1. Review (`decisionTab=review`) — the shared applicant review on applicants still needing a decision.
 *   2. Vote   (`decisionTab=voting`) — the Voting room: scheduled, active and past sessions.
 *   3. Send   (`decisionTab=letters`) — saved review decisions, letters by outcome, sessions ready to send, scheduled sends.
 * The internal URL values stay `tool=decisions` and `decisionTab=voting|letters`, so stored links keep working.
 * Pure helpers only: the page, tests and redirects share them.
 */
export type DecideTab = "overview" | "review" | "voting" | "letters"
export type DecideStep = Exclude<DecideTab, "overview">
export const decideSteps: { id: DecideStep; label: string }[] = [{ id: "review", label: "Review" }, { id: "voting", label: "Vote" }, { id: "letters", label: "Send" }]
/** Every Decide tab in order: Overview first, then the numbered steps. */
export const decideTabs: { id: DecideTab; label: string }[] = [{ id: "overview", label: "Overview" }, ...decideSteps]

export type DecideRoom = { roundId: string; roundName: string; state: string; mode?: string | null; publishedAt?: string | Date | null; applicantCount: number }

type DecideAccess = { canVote: boolean; canSend: boolean; canDecide?: boolean }
function tabAllowed(tab: DecideTab, access: DecideAccess) {
  return tab === "overview" ? access.canVote || access.canSend || !!access.canDecide
    : tab === "review" ? !!access.canDecide : tab === "voting" ? access.canVote : access.canSend
}

/** The tab to show: the requested one when this member may open it, else Overview (null without any Decide access). */
export function decideTab(requested: string | null | undefined, access: DecideAccess): DecideTab | null {
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
export function decideCounts(rooms: DecideRoom[]): Partial<Record<DecideTab, number>> {
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

/**
 * The delivery marker every decision send writes (utils/decision-communications.ts, voting-room-finalization.ts):
 * one notification per application and decision version. Its presence means this exact decision was sent.
 */
export const decisionEventKey = (app: { id: string; decisionVersion: number }) => `decision:${app.id}:${app.decisionVersion}`

/**
 * Decision letters for a round, each applicant once: applicants with a letter-bearing decision whose current
 * version has been sent, and those still to send (a changed decision is a new version, so it counts as ready again).
 */
export function roundLetterCounts(apps: { id: string; decisionVersion: number }[], sentKeys: Iterable<string>) {
  const sent = new Set(sentKeys)
  const done = apps.filter(app => sent.has(decisionEventKey(app))).length
  return { ready: apps.length - done, sent: done }
}

/**
 * The round Overview opens on when the URL names none: the round of an active live session, else of a scheduled
 * one, else of the most recent session (rooms arrive newest first), else the first round in pipeline order.
 */
export function overviewDefaultRound(rounds: { id: string }[], rooms: OverviewRoom[] | null): string | null {
  const known = (room?: OverviewRoom) => room && rounds.some(round => round.id === room.roundId) ? room.roundId : null
  return known(rooms?.find(room => overviewSessionGroup(room) === "active"))
    ?? known(rooms?.find(room => overviewSessionGroup(room) === "scheduled"))
    ?? known(rooms?.find(room => rounds.some(round => round.id === room.roundId)))
    ?? rounds[0]?.id ?? null
}

/** A read keyed by its scope (club, cycle, round, demo, access): a response for another scope is never shown. */
export type ScopedRead<T> = { scope: string; value: T | null }
export type OverviewSummaryState<T> = { kind: "choose" } | { kind: "loading" } | { kind: "denied" } | { kind: "failed" } | { kind: "ready"; value: T }

/**
 * What Overview's decision totals show. The round read refuses identified rounds to members without
 * applicants.identify; the Voting room list only gives such members anonymous-round sessions, so a failure for a
 * round with none of their sessions listed is that refusal (quiet, no Retry), and any other failure is an outage.
 */
export function overviewSummaryState<T>(input: { roundId: string; scope: string; loaded: ScopedRead<T> | null; canIdentify: boolean; rooms: Pick<DecideRoom, "roundId">[] | null }): OverviewSummaryState<T> {
  if (!input.roundId) return { kind: "choose" }
  if (!input.loaded || input.loaded.scope !== input.scope) return { kind: "loading" }
  if (input.loaded.value !== null) return { kind: "ready", value: input.loaded.value }
  return !input.canIdentify && !input.rooms?.some(room => room.roundId === input.roundId) ? { kind: "denied" } : { kind: "failed" }
}
