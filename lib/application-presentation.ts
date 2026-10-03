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

export type StatusApplication = {
  status: string;
  round?: { id: string; name: string } | null;
  club: { pipelineRounds?: readonly { id: string; name: string; order: number }[] };
  bookings: readonly { roundId?: string | null; slot: { startTime: Date | string; endTime?: Date | string } }[];
}
export const isApplicationDecision = (status: string) => ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(status)

/** Round names are displayed as recorded, never interpreted as an application status. */
export function applicationStatusProgress(application: StatusApplication) {
  const rounds = [...(application.club.pipelineRounds ?? [])].sort((a, b) => a.order - b.order)
  if (application.round && !rounds.some(round => round.id === application.round!.id)) rounds.push({ ...application.round, order: rounds.length })
  const applied = rounds.find(round => /^(applied|applications?)$/i.test(round.name.trim()))
  const decision = rounds.find(round => /^decisions?$/i.test(round.name.trim()))
  const stages = [...(applied ? [] : [{ id: "submitted", name: "Applied" }]), ...rounds, ...(decision ? [] : [{ id: "decision", name: "Decision" }])]
  const current = isApplicationDecision(application.status) ? decision?.id || "decision" : application.round?.id || applied?.id || "submitted"
  return { stages, current }
}
export type StatusFilter = "All" | "Needs attention" | "Upcoming interviews" | "In progress" | "Decisions"
export function currentApplicationInterview<T extends { roundId?: string | null; slot: { startTime: Date | string; endTime?: Date | string } }>(application: { round?: { id: string } | null; bookings: readonly T[] }, now = Date.now()) {
  // Booking history from earlier rounds must not look like a booking for the current round.
  const bookings = application.bookings.filter(booking => !booking.roundId || !application.round || booking.roundId === application.round.id)
  const interview = relevantInterview(bookings, now)
  if (!interview) return null
  const end = interview.booking.slot.endTime
  return { ...interview, past: end && Number.isFinite(+new Date(end)) ? +new Date(end) <= now : interview.past }
}
export function applicationNeedsAttention(application: StatusApplication, now = Date.now()) {
  if (application.status !== "INTERVIEWING") return false
  const interview = currentApplicationInterview(application, now)
  // A past booking alone does not establish a new scheduling requirement.
  return !interview
}
export function applicationMatchesStatusFilter(application: StatusApplication, filter: StatusFilter, now = Date.now()) {
  if (application.status === "DRAFTING") return false
  if (filter === "Needs attention") return applicationNeedsAttention(application, now)
  if (filter === "Upcoming interviews") return !isApplicationDecision(application.status) && currentApplicationInterview(application, now)?.past === false
  if (filter === "Decisions") return isApplicationDecision(application.status)
  if (filter === "In progress") return !isApplicationDecision(application.status)
  return true
}
export function compareApplicationStatus(a: StatusApplication, b: StatusApplication, now = Date.now()) {
  const priority = (application: StatusApplication) => applicationNeedsAttention(application, now) ? 0 : isApplicationDecision(application.status) ? 3 : currentApplicationInterview(application, now)?.past === false ? 1 : 2
  const aInterview = currentApplicationInterview(a, now), bInterview = currentApplicationInterview(b, now)
  return priority(a) - priority(b) || (aInterview && !aInterview.past && bInterview && !bInterview.past ? +new Date(aInterview.booking.slot.startTime) - +new Date(bInterview.booking.slot.startTime) : 0)
}
