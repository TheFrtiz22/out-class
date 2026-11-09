import type { AppTransactionClient } from "@/utils/prisma"
import type { FeedEvent } from "@/lib/ical"
import { ownPanelAssignments } from "@/utils/official-panel-schedule"

const HISTORY_MS = 30 * 24 * 3600000

/** The subscriber's own schedule only: their interview bookings, interview
 * panels they sit on, meetings of clubs they are an active member of, and
 * events they RSVP'd to. No other student's name or data is included. */
export async function calendarFeedEvents(tx: AppTransactionClient, userId: string, now = new Date()): Promise<FeedEvent[]> {
  const since = new Date(+now - HISTORY_MS)
  const memberClubs = (await tx.clubMember.findMany({ where: { userId, status: "ACTIVE", club: { suspendedAt: null } }, select: { clubId: true } })).map(m => m.clubId)
  const [bookings, meetings, rsvps, panels] = await Promise.all([
    tx.interviewBooking.findMany({ where: { application: { studentId: userId, club: { suspendedAt: null } }, slot: { endTime: { gte: since } } },
      select: { id: true, slot: { select: { startTime: true, endTime: true, location: true } }, application: { select: { club: { select: { name: true } } } } } }),
    memberClubs.length ? tx.meeting.findMany({ where: { clubId: { in: memberClubs }, OR: [{ date: { gte: since } }, { endDate: { gte: since } }] },
      select: { id: true, title: true, date: true, endDate: true, allDay: true, location: true, description: true, club: { select: { name: true } } } }) : [],
    tx.eventRsvp.findMany({ where: { userId, event: { club: { is: { suspendedAt: null } }, OR: [{ date: { gte: since } }, { endDate: { gte: since } }] } },
      select: { event: { select: { id: true, clubId: true, title: true, date: true, endDate: true, allDay: true, location: true, description: true, club: { select: { name: true } } } } } }),
    ownPanelAssignments(tx, userId),
  ])
  const events = new Map<string, FeedEvent>()
  for (const b of bookings) events.set(`booking-${b.id}`, { id: `booking-${b.id}`, title: `${b.application.club.name} interview`, description: "Your interview, booked on OutClass.", location: b.slot.location, start: b.slot.startTime, end: b.slot.endTime })
  const meeting = (m: { id: string; title: string; date: Date; endDate: Date | null; allDay: boolean; location: string; description: string | null; club: { name: string } | null }) =>
    events.set(`meeting-${m.id}`, { id: `meeting-${m.id}`, title: m.club ? `${m.title} · ${m.club.name}` : m.title, description: m.description ?? "", location: m.location, start: m.date, end: m.endDate ?? new Date(+m.date + 3600000), allDay: m.allDay })
  for (const m of meetings) meeting(m)
  for (const r of rsvps) meeting(r.event)
  for (const p of panels) if (+new Date(p.endTime) >= +since) events.set(`panel-${p.id}`, { id: `panel-${p.id}`, title: `${p.clubName} interview panel`, description: `${p.roundName} · ${p.roomName}`, location: p.location, start: new Date(p.startTime), end: new Date(p.endTime) })
  return [...events.values()].sort((a, b) => +a.start - +b.start)
}
