/** Student-facing labels only. Stored statuses and club-defined round names stay unchanged. */
export const applicationStatusLabels: Record<string, string> = {
  DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review",
  INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted",
}
const aliases: Record<string, string> = {
  DRAFT: "DRAFTING", DRAFTING: "DRAFTING", APPLIED: "SUBMITTED", REVIEW: "IN_REVIEW",
  INTERVIEW: "INTERVIEWING", "NOT SELECTED": "REJECTED",
}
export function applicationStatusCode(status: string) {
  const normalized = status.toUpperCase().replaceAll("_", " ")
  return aliases[normalized] || (normalized === "IN REVIEW" ? "IN_REVIEW" : status.toUpperCase())
}
export function applicationStatusLabel(status: string) {
  return applicationStatusLabels[applicationStatusCode(status)] || status
}
