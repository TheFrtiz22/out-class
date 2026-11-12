/**
 * Board columns: one per active round for applicants still pending (titled "Pending" when the club has one round),
 * then Waitlisted, Accepted and Rejected. A staged decision places the card where it will land once sent.
 */
export type BoardColumnId = `round:${string}` | "waitlisted" | "accepted" | "rejected"
export type BoardColumn = { id: BoardColumnId; title: string; roundId?: string }
type BoardStaged = { targetStatus: string; targetRoundId: string | null }

export function boardColumns(rounds: readonly { id: string; name: string; order: number }[]): BoardColumn[] {
  const ordered = [...rounds].sort((a, b) => a.order - b.order)
  return [
    ...(ordered.length > 1 ? ordered.map(round => ({ id: `round:${round.id}` as const, title: round.name, roundId: round.id })) : ordered.map(round => ({ id: `round:${round.id}` as const, title: "Pending", roundId: round.id }))),
    { id: "waitlisted", title: "Waitlisted" }, { id: "accepted", title: "Accepted" }, { id: "rejected", title: "Rejected" },
  ]
}

export function boardColumnFor(app: { status: string; roundId: string }, staged?: BoardStaged | null): BoardColumnId | null {
  if (staged) {
    if (staged.targetRoundId) return `round:${staged.targetRoundId}`
    if (staged.targetStatus === "ACCEPTED") return "accepted"
    if (staged.targetStatus === "REJECTED") return "rejected"
    if (staged.targetStatus === "WAITLISTED") return "waitlisted"
    return `round:${app.roundId}`
  }
  if (app.status === "SUBMITTED" || app.status === "IN_REVIEW" || app.status === "INTERVIEWING") return `round:${app.roundId}`
  if (app.status === "WAITLISTED") return "waitlisted"
  if (app.status === "ACCEPTED") return "accepted"
  if (app.status === "REJECTED") return "rejected"
  return null
}

/** What dropping a card on a column means: stage an outcome, remove the staged one (back home), or nothing. */
export function boardDrop(app: { status: string; roundId: string }, column: BoardColumnId, staged: boolean):
  { kind: "stage"; outcome: "ROUND" | "WAITLIST" | "ACCEPT" | "REJECT"; roundId?: string } | { kind: "unstage" } | { kind: "none"; reason?: string } {
  if (app.status === "ACCEPTED" || app.status === "REJECTED") return { kind: "none", reason: "The decision has been sent. Open the applicant to correct it." }
  const home = boardColumnFor(app, null)
  if (column === home) return staged ? { kind: "unstage" } : { kind: "none" }
  if (column.startsWith("round:")) {
    if (app.status === "WAITLISTED") return { kind: "none", reason: "Waitlisted applicants can be accepted or rejected, not moved between rounds." }
    return { kind: "stage", outcome: "ROUND", roundId: column.slice(6) }
  }
  return { kind: "stage", outcome: column === "waitlisted" ? "WAITLIST" : column === "accepted" ? "ACCEPT" : "REJECT" }
}
