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
 * Profile edits also accept the year already stored for that user, so accounts
 * whose year has fallen out of range (alumni) can still save. New profiles
 * (onboarding) get the strict range.
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

/** Ascending four-digit strings, ready for select options. `stored` adds the year already on file. */
export function graduationYearOptions(now: Date = new Date(), stored?: number | null) {
  const { min, max } = graduationYearRange(now)
  const years = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  if (typeof stored === "number" && Number.isInteger(stored) && !years.includes(stored)) years.push(stored)
  return years.sort((a, b) => a - b).map(String)
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

/** In range, or unchanged from the year already stored for this user. */
export function isAcceptedGraduationYear(year: number, stored?: number | null, now: Date = new Date()) {
  return isSupportedGraduationYear(year, now) || (Number.isInteger(year) && typeof stored === "number" && year === stored)
}

/** Zod number schema; the range is evaluated on every parse. Pass the stored year only for edits. */
export function graduationYearSchemaFor(stored?: number | null) {
  return z.number().int().superRefine((year, ctx) => {
    const now = new Date()
    if (!isAcceptedGraduationYear(year, stored, now)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: graduationYearMessage(now) })
  })
}

/** Strict range, for new profiles and anywhere no stored year applies. */
export const graduationYearSchema = graduationYearSchemaFor(null)
