import { z } from "zod"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { zonedInputValue, zonedInstant } from "@/lib/interview-rooms"

/**
 * Application deadlines are Eastern Time, like interview scheduling. The browser sends the wall time it showed
 * (`YYYY-MM-DDTHH:MM`, Eastern) and the server resolves it with the same zonedInstant, so neither the browser's
 * nor the server's zone changes the instant. A full ISO instant (with `Z` or an offset) is also accepted, for
 * imports and stored values, and is used as is.
 */
const WALL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

export class DeadlineError extends Error {
  constructor(message: string) { super(message); this.name = "DeadlineError" }
}

const INVALID = "Choose a valid date and time."

/** The instant for a deadline value, or the message a person can act on. */
export function resolveDeadline(value: string, timezone = SCHEDULING_TIMEZONE): { at: Date; problem?: undefined } | { at?: undefined; problem: string } {
  if (INSTANT.test(value)) {
    const date = new Date(value)
    return Number.isNaN(+date) ? { problem: INVALID } : { at: date }
  }
  if (!WALL.test(value)) return { problem: INVALID }
  try {
    return { at: zonedInstant(value.slice(0, 10), value.slice(11, 16), timezone) }
  } catch {
    // zonedInstant refuses a malformed value and any wall time that does not name exactly one instant.
    const base = Date.parse(`${value}:00Z`)
    if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 16) !== value) return { problem: INVALID }
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" }).format(new Date(base))
    // Offsets in use around that day; a wall time matching two of them happens twice, matching none is skipped.
    const offsets = new Set([-86400000, 0, 86400000].map(delta => Date.parse(`${zonedInputValue(new Date(base + delta), timezone)}:00Z`) - base - delta))
    const matches = [...offsets].filter(offset => zonedInputValue(new Date(base - offset), timezone) === value).length
    return { problem: matches > 1 ? `This time happens twice on ${day}; pick another time.` : `This time doesn’t exist on ${day} (clocks move forward); pick another time.` }
  }
}

export const deadlineProblem = (value: string) => resolveDeadline(value).problem ?? null

/** The instant for a deadline value; throws DeadlineError (its message is the one above). */
export function deadlineInstant(value: string, timezone = SCHEDULING_TIMEZONE): Date {
  const result = resolveDeadline(value, timezone)
  if (result.problem !== undefined) throw new DeadlineError(result.problem)
  return result.at
}

/** The value to show in a `datetime-local` deadline field: the Eastern wall time of the stored instant. */
export function deadlineInputValue(value: Date | string | null | undefined, timezone = SCHEDULING_TIMEZONE) {
  return value ? zonedInputValue(value, timezone) : ""
}

/** Shared by the club and admin save schemas: an Eastern wall time or an ISO instant that resolves to one instant. */
export const deadlineInput = z.string().max(40).superRefine((value, ctx) => {
  const problem = deadlineProblem(value)
  if (problem) ctx.addIssue({ code: "custom", message: problem })
})
