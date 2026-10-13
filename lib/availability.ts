import { z } from "zod"
import { isActiveMembership } from "@/lib/permissions"

export const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const
export type MinuteRange = [number, number]
export type AvailabilitySchedule = { timezone: string; weekly: MinuteRange[][]; weeklySubmitted: boolean; exceptions: Record<string, MinuteRange[]> }
export type AvailabilityDocument = { schedule: AvailabilitySchedule; revision: number; accountId?: string }
export type AvailabilityState = "available" | "unavailable" | "unknown"

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && value <= "2200-12-31" && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
}
export const localDateSchema = z.string().refine(v => { try { return validDate(v) } catch { return false } }, "Choose a valid date.")
export const timezoneSchema = z.string().max(100).refine(v => { try { new Intl.DateTimeFormat("en", { timeZone: v }); return true } catch { return false } }, "Choose an IANA time zone.")
export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const result: MinuteRange[] = []
  for (const [start, end] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = result[result.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else result.push([start, end])
  }
  return result
}
const rangesSchema = z.array(z.tuple([z.number().int().min(0).max(1425).multipleOf(15), z.number().int().min(15).max(1440).multipleOf(15)])
  .refine(([a, b]) => b > a, "End must follow start.")).max(48).transform(mergeRanges)
export const availabilityScheduleSchema = z.object({
  timezone: timezoneSchema, weekly: z.array(rangesSchema).length(7), weeklySubmitted: z.boolean(),
  exceptions: z.record(rangesSchema).superRefine((v, ctx) => {
    if (Object.keys(v).length > 400 || Object.keys(v).some(key => !localDateSchema.safeParse(key).success)) ctx.addIssue({ code: "custom", message: "Use up to 400 valid exception dates." })
  }),
}).strict()
export const availabilitySaveSchema = z.object({ revision: z.number().int().nonnegative(), schedule: availabilityScheduleSchema, accountId: z.string().uuid().optional() }).strict()
export function emptySchedule(timezone = "America/New_York"): AvailabilitySchedule {
  return { timezone, weekly: Array.from({ length: 7 }, () => []), weeklySubmitted: false, exceptions: {} }
}
export function parseSchedule(raw: unknown): AvailabilitySchedule { return availabilityScheduleSchema.parse(raw) }
export function addDays(date: string, days: number) { return new Date(+new Date(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10) }
export function dayIndex(date: string) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 }
export function monday(date: string) { return addDays(date, -dayIndex(date)) }
export function dayRanges(schedule: AvailabilitySchedule, date: string): MinuteRange[] { return schedule.exceptions[date] ?? (schedule.weeklySubmitted ? schedule.weekly[dayIndex(date)] : []) }
export function dayKnown(schedule: AvailabilitySchedule, date: string) { return Object.hasOwn(schedule.exceptions, date) || schedule.weeklySubmitted }
export function rangesToCells(ranges: MinuteRange[]) { return Array.from({ length: 96 }, (_, i) => ranges.some(([a, b]) => i * 15 >= a && i * 15 < b)) }
export function cellsToRanges(cells: boolean[]): MinuteRange[] { return mergeRanges(cells.flatMap((on, i) => on ? [[i * 15, (i + 1) * 15] as MinuteRange] : [])) }

// Bounded formatter cache; no identities or schedules are cached across requests.
const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(zone: string) {
  let result = formatters.get(zone)
  if (!result) {
    result = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    if (formatters.size >= 32) formatters.clear()
    formatters.set(zone, result)
  }
  return result
}
export function localParts(instant: number | Date, zone: string) {
  const p = Object.fromEntries(formatter(zone).formatToParts(new Date(instant)).map(p => [p.type, p.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute) }
}
export function today(zone: string) { return localParts(new Date(), zone).date }
/** Check every minute and both boundaries: partial coverage never staffs a session. */
export function intervalAvailability(schedule: AvailabilitySchedule | null, start: number, end: number, parts = localParts): AvailabilityState {
  if (!schedule || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 7 * 86400000) return "unknown"
  let unknown = false
  for (let time = start; time < end; time = Math.min(end, Math.floor(time / 60000) * 60000 + 60000)) {
    const p = parts(time, schedule.timezone)
    if (!dayKnown(schedule, p.date)) unknown = true
    else if (!dayRanges(schedule, p.date).some(([a, b]) => p.minute >= a && p.minute < b)) return "unavailable"
  }
  return unknown ? "unknown" : "available"
}
export type WeekCell = { date: string; minute: number; start: number | null; end: number | null }
/** One wall-clock cell per quarter hour; gaps/folds are explicit, never guessed. */
export function weekCells(week: string, zone: string): WeekCell[][] {
  return Array.from({ length: 7 }, (_, day) => {
    const date = addDays(week, day), base = +new Date(`${date}T00:00:00Z`)
    const offsets = new Set([-86400000, 43200000, 172800000].map(delta => {
      const instant = base + delta, p = localParts(instant, zone)
      return +new Date(`${p.date}T00:00:00Z`) + p.minute * 60000 - instant
    }))
    return Array.from({ length: 96 }, (_, i) => {
      const minute = i * 15
      const candidates = [...offsets].map(offset => base + minute * 60000 - offset).filter(time => { const p = localParts(time, zone); return p.date === date && p.minute === minute })
      const start = candidates.length === 1 ? candidates[0] : null
      return { date, minute, start, end: start === null ? null : start + 900000 }
    })
  })
}
export function interviewerEligible(member: { status?: string; accessRole: string; interviewerEligible?: boolean | null; user?: { disabledAt?: unknown } }, roles: readonly string[], roundOverride?: boolean | null) {
  return isActiveMembership(member) && !member.user?.disabledAt && (roundOverride ?? member.interviewerEligible ?? roles.includes(member.accessRole))
}
export type AvailabilityResponse = "NOT_REQUESTED" | "AWAITING" | "SUBMITTED" | "DECLINED"
export const responseLabels: Record<AvailabilityResponse, string> = { NOT_REQUESTED: "Not requested", AWAITING: "Awaiting response", SUBMITTED: "Submitted", DECLINED: "Declined participation" }
export function availabilityResponse(value?: { confirmedAt?: unknown; declinedAt?: unknown; requestedAt?: unknown } | null): AvailabilityResponse {
  return value?.confirmedAt ? "SUBMITTED" : value?.declinedAt ? "DECLINED" : value?.requestedAt ? "AWAITING" : "NOT_REQUESTED"
}
export function availabilityHref(clubId?: string, roundId?: string) {
  return `/settings/availability${clubId && roundId ? `?clubId=${encodeURIComponent(clubId)}&roundId=${encodeURIComponent(roundId)}` : ""}`
}
export type AvailabilityRound = { id: string; clubId: string; clubName: string; name: string; confirmed: boolean; response: AvailabilityResponse; requested: boolean }
export type OverviewMember = { id: string; name: string; role: string; submitted: boolean; confirmed: boolean; response: AvailabilityResponse; canRemind: boolean; available: boolean[][] }
export type SessionCoverage = { id: string; roomId: string; roomName: string; startTime: string; endTime: string; required: number; assigned: number; active: boolean; availableMemberIds: string[] }
export type AvailabilityOverview = { week: string; timezone: string; members: OverviewMember[]; cells: WeekCell[][]; slots: SessionCoverage[] }

/** Serializable paint operation shared by pointer and keyboard editing. */
export function paintCells(days: boolean[][], from: { day: number; slot: number }, to: { day: number; slot: number }, on: boolean) {
  return days.map((cells, day) => cells.map((value, slot) => day >= Math.min(from.day, to.day) && day <= Math.max(from.day, to.day) && slot >= Math.min(from.slot, to.slot) && slot <= Math.max(from.slot, to.slot) ? on : value))
}
