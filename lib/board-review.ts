/** Summaries reflect application records, never simulated ballots or quotas. */
export function boardDecisionProgress(applicants: { status: string }[]) {
  const eligible = applicants.filter((app) => app.status !== "DRAFTING")
  const accepted = eligible.filter((app) => app.status === "ACCEPTED").length
  const rejected = eligible.filter((app) => app.status === "REJECTED").length
  return {
    total: eligible.length,
    accepted,
    rejected,
    remaining: eligible.length - accepted - rejected,
  }
}
