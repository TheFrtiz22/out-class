/** Presentation only: a round name never changes an application's status. */
export function applicationInScope(application: { status: string; bookings: readonly unknown[] }, scope: "all" | "interviews" | "decisions") {
  if (scope === "interviews") return application.status === "INTERVIEWING" || application.bookings.length > 0
  if (scope === "decisions") return ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(application.status)
  return true
}
export function relevantInterview<T extends { slot: { startTime: Date | string } }>(bookings: readonly T[], now = Date.now()) {
  const dated = bookings.filter(b => Number.isFinite(+new Date(b.slot.startTime))).slice().sort((a, b) => +new Date(a.slot.startTime) - +new Date(b.slot.startTime))
  const next = dated.find(b => +new Date(b.slot.startTime) >= now)
  const booking = next || dated[dated.length - 1]
  return booking ? { booking, past: !next } : null
}
