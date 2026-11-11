/**
 * Decide (formerly Decisions): ordered steps for the selected round.
 *   1. Review (`decisionTab=review`) — the shared applicant review on applicants still needing a decision.
 *   2. Vote   (`decisionTab=voting`) — the Voting room: scheduled, active and past sessions.
 *   3. Send   (`decisionTab=letters`) — saved review decisions, letters by outcome, sessions ready to send, scheduled sends.
 * The internal URL values stay `tool=decisions` and `decisionTab=voting|letters`, so stored links keep working.
 * Pure helpers only: the page, tests and redirects share them.
 */
export type DecideTab = "review" | "voting" | "letters"
export const decideSteps: { id: DecideTab; label: string }[] = [{ id: "review", label: "Review" }, { id: "voting", label: "Vote" }, { id: "letters", label: "Send" }]

export type DecideRoom = { roundId: string; roundName: string; state: string; mode?: string | null; publishedAt?: string | Date | null; applicantCount: number }

/** The tab to show: the requested one when this member may open it, else the first one they can. */
export function decideTab(requested: string | null | undefined, access: { canVote: boolean; canSend: boolean; canDecide?: boolean }): DecideTab | null {
  const allowed = decideSteps.filter(step => step.id === "review" ? !!access.canDecide : step.id === "voting" ? access.canVote : access.canSend).map(step => step.id)
  if (requested === "review" || requested === "voting" || requested === "letters") return allowed.includes(requested) ? requested : allowed[0] ?? null
  return allowed[0] ?? null
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
