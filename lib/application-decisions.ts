/** Decision groups reflect persisted statuses, independently of recruitment rounds. */
export const decisionGroups = [
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "rejected", label: "Rejected" },
] as const
export type DecisionGroup = typeof decisionGroups[number]["id"]
export function applicationDecisionGroup(status: string): DecisionGroup | null {
  switch (status) {
    case "SUBMITTED": case "IN_REVIEW": case "INTERVIEWING": return "pending"
    case "ACCEPTED": return "accepted"
    case "WAITLISTED": return "waitlisted"
    case "REJECTED": return "rejected"
    default: return null
  }
}

/** The Applicants decision filter row: All plus each decision group. */
export const decisionFilters = [{ id: "all", label: "All" }, ...decisionGroups] as const
export type DecisionFilter = typeof decisionFilters[number]["id"]
export function decisionFilter(value: string | null | undefined): DecisionFilter {
  return decisionFilters.some(item => item.id === value) ? value as DecisionFilter : "all"
}
