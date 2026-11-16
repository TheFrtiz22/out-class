import type { AvailabilitySchedule } from "@/lib/availability"

/**
 * Weekly availability is required before a student continues into the signed-in workspace: new
 * signups meet it right after the onboarding interest survey, and existing accounts on their next
 * visit (components/availability/availability-gate.tsx). Clubs use it to find meeting times.
 *
 * The requirement is met by a saved UserAvailability row with at least one available time (recurring
 * week or a specific date), or by an explicit "I have no regular free time" declaration. An empty
 * save alone never meets it: painting and then clearing the grid autosaves an empty submitted week,
 * which is not a choice the student made. The declaration is stored as an audit row
 * (NO_REGULAR_AVAILABILITY_ACTION, actor and target = the student) because the schedule's database
 * shape is fixed; it stays valid until the account is deleted.
 *
 * Exempt: alumni (read-only accounts), active platform administrators, Demo Mode and support
 * (view-as) sessions. Pure and browser-safe; the database read is utils/availability-requirement.ts.
 */
export const NO_REGULAR_AVAILABILITY_ACTION = "availability.requirement.declare_none"
export const AVAILABILITY_REQUIRED_MESSAGE = "Mark at least one time you’re usually free, or confirm that you have no regular free time."

/** True when any day of the submitted recurring week, or any specific date, has an available time. */
export function scheduleHasAvailability(schedule: AvailabilitySchedule | null | undefined) {
  if (!schedule) return false
  return (schedule.weeklySubmitted && schedule.weekly.some(day => day.length > 0)) || Object.values(schedule.exceptions).some(ranges => ranges.length > 0)
}

export type AvailabilityRequirementAccount = {
  disabled: boolean
  platformAdmin: boolean
  /** Alumni accounts are read-only (lib/graduation.ts isAlumniProfile, decided by the loader). */
  alumni: boolean
  schedule: AvailabilitySchedule | null
  declaredNone: boolean
  /** The saved schedule's revision (0 before the first save), for the editor's conflict check. */
  revision?: number
}

export function availabilityRequirementExempt(account: Pick<AvailabilityRequirementAccount, "disabled" | "platformAdmin" | "alumni">) {
  // A disabled account is handled by its own notice; the gate never asks it for anything.
  return account.disabled || account.platformAdmin || account.alumni
}

export function availabilityRequirementMet(account: Pick<AvailabilityRequirementAccount, "schedule" | "declaredNone">) {
  return scheduleHasAvailability(account.schedule) || account.declaredNone
}

/** Server decision for the workspace gate; exported for tests. */
export async function availabilityGateDecision(deps: {
  demo: boolean
  impersonating: boolean
  userId: string | null
  load: (userId: string) => Promise<AvailabilityRequirementAccount | null>
}): Promise<"pass" | "ask"> {
  // Demo Mode has no live account; a support session must never be shown, or answer, the user's prompt.
  if (deps.demo || deps.impersonating || !deps.userId) return "pass"
  try {
    const account = await deps.load(deps.userId)
    if (!account || availabilityRequirementExempt(account)) return "pass"
    return availabilityRequirementMet(account) ? "pass" : "ask"
  } catch (error) {
    // A database fault must not take the product down; the next request asks again.
    console.error("Availability requirement check failed", error instanceof Error ? error.name : "unknown")
    return "pass"
  }
}
