/** Board lanes describe student-visible statuses, never infer a status from a custom round name. */
export const applicantLanes = [
  { id: "review", title: "To Review", description: "Submitted and in review" },
  { id: "interview", title: "Interview", description: "Interview-stage applications" },
  { id: "decision", title: "Decision", description: "Waitlisted · outcome pending" },
  { id: "closed", title: "Closed", description: "Accepted or not selected" },
] as const
export function applicantLane(status: string): typeof applicantLanes[number]["id"] | null {
  if (status === "SUBMITTED" || status === "IN_REVIEW") return "review"
  if (status === "INTERVIEWING") return "interview"
  if (status === "WAITLISTED") return "decision"
  if (status === "ACCEPTED" || status === "REJECTED") return "closed"
  return null
}
