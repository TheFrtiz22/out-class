export type DashboardUrgency = "urgent" | "soon" | "information" | "healthy" | "unavailable"
/** Work volume alone never establishes urgency. All dates come from stored deadlines. */
export function dashboardDeadlineState(dueAt: Date | string | null, outstanding: boolean, now: number, available = true): DashboardUrgency {
  if (!available) return "unavailable"
  if (!outstanding) return "healthy"
  if (!dueAt || !Number.isFinite(+new Date(dueAt))) return "information"
  const remaining = +new Date(dueAt) - now
  return remaining < 0 ? "urgent" : remaining <= 2 * 86400000 ? "soon" : "information"
}
