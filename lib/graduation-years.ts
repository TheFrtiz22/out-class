import { z } from "zod"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

/**
 * Supported graduation years, relative to today's calendar year in Eastern Time.
 *
 * - Earliest: last year's class, so students finishing a delayed or December
 *   completion can still sign up and keep their profile.
 * - Latest: six years ahead, which covers next fall's incoming class, five-year
 *   programs and a gap year.
 *
 * The range is computed at call time (never at module load) so long-running
 * servers and cached bundles do not go stale. Server validation is authoritative;
 * the client uses the same helper only to build options and early messages.
 */
export const GRADUATION_YEARS_BEFORE = 1
export const GRADUATION_YEARS_AFTER = 6

export function easternCalendarYear(now: Date = new Date()) {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: SCHEDULING_TIMEZONE, year: "numeric" }).format(now)
  return Number(year)
}

export function graduationYearRange(now: Date = new Date()) {
  const year = easternCalendarYear(now)
  return { min: year - GRADUATION_YEARS_BEFORE, max: year + GRADUATION_YEARS_AFTER }
}

/** Ascending four-digit strings, ready for select options. */
export function graduationYearOptions(now: Date = new Date()) {
  const { min, max } = graduationYearRange(now)
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
}

export function isSupportedGraduationYear(value: number | string, now: Date = new Date()) {
  const year = typeof value === "number" ? value : /^\d{4}$/.test(value.trim()) ? Number(value) : NaN
  const { min, max } = graduationYearRange(now)
  return Number.isInteger(year) && year >= min && year <= max
}

export function graduationYearMessage(now: Date = new Date()) {
  const { min, max } = graduationYearRange(now)
  return `Choose a graduation year between ${min} and ${max}`
}

/** Zod number schema; the range is evaluated on every parse. */
export const graduationYearSchema = z.number().int().superRefine((year, ctx) => {
  const now = new Date()
  if (!isSupportedGraduationYear(year, now)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: graduationYearMessage(now) })
})
