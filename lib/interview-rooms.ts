import { z } from "zod"

export const roomInputSchema = z.object({
  clubId: z.string().uuid(), roundId: z.string().uuid(),
  name: z.string().trim().min(1, "Name your room.").max(100),
  location: z.string().trim().min(1, "Add a room location or meeting link.").max(2000),
  kind: z.enum(["IN_PERSON", "VIRTUAL"]),
  timezone: z.string().refine(v => { try { new Intl.DateTimeFormat("en", { timeZone: v }); return true } catch { return false } }, "Choose a valid time zone."),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(14),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(5).max(180), buffer: z.number().int().min(0).max(60),
  capacity: z.number().int().min(1).max(20),
  panelMemberIds: z.array(z.string().uuid()).max(10).default([]),
}).refine(v => v.kind !== "VIRTUAL" || /^https:\/\//i.test(v.location) && (() => { try { return !!new URL(v.location).hostname } catch { return false } })(), { message: "Use a full https:// meeting link.", path: ["location"] })
export type RoomInput = z.infer<typeof roomInputSchema>
export type RoomSlot = { id: string; startTime: string; endTime: string; capacity: number; booked: number }
export type InterviewRoom = { approvedPanelMemberIds?: string[]; panelApprovedBy?: string | null; panelApprovalRevision?: number; id: string; clubId: string; roundId: string; name: string; location: string; kind: string; timezone: string; duration: number; buffer: number; isOpen: boolean; panelMemberIds: string[]; slots: RoomSlot[] }
export type RoomBooking = { id: string; applicationId: string; slotId: string; roomId: string; roundId: string; candidate: string; startTime: string; endTime: string; location: string }
export type RoomWorkspace = { clubName: string; rounds: { id: string; name: string; configuration?: unknown; type?: string }[]; members: { id: string; name: string }[]; rooms: InterviewRoom[]; bookings: RoomBooking[] }
export type ApplicantSchedule = { applicationId: string; clubName: string; roundName: string; rooms: InterviewRoom[]; booking: RoomBooking | null }

function wall(date: Date, timezone: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).map(p => [p.type, p.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
/** Resolve local wall time explicitly; reject nonexistent or ambiguous DST times. */
export function zonedInstant(date: string, time: string, timezone: string): Date {
  const target = `${date}T${time}`, base = new Date(`${target}:00Z`).getTime()
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 16) !== target) throw new Error("Choose a valid date and time.")
  const offsets = new Set([-86400000, 0, 86400000].map(delta => new Date(`${wall(new Date(base + delta), timezone)}:00Z`).getTime() - base - delta))
  const matches = [...offsets].map(offset => new Date(base - offset)).filter(d => wall(d, timezone) === target)
  if (matches.length !== 1) throw new Error("This time crosses a daylight-saving change. Choose another time.")
  return matches[0]
}
export function roomSlots(input: RoomInput, now = Date.now()) {
  const windows = [...new Set(input.dates)].sort().flatMap(date => {
    const start = zonedInstant(date, input.start, input.timezone), end = zonedInstant(date, input.end, input.timezone)
    if (+end <= +start) throw new Error("End time must be after start time on the same day.")
    if (+start <= now) throw new Error("Choose a future interview date and start time.")
    const slots = []
    for (let time = +start; time + input.duration * 60000 <= +end; time += (input.duration + input.buffer) * 60000) slots.push({ startTime: new Date(time), endTime: new Date(time + input.duration * 60000), capacity: input.capacity })
    if (!slots.length) throw new Error("Your time window must fit at least one interview.")
    return slots
  })
  if (windows.length > 500) throw new Error("Create up to 500 slots at a time. Shorten the time window or select fewer dates.")
  return windows
}
export function overlaps(a: { startTime: string | Date; endTime: string | Date }, b: { startTime: string | Date; endTime: string | Date }, buffer = 0) {
  return +new Date(a.startTime) < +new Date(b.endTime) + buffer * 60000 && +new Date(b.startTime) < +new Date(a.endTime) + buffer * 60000
}
export function dayKey(value: string | Date, timezone: string) { return wall(new Date(value), timezone).slice(0, 10) }
export function slotTime(value: string | Date, timezone: string) { return new Date(value).toLocaleTimeString([], { timeZone: timezone, hour: "numeric", minute: "2-digit" }) }
