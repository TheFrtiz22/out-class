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

/** Board moves that publish no decision and send nothing: the card may move before the server confirms. */
export const optimisticBoardStatuses = ["IN_REVIEW", "INTERVIEWING"] as const
export function isOptimisticBoardMove(status: string) {
  return (optimisticBoardStatuses as readonly string[]).includes(status)
}
type BoardPage = { applications: { id: string; status: string }[]; facets?: { lanes?: Record<string, number> } | null }
/**
 * One applicant's status on a loaded page, with lane counts kept in step. With `expected`, it changes
 * only while the applicant still has that status, so a rollback never overwrites a newer read.
 */
export function withApplicantStatus<P extends BoardPage>(page: P | null, id: string, status: string, expected?: string): P | null {
  const app = page?.applications.find(item => item.id === id)
  if (!page || !app || app.status === status || expected !== undefined && app.status !== expected) return page
  const from = applicantLane(app.status), to = applicantLane(status), lanes = page.facets?.lanes
  const counts = lanes && from !== to ? { ...lanes, ...from ? { [from]: Math.max(0, (lanes[from] ?? 0) - 1) } : {}, ...to ? { [to]: (lanes[to] ?? 0) + 1 } : {} } : lanes
  return { ...page, applications: page.applications.map(item => item.id === id ? { ...item, status } : item), ...page.facets ? { facets: { ...page.facets, lanes: counts } } : {} }
}
