/** Recruiting insights computed from rows the caller already authorized.
 * Calibration compares each reviewer only with other reviewers on the same
 * applicant in the same round, so a reviewer who happened to see stronger
 * applicants is not labelled "lenient". Raw scores are never replaced. */
export type InsightEvaluation = { interviewerId: string; applicationId: string; roundId: string | null; score: number }
export type ReviewerCalibration = { memberId: string; scored: number; compared: number; offset: number | null }

export const MIN_COMPARISONS = 3

export function reviewerCalibration(evaluations: readonly InsightEvaluation[]): ReviewerCalibration[] {
  const groups = new Map<string, InsightEvaluation[]>()
  for (const e of evaluations) {
    if (!Number.isFinite(e.score)) continue
    const key = `${e.applicationId}:${e.roundId ?? ""}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const stats = new Map<string, { scored: number; deviations: number[] }>()
  for (const group of groups.values()) for (const e of group) {
    const entry = stats.get(e.interviewerId) ?? { scored: 0, deviations: [] }
    entry.scored++
    const others = group.filter(o => o.interviewerId !== e.interviewerId)
    if (others.length) entry.deviations.push(e.score - others.reduce((n, o) => n + o.score, 0) / others.length)
    stats.set(e.interviewerId, entry)
  }
  return [...stats].map(([memberId, s]) => ({
    memberId, scored: s.scored, compared: s.deviations.length,
    offset: s.deviations.length >= MIN_COMPARISONS ? Math.round(s.deviations.reduce((n, d) => n + d, 0) / s.deviations.length * 10) / 10 : null,
  })).sort((a, b) => Math.abs(b.offset ?? 0) - Math.abs(a.offset ?? 0) || b.scored - a.scored || (a.memberId < b.memberId ? -1 : 1))
}

export function calibrationLabel(offset: number | null) {
  if (offset === null) return "Not enough shared applicants yet"
  if (Math.abs(offset) < 0.5) return "In line with other panelists"
  return `Scores ${Math.abs(offset).toFixed(1)} ${offset > 0 ? "higher" : "lower"} than other panelists on the same applicants`
}

export type Funnel = { applied: number; interviewed: number; admitted: number; joined: number }
export function recruitingFunnel(apps: readonly { status: string; interviewed: boolean; offerAccepted: boolean }[]): Funnel {
  return {
    applied: apps.length,
    interviewed: apps.filter(a => a.interviewed).length,
    admitted: apps.filter(a => a.status === "ACCEPTED").length,
    joined: apps.filter(a => a.offerAccepted).length,
  }
}
