import { isInterviewRecruitmentRound } from "@/lib/recruitment-lifecycle"

/**
 * Staged decisions: Advance / Hold / Reject (and Waitlist / Accept / a specific round from the board) are
 * recorded during review and change nothing the applicant can see. Decide › Send applies them: the status,
 * round, offer, letter and notification change only then. Pure rules shared by the server, Demo and the UI.
 *
 * Mapping (statuses: SUBMITTED, IN_REVIEW, INTERVIEWING, WAITLISTED, ACCEPTED, REJECTED):
 *   Advance  → the next active round by order (status becomes IN_REVIEW; INTERVIEWING stays only when the next
 *              round is also an interview round). In the last round, or from the waitlist: ACCEPTED.
 *   Hold     → IN_REVIEW, same round (nothing is published).
 *   Reject   → REJECTED.   Waitlist → WAITLISTED.   Accept → ACCEPTED.
 * Final decisions (ACCEPTED, REJECTED) are never staged again: they are corrected through the applicant menu.
 */
export const stagedOutcomes = ["ADVANCE", "HOLD", "REJECT", "WAITLIST", "ACCEPT", "ROUND"] as const
export type StagedOutcome = typeof stagedOutcomes[number]
export type DecisionStatus = "SUBMITTED" | "IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED" | "DRAFTING"
export type StagedTarget = { targetStatus: "IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED"; targetRoundId: string | null }
export type StageRound = { id: string; name: string; order: number; type: string }

export type StagedDecisionView = {
  id: string; applicationId: string; outcome: StagedOutcome
  targetStatus: StagedTarget["targetStatus"]; targetRoundId: string | null
  expectedStatus: DecisionStatus; expectedRoundId: string
  stagedBy: string; stagedByMe: boolean; createdAt: string
  /** Display only: the applicant (anonymized in anonymous-review rounds) and round names at read time. */
  applicant: string; roundName: string; targetRoundName: string | null
}

export const pendingDecisionStatuses: readonly DecisionStatus[] = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"]
export const isPendingDecision = (status: string) => (pendingDecisionStatuses as readonly string[]).includes(status)

/** Statuses that may receive a staged decision at all. */
export function canStage(status: string) {
  return isPendingDecision(status) || status === "WAITLISTED"
}

/** Resolve an outcome into the status and round it will apply on send. Throws a reader-facing reason. */
export function resolveStagedTarget(app: { status: string; roundId: string }, roundsInput: readonly StageRound[], outcome: StagedOutcome, roundId?: string | null): StagedTarget {
  if (!canStage(app.status)) throw new Error("Final decisions can't be staged. Use the applicant menu to correct them.")
  const rounds = [...roundsInput].sort((a, b) => a.order - b.order)
  const current = rounds.find(round => round.id === app.roundId)
  const moveTo = (target: StageRound): StagedTarget => {
    if (app.status === "WAITLISTED") throw new Error("Waitlisted applicants can be accepted or rejected, not moved between rounds.")
    const keepInterview = app.status === "INTERVIEWING" && isInterviewRecruitmentRound(target.type)
    return { targetStatus: keepInterview ? "INTERVIEWING" : "IN_REVIEW", targetRoundId: target.id }
  }
  switch (outcome) {
    case "ADVANCE": {
      if (app.status === "WAITLISTED") return { targetStatus: "ACCEPTED", targetRoundId: null }
      const next = current ? rounds.find(round => round.order > current.order) : undefined
      return next ? moveTo(next) : { targetStatus: "ACCEPTED", targetRoundId: null }
    }
    case "ROUND": {
      const target = rounds.find(round => round.id === roundId)
      if (!target || target.id === app.roundId) throw new Error("Choose another active round.")
      return moveTo(target)
    }
    case "HOLD":
      if (app.status === "WAITLISTED") throw new Error("This applicant is already on hold (waitlisted).")
      return { targetStatus: "IN_REVIEW", targetRoundId: null }
    case "REJECT": return { targetStatus: "REJECTED", targetRoundId: null }
    case "WAITLIST":
      if (app.status === "WAITLISTED") throw new Error("This applicant is already waitlisted.")
      return { targetStatus: "WAITLISTED", targetRoundId: null }
    case "ACCEPT": return { targetStatus: "ACCEPTED", targetRoundId: null }
  }
}

/** What Advance will do for this applicant, for button labels and hints. */
export function advanceLabel(app: { status: string; roundId: string }, rounds: readonly StageRound[]) {
  try {
    const target = resolveStagedTarget(app, rounds, "ADVANCE")
    return target.targetRoundId ? `Advance to ${rounds.find(round => round.id === target.targetRoundId)?.name ?? "next round"}` : "Advance to Accepted"
  } catch { return "Advance" }
}

/** Short description of a staged decision: "Advance to Interview", "Reject", "Hold". */
export function stagedLabel(staged: Pick<StagedDecisionView, "outcome" | "targetStatus" | "targetRoundId"> & { targetRoundName?: string | null }, rounds: readonly { id: string; name: string }[]) {
  if (staged.targetRoundId) return `Advance to ${rounds.find(round => round.id === staged.targetRoundId)?.name ?? staged.targetRoundName ?? "another round"}`
  switch (staged.targetStatus) {
    case "ACCEPTED": return staged.outcome === "ADVANCE" ? "Advance to Accepted" : "Accept"
    case "REJECTED": return "Reject"
    case "WAITLISTED": return "Waitlist"
    default: return "Hold"
  }
}

/** A staged decision applies only to the state it was made against. */
export function stagedIsStale(staged: { expectedStatus: string; expectedRoundId: string }, app: { status: string; roundId: string }) {
  return staged.expectedStatus !== app.status || staged.expectedRoundId !== app.roundId
}
