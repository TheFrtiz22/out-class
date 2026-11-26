// No imports: the interview room, its server read and Demo share this.
/** Round types reviewed in the interview room without an interview: the room says "Review" for these. */
export const REVIEW_ROUND_TYPES = ["APPLICATION_REVIEW", "CASE_TASK"] as const
export function isReviewRound(type: string | null | undefined) {
  return (REVIEW_ROUND_TYPES as readonly string[]).includes(type ?? "")
}


/** The first assigned interview with no booked time that the room can open: the applicant's current round, not archived.
 *  Review rounds (Application review, Case / Task) are never booked, so they don't count: the note is about interview times. */
export function firstUnbooked(workspace: { rounds: { id: string; review?: boolean; archived?: boolean }[]; applications: { id: string; roundId: string; assignedRoundIds: string[] }[] }, rows: { applicationId: string | null; roundId: string }[]) {
  const open = new Set(workspace.rounds.filter(r => !r.review && !r.archived).map(r => r.id))
  for (const a of workspace.applications) for (const roundId of a.assignedRoundIds)
    if (open.has(roundId) && a.roundId === roundId && !rows.some(row => row.applicationId === a.id && row.roundId === roundId)) return { applicationId: a.id, roundId }
  return null
}
