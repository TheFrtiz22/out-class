import type { ClubEvent } from "@/lib/data"
import { localParts } from "@/lib/availability"
import { SCHEDULING_TIMEZONE, minuteLabel } from "@/lib/scheduling-config"

type Timestamp = Date | string
export type CalendarSource = {
  panelAssignments?: {id:string;clubId:string;clubName:string;roundName:string;roomName:string;startTime:Timestamp;endTime:Timestamp;location:string}[]
  meetings?: { id: string; clubId: string; date: Timestamp; title: string; location: string; description?: string | null; audience: string; club: { name: string } }[]
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
      id?: string
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
    const parts = localParts(date, SCHEDULING_TIMEZONE)
    return {
      startTime: date.toISOString(),
      date: parts.date,
      day: Number(parts.date.slice(-2)),
      time: minuteLabel(parts.minute),
    }
  }
  const attendances: ClubEvent[] = (source?.attendances || [])
    .filter((att) => Number.isFinite(new Date(att.event.date).getTime()) && !source?.meetings?.some(m => m.id === att.event.id))
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
  const meetings: ClubEvent[] = (source?.meetings || []).map(m => ({ id: `meeting-${m.id}`, readOnly: true, clubId: m.clubId, ...at(m.date), title: m.title, club: m.club.name, color: "#142d4e", type: m.audience === "RECRUITMENT" ? "Interest Meeting" : "Other", location: m.location, description: m.description || undefined }))
  const panels: ClubEvent[]=(source?.panelAssignments??[]).map(s=>({id:`panel-${s.id}`,readOnly:true,clubId:s.clubId,...at(s.startTime),title:`${s.clubName} interview panel`,club:s.clubName,color:"#142d4e",type:"Interview",location:s.location,description:`${s.roundName} · ${s.roomName}`,durationMinutes:Math.max(1,(+new Date(s.endTime)-+new Date(s.startTime))/60000),response:"confirmed"}))
  return [...meetings, ...attendances, ...interviews, ...panels]
}
