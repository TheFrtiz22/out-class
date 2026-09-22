import type { ClubEvent } from "@/lib/data"
import { dateKey } from "@/lib/calendar"

type Timestamp = Date | string
type CalendarSource = {
  applications?: {
    clubId: string
    club: { name: string; color?: string | null }
    bookings?: {
      id: string
      slot: { startTime: Timestamp; endTime: Timestamp; location: string }
    }[]
  }[]
  attendances?: {
    id: string
    event: {
      clubId: string
      date: Timestamp
      title: string
      location: string
      description?: string | null
      club?: { name: string }
    }
  }[]
}
/** Preserve actual booking/attendance timestamps for Home and Calendar together. */
export function studentCalendarEvents(source?: CalendarSource | null): ClubEvent[] {
  const at = (value: Timestamp) => {
    const date = new Date(value)
    return {
      date: dateKey(date),
      day: date.getDate(),
      time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
    }
  }
  const attendances: ClubEvent[] = (source?.attendances || [])
    .filter((att) => Number.isFinite(new Date(att.event.date).getTime()))
    .map((att) => ({
      id: att.id,
      readOnly: true,
      clubId: att.event.clubId,
      ...at(att.event.date),
      title: att.event.title,
      club: att.event.club?.name || att.event.clubId,
      color: "#142d4e",
      type: "Other",
      location: att.event.location,
      description: att.event.description || undefined,
    }))
  const interviews: ClubEvent[] = (source?.applications || []).flatMap((app) =>
    (app.bookings || [])
      .filter((booking) => Number.isFinite(new Date(booking.slot.startTime).getTime()))
      .map((booking) => ({
        id: `booking-${booking.id}`,
        readOnly: true,
        clubId: app.clubId,
        ...at(booking.slot.startTime),
        title: `${app.club.name} interview`,
        club: app.club.name,
        color: app.club.color || "#142d4e",
        type: "Interview" as const,
        location: booking.slot.location,
        durationMinutes: Math.max(
          1,
          (new Date(booking.slot.endTime).getTime() - new Date(booking.slot.startTime).getTime()) /
            60000,
        ),
        response: "confirmed" as const,
      })),
  )
  return [...attendances, ...interviews]
}
