import { activeMemberWhere } from "@/lib/permissions";
import type { AppTransactionClient } from "@/utils/prisma"
import type { FeedEvent } from "@/lib/ical"
import { ownPanelAssignments } from "@/utils/official-panel-schedule"
import { publicMeetingVisibility } from "@/lib/campus-events"

const HISTORY_MS = 30 * 24 * 3600000
/** Calendar apps poll this often: bound the window and the rows so a member of many large clubs gets a small, fast feed. */
const HORIZON_MS = 180 * 24 * 3600000
const MAX_ROWS = 500

/** The subscriber's own schedule only: their interview bookings, interview
 * panels they sit on, meetings of clubs they are an active member of, and
 * events they RSVP'd to. No other student's name or data is included. */
export async function calendarFeedEvents(tx: AppTransactionClient, userId: string, now = new Date()): Promise<FeedEvent[]> {
  const since = new Date(+now - HISTORY_MS), horizon = new Date(+now + HORIZON_MS)
  const memberClubs = (await tx.clubMember.findMany({ where: { userId, ...activeMemberWhere, club: { suspendedAt: null } }, select: { clubId: true } })).map(m => m.clubId)
  const [bookings, meetings, rsvps, panels] = await Promise.all([
    tx.interviewBooking.findMany({ where: { application: { studentId: userId, club: { suspendedAt: null } }, slot: { endTime: { gte: since }, startTime: { lte: horizon } } }, take: MAX_ROWS, orderBy: { slot: { startTime: "asc" } },
      select: { id: true, slot: { select: { startTime: true, endTime: true, location: true } }, application: { select: { club: { select: { name: true } } } } } }),
    memberClubs.length ? tx.meeting.findMany({ where: { clubId: { in: memberClubs }, date: { lte: horizon }, OR: [{ date: { gte: since } }, { endDate: { gte: since } }] }, take: MAX_ROWS, orderBy: { date: "asc" },
      select: { id: true, title: true, date: true, endDate: true, allDay: true, location: true, description: true, club: { select: { name: true } } } }) : [],
    // Same rule as the in-app calendar: a published public event, or any event of a club the subscriber is an active member of.
    tx.eventRsvp.findMany({ where: { userId, event: { AND: [{ OR: [publicMeetingVisibility, { club: { is: { suspendedAt: null, members: { some: { userId, ...activeMemberWhere } } } } }] }, { OR: [{ date: { gte: since } }, { endDate: { gte: since } }] }, { date: { lte: horizon } }] } }, take: MAX_ROWS,
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
