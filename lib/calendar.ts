import type { ClubEvent, ManagedEvent } from "./data"

export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
export const dateFromKey = (value: string) => new Date(`${value}T12:00:00`)
export function timeMinutes(time: string) {
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return 0
  let hour = Number(match[1])
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0)
  return hour * 60 + Number(match[2])
}
export function eventStart(event: ClubEvent) {
  const date = dateFromKey(event.date)
  date.setHours(0, timeMinutes(event.time), 0, 0)
  return date
}
export function calendarFile(event: ClubEvent) {
  const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;")
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const start = eventStart(event)
  const end = new Date(start.getTime() + (event.durationMinutes ?? (event.type === "Deadline" ? 1 : 60)) * 60000)
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OutClass//Calendar//EN", "BEGIN:VEVENT", `UID:${event.id}@outclass`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description ?? event.club)}`, `LOCATION:${escape(event.location ?? "")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n")
}
export function managedOccurrences(events: ManagedEvent[], from: Date, to: Date, memberClubIds: Set<string>): ClubEvent[] {
  return events.flatMap((event) => {
    if (event.scope === "Members Only" && !memberClubIds.has(event.clubId)) return []
    const dates: string[] = []
    if (event.recurring) {
      const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].findIndex((day) => event.date.includes(day))
      if (weekday < 0) return []
      for (let day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) if (day.getDay() === weekday) dates.push(dateKey(day))
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(event.date)) dates.push(event.date)
    return dates.map((date) => ({ id: `managed-${event.id}-${date}`, managedEventId: event.id, clubId: event.clubId, date, day: Number(date.slice(-2)), title: event.title, club: event.clubId, color: "#051B3D", type: "Interest Meeting" as const, time: event.time, location: event.location, meetingUrl: event.zoomLink, description: `${event.scope} club event${event.recurring ? " · Weekly recurring meeting" : ""}.` }))
  })
}
