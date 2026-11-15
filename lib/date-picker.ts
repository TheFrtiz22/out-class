/**
 * Calendar math for the date picker, on plain YYYY-MM-DD strings so a picked day never
 * shifts with the browser's time zone. "Today" is the Eastern scheduling day by default.
 */
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

export const isIsoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
const toDate = (day: string) => new Date(`${day}T00:00:00Z`)
const toDay = (date: Date) => date.toISOString().slice(0, 10)

export function todayIn(timeZone = SCHEDULING_TIMEZONE, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now)
}
export function addDays(day: string, amount: number) {
  const date = toDate(day); date.setUTCDate(date.getUTCDate() + amount); return toDay(date)
}
/** Same day of the month in another month, clamped to that month's last day. */
export function addMonths(day: string, amount: number) {
  const date = toDate(day), target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), last)); return toDay(target)
}
export const monthOf = (day: string) => day.slice(0, 7)
/** Six Sunday-first weeks covering the month of `day`; days outside the month are included. */
export function monthGrid(day: string) {
  const first = toDate(`${monthOf(day)}-01`), start = addDays(toDay(first), -first.getUTCDay())
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, weekday) => addDays(start, week * 7 + weekday)))
}
export function formatDay(day: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(toDate(day))
}
/** A day key as a full heading, "Thursday, October 15, 2026": for day keys shown to people instead of raw ISO dates. */
export const formatLongDay = (day: string) => formatDay(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
/** Keyboard movement in the grid, following the WAI-ARIA date picker pattern. */
export function moveDay(day: string, key: string, shift = false) {
  switch (key) {
    case "ArrowLeft": return addDays(day, -1)
    case "ArrowRight": return addDays(day, 1)
    case "ArrowUp": return addDays(day, -7)
    case "ArrowDown": return addDays(day, 7)
    case "Home": return addDays(day, -toDate(day).getUTCDay())
    case "End": return addDays(day, 6 - toDate(day).getUTCDay())
    case "PageUp": return addMonths(day, shift ? -12 : -1)
    case "PageDown": return addMonths(day, shift ? 12 : 1)
    default: return null
  }
}
