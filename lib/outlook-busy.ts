import { addDays, weekCells } from "@/lib/availability"
import { AVAILABILITY_END_SLOT, AVAILABILITY_FIRST_SLOT } from "@/lib/scheduling-config"

/** Busy intervals as UTC epoch milliseconds, [start, end). */
export type BusyInterval = [number, number]

/** NEXT_PUBLIC_ values are fixed at build time. The server also needs its client credentials. */
export const OUTLOOK_BUSY_ENABLED = process.env.NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED === "true"

export const OUTLOOK_BUSY_MESSAGE = "outclass:outlook-busy"
const MAX_INTERVALS = 500

export function validWeek(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(+new Date(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value && new Date(`${value}T12:00:00Z`).getUTCDay() === 1
}

export function validNonce(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(value)
}

/** A generous UTC window around the Eastern week; cells decide what counts. */
export function weekWindow(week: string) {
  return { start: new Date(`${addDays(week, -1)}T00:00:00Z`), end: new Date(`${addDays(week, 8)}T00:00:00Z`) }
}

/** Accepts only well-formed, bounded intervals from the popup message. */
export function parseBusy(value: unknown): BusyInterval[] | null {
  if (!Array.isArray(value) || value.length > MAX_INTERVALS) return null
  const result: BusyInterval[] = []
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2) return null
    const [start, end] = item
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000) return null
    result.push([start, end])
  }
  return result
}

/** Quarter hours in the editable 8 AM–9 PM window that overlap any busy interval. */
export function busyCellsForWeek(week: string, zone: string, busy: BusyInterval[]) {
  return weekCells(week, zone).map(day => day.map((cell, slot) =>
    slot >= AVAILABILITY_FIRST_SLOT && slot < AVAILABILITY_END_SLOT && cell.start !== null
      && busy.some(([start, end]) => start < cell.end! && end > cell.start!)))
}

/** Only removes availability; never adds it, and never touches hours outside the editor window. */
export function removeBusy(days: boolean[][], busy: boolean[][]) {
  const next = days.map((cells, day) => cells.map((on, slot) => on && !busy[day]?.[slot]))
  const changedDays = next.flatMap((cells, day) => cells.some((on, slot) => on !== days[day][slot]) ? [day] : [])
  const removed = next.reduce((total, cells, day) => total + cells.filter((on, slot) => on !== days[day][slot]).length, 0)
  return { next, changedDays, removed }
}
