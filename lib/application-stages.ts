/**
 * The four application stages, shared by the Home "Your applications" card and the
 * Applications page tabs so both count the same way. Accepts the stored status
 * (`IN_REVIEW`) or the Home display label (`In Review`).
 */
export const applicationStages = [
  { id: "drafts", label: "Drafts" },
  { id: "in-review", label: "In review" },
  { id: "interviews", label: "Interviews" },
  { id: "decisions", label: "Decisions" },
] as const
export type ApplicationStage = typeof applicationStages[number]["id"]

const stageByStatus: Record<string, ApplicationStage> = {
  DRAFTING: "drafts", Drafting: "drafts",
  SUBMITTED: "in-review", Submitted: "in-review", IN_REVIEW: "in-review", "In Review": "in-review",
  INTERVIEWING: "interviews", Interviewing: "interviews",
  ACCEPTED: "decisions", Accepted: "decisions", REJECTED: "decisions", Rejected: "decisions", WAITLISTED: "decisions", Waitlisted: "decisions",
}
export function applicationStage(status: string): ApplicationStage | null {
  return stageByStatus[status] ?? null
}
export function stageCounts(statuses: string[]): Record<ApplicationStage, number> {
  const counts = { drafts: 0, "in-review": 0, interviews: 0, decisions: 0 } as Record<ApplicationStage, number>
  for (const status of statuses) { const stage = applicationStage(status); if (stage) counts[stage]++ }
  return counts
}
export function isApplicationStage(value: string | null | undefined): value is ApplicationStage {
  return applicationStages.some(stage => stage.id === value)
}
/** `?tab=` when given; otherwise Drafts if there are any, else the first stage with applications. */
export function initialApplicationStage(requested: string | null | undefined, counts: Record<ApplicationStage, number>, options: { submittedOnly?: boolean } = {}): ApplicationStage {
  if (isApplicationStage(requested)) return requested
  const candidates = applicationStages.filter(stage => !options.submittedOnly || stage.id !== "drafts")
  return candidates.find(stage => counts[stage.id] > 0)?.id ?? candidates[0].id
}
