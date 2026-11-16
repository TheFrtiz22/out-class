import { AVAILABILITY_END_SLOT, AVAILABILITY_FIRST_SLOT, SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { addDays, dayKnown, dayRanges, intervalAvailability, localParts, monday, type AvailabilitySchedule, type AvailabilityState, type WeekCell } from "@/lib/availability"

/**
 * "Find a meeting time": how many of a club's active members are free for a whole meeting starting at
 * each quarter hour of a week (Eastern, 8 AM–9 PM), from each member's saved weekly availability.
 * The server returns counts only; who is free or busy at one chosen time is a separate read that
 * returns names only (never contact details or anyone's full week). Pure and browser-safe.
 */
export const MEETING_DURATIONS = [30, 45, 60, 90, 120] as const
export type MeetingDuration = (typeof MEETING_DURATIONS)[number]
export const DEFAULT_MEETING_DURATION: MeetingDuration = 60
export const durationLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`

/**
 * Weeks a leader can plan: this week (Eastern) through MEETING_PLANNER_WEEKS_AHEAD weeks ahead. Planning
 * never needs the past or the far future, and the bound keeps repeated roster reads from rebuilding
 * members' weeks across the calendar.
 */
export const MEETING_PLANNER_WEEKS_AHEAD = 8
export function plannerWeekRange(now: Date | number = Date.now()) {
  const first = monday(localParts(+new Date(now), SCHEDULING_TIMEZONE).date)
  return { first, last: addDays(first, 7 * MEETING_PLANNER_WEEKS_AHEAD) }
}
/** The Monday of `week` when it is a plannable week, else null. */
export function plannerWeek(week: string, now: Date | number = Date.now()) {
  const start = monday(week), { first, last } = plannerWeekRange(now)
  return start >= first && start <= last ? start : null
}
export const PLANNER_WEEK_MESSAGE = `Choose a week from this week to ${MEETING_PLANNER_WEEKS_AHEAD} weeks ahead.`

export type MeetingPlannerHeatmap = { week: string; duration: number; members: number; withAvailability: number; free: number[][] }
export type MeetingSlotRoster = { date: string; start: number; end: number; free: string[]; busy: string[]; unknown: string[] }

/** One member's state for every quarter-hour cell of the week (7 × 96). */
export function memberCellStates(schedule: AvailabilitySchedule | null, cells: WeekCell[][], parts = localParts): AvailabilityState[][] {
  return cells.map(day => day.map(cell => {
    if (!schedule || cell.start === null || cell.end === null) return "unknown"
    if (schedule.timezone === SCHEDULING_TIMEZONE) {
      // Eastern schedules store wall-clock minutes: read the cell's own date and minute directly.
      if (!dayKnown(schedule, cell.date)) return "unknown"
      return dayRanges(schedule, cell.date).some(([a, b]) => cell.minute >= a && cell.minute < b) ? "available" : "unavailable"
    }
    return intervalAvailability(schedule, cell.start, cell.end, parts)
  }))
}

/** A meeting of `slots` quarter hours starting at `slot`; null when it would leave the 8 AM–9 PM window. */
export function windowState(day: readonly AvailabilityState[], slot: number, slots: number): AvailabilityState | null {
  if (!Number.isInteger(slot) || slots < 1 || slot < AVAILABILITY_FIRST_SLOT || slot + slots > AVAILABILITY_END_SLOT) return null
  let unknown = false
  for (let i = slot; i < slot + slots; i++) {
    const state = day[i]
    if (state === "unavailable") return "unavailable"
    if (state !== "available") unknown = true
  }
  return unknown ? "unknown" : "available"
}

export const durationSlots = (minutes: number) => Math.ceil(minutes / 15)

/** Free-member count for each start time; 0 outside the window or where the meeting would not fit. */
export function plannerFreeCounts(members: readonly AvailabilityState[][][], minutes: number): number[][] {
  const length = durationSlots(minutes)
  return Array.from({ length: 7 }, (_, day) => Array.from({ length: 96 }, (_, slot) =>
    members.reduce((sum, states) => sum + Number(windowState(states[day], slot, length) === "available"), 0)))
}

/** Names only, sorted: who is free, busy, or has no availability for this meeting time. */
export function slotRoster(members: readonly { name: string; states: AvailabilityState[][] }[], day: number, slot: number, minutes: number) {
  const free: string[] = [], busy: string[] = [], unknown: string[] = []
  for (const member of members) {
    const state = windowState(member.states[day] ?? [], slot, durationSlots(minutes))
    if (state === null) continue
    ;(state === "available" ? free : state === "unavailable" ? busy : unknown).push(member.name)
  }
  const sort = (names: string[]) => names.sort((a, b) => a.localeCompare(b))
  return { free: sort(free), busy: sort(busy), unknown: sort(unknown) }
}

/** The best few non-overlapping start times by free members (ties: earlier first), for quick picks. */
export function bestMeetingTimes(free: number[][], minutes: number, limit = 3) {
  const all: { day: number; slot: number; count: number }[] = [], length = durationSlots(minutes)
  free.forEach((slots, day) => slots.forEach((count, slot) => { if (count > 0) all.push({ day, slot, count }) }))
  const picked: typeof all = []
  for (const candidate of all.sort((a, b) => b.count - a.count || a.day - b.day || a.slot - b.slot)) {
    if (picked.length >= limit) break
    if (!picked.some(p => p.day === candidate.day && Math.abs(p.slot - candidate.slot) < length)) picked.push(candidate)
  }
  return picked
}
