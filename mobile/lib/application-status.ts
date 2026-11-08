/** Copy of the web's lib/application-status.ts student-facing labels. Keep in step. */
export const applicationStatusLabels: Record<string, string> = {
  DRAFTING: "Draft", SUBMITTED: "Submitted", IN_REVIEW: "In review",
  INTERVIEWING: "Interview", ACCEPTED: "Accepted", REJECTED: "Not selected", WAITLISTED: "Waitlisted",
};
export function applicationStatusLabel(status: string) {
  return applicationStatusLabels[status.toUpperCase()] || status;
}
