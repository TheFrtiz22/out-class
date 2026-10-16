import { eventStart } from "@/lib/calendar"
import type { ClubEvent, Notification } from "@/lib/data"
import { addDays, localParts } from "@/lib/availability"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

/** Local calendar boundaries, not fixed 24-hour intervals (DST-safe). */
export function agendaGroups(events: ClubEvent[], now: Date, includePast = false) {
  const today = localParts(now, SCHEDULING_TIMEZONE).date
  const tomorrow = addDays(today, 1), weekEnd = addDays(today, 7)
  const groups = new Map<string, ClubEvent[]>()
  const sorted = events
    .filter((event) => Number.isFinite(eventStart(event).getTime()))
    .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  for (const event of sorted) {
    const start = eventStart(event)
    const end = event.endTime ? +new Date(event.endTime) :
      start.getTime() + (event.durationMinutes ?? (event.type === "Deadline" ? 0 : 60)) * 60000
    const past = end < now.getTime()
    if (past && !includePast) continue
    const label = past
      ? "Earlier"
      : event.date === today || (event.allDay && event.date < today && !past)
        ? "Today"
        : event.date === tomorrow
          ? "Tomorrow"
          : event.date < weekEnd
            ? "Next 7 days"
            : "Later"
    groups.set(label, [...(groups.get(label) || []), event])
  }
  return ["Today", "Tomorrow", "Next 7 days", "Later", "Earlier"]
    .filter((label) => groups.has(label))
    .map((label) => ({ label, events: groups.get(label)! }))
}
export function notificationPriority(item: Notification) {
  // Use structured flags, never guess decisions or deadlines from message text.
  return item.urgent ? 0 : item.type === "Interview Invite" || item.locationChange ? 1 : 2
}
export function notificationGroups(items: Notification[], byClub: boolean, byPriority = true) {
  if (!byClub && !byPriority) return items.length ? [{ label: "All updates", items }] : []
  const groups = new Map<string, Notification[]>()
  for (const item of items) {
    const label = byClub
      ? item.club
      : notificationPriority(item) < 2
        ? "Recruitment & schedule updates"
        : "Club updates"
    groups.set(label, [...(groups.get(label) || []), item])
  }
  return [...groups].map(([label, items]) => ({ label, items }))
}
