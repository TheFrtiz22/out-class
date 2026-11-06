/** Student-facing labels only. Stored statuses and club-defined round names stay unchanged. */
export const applicationStatusLabels: Record<string, string> = {
  DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review",
  INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted",
}
const aliases: Record<string, string> = {
  DRAFT: "DRAFTING", DRAFTING: "DRAFTING", APPLIED: "SUBMITTED", REVIEW: "IN_REVIEW",
  INTERVIEW: "INTERVIEWING", "NOT SELECTED": "REJECTED", "NOT ACCEPTED": "REJECTED",
  // Legacy browser-tracker vocabulary (lib/data TrackerStatus).
  "DECISION PENDING": "IN_REVIEW", "1ST ROUND INTERVIEW": "INTERVIEWING", "2ND ROUND INTERVIEW": "INTERVIEWING",
}
export function applicationStatusCode(status: string) {
  const normalized = status.toUpperCase().replaceAll("_", " ")
  return aliases[normalized] || (normalized === "IN REVIEW" ? "IN_REVIEW" : status.toUpperCase())
}
export function applicationStatusLabel(status: string) {
  return applicationStatusLabels[applicationStatusCode(status)] || status
}

/** The six states a status pill may show. Every stored or legacy code maps to exactly one. */
export const applicationDisplayStates = ["Draft", "Submitted", "In review", "Interview", "Accepted", "Not accepted"] as const
export type ApplicationDisplayState = (typeof applicationDisplayStates)[number]
export type ApplicationStatusTone = "neutral" | "info" | "interview" | "warning" | "success" | "danger"
const displayStateByCode: Record<string, ApplicationDisplayState> = {
  DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review", INTERVIEWING: "Interview",
  // A waitlist is not an outcome: the decision is still open.
  WAITLISTED: "In review", ACCEPTED: "Accepted", REJECTED: "Not accepted",
}
const toneByState: Record<ApplicationDisplayState, ApplicationStatusTone> = {
  Draft: "neutral", Submitted: "neutral", "In review": "info", Interview: "interview", Accepted: "success", "Not accepted": "danger",
}
export type ApplicationDisplay = { code: string; state: ApplicationDisplayState; tone: ApplicationStatusTone; detail?: string }
/**
 * Presentation of a stored application status. The status passed in must already be the one the
 * audience is allowed to read: Application.status changes only when a decision is published, and
 * staged outcomes (voting results, scheduled decisions) never reach it, so a pill shows no more than
 * the published status. A published waitlist keeps its own word beside "In review".
 * Unknown codes fall back to "Submitted" so an unrecognised value can never read as an outcome.
 */
export function applicationDisplay(status: string): ApplicationDisplay {
  const code = applicationStatusCode(status)
  const state = displayStateByCode[code] ?? "Submitted"
  return { code, state, tone: code === "WAITLISTED" ? "warning" : toneByState[state], ...(code === "WAITLISTED" ? { detail: "Waitlisted" } : {}) }
}
export const isDraftStatus = (status: string) => applicationStatusCode(status) === "DRAFTING"
export const isClosedStatus = (status: string) => ["ACCEPTED", "REJECTED"].includes(applicationStatusCode(status))
