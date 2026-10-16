import type { ClubEvent, ManagedEvent } from "./data"
import { zonedInstant } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE, minuteLabel } from "@/lib/scheduling-config"
import { calendarEventFile } from "@/lib/ical"

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
  if (event.startTime) return new Date(event.startTime)
  const minutes = timeMinutes(event.time)
  try {
    return zonedInstant(event.date, `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`, SCHEDULING_TIMEZONE)
  } catch { return new Date(NaN) }
}
export function calendarFile(event: ClubEvent) {
  const start = eventStart(event)
  const end = event.endTime ? new Date(event.endTime) : new Date(start.getTime() + (event.durationMinutes ?? (event.type === "Deadline" ? 1 : 60)) * 60000)
  return calendarEventFile({ id: event.id, title: event.title, description: event.description ?? event.club, location: event.location ?? "", start, end, allDay: event.allDay })
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
    return dates.map((date) => ({ id: `managed-${event.id}-${date}`, managedEventId: event.id, clubId: event.clubId, date, day: Number(date.slice(-2)), title: event.title, club: event.clubId, color: "#051B3D", type: "Interest Meeting" as const, time: minuteLabel(timeMinutes(event.time)), location: event.location, meetingUrl: event.zoomLink, description: `${event.scope} club event${event.recurring ? " · Weekly recurring meeting" : ""}.` }))
  })
}

export function eventOccursOn(event: ClubEvent, day: string) {
  if (event.allDay && event.endTime) {
    const last = new Intl.DateTimeFormat("en-CA", { timeZone: SCHEDULING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.endTime));
    return event.date <= day && day < last;
  }
  return event.date === day;
}
