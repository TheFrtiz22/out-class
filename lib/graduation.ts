/**
 * Graduation and alumni lifecycle. Pure and browser-safe: the Home prompt, the profile year editor,
 * the apply check and the daily job (utils/graduation.ts) share these rules.
 *
 * - A student becomes alumni at StudentProfile.graduatedAt. With no answer, the job sets it to
 *   Aug 1, 00:00 America/New_York of gradYear. "Yes, I'm graduating" sets the same instant (or now,
 *   if Aug 1 has passed), so confirmed and unconfirmed students change over together and keep full
 *   student access through the summer.
 * - Home asks "Graduating this spring?" from April through July of gradYear (Eastern calendar).
 * - Alumni keep their account, profile, history, data export and account deletion; they cannot
 *   submit new applications. Their club memberships stay on rosters as Alumni (ClubMember.alumniSince)
 *   without club capabilities (lib/permissions.ts isActiveMembership).
 */
import { zonedInstant } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

export const GRADUATION_PROMPT_FIRST_MONTH = 4
export const GRADUATION_PROMPT_LAST_MONTH = 7
export const ALUMNI_APPLY_MESSAGE = "Congratulations on graduating. Alumni accounts can’t submit new applications; your past applications stay in your history."

type Instant = Date | string | number
export type GraduationProfile = {
  gradYear: number
  graduatedAt?: Instant | null
  graduationConfirmedAt?: Instant | null
  graduationPromptDismissedAt?: Instant | null
}

/** Aug 1, 00:00 in America/New_York (EDT) of the graduation year. */
export function graduationDefaultAt(gradYear: number): Date {
  return zonedInstant(`${String(gradYear).padStart(4, "0")}-08-01`, "00:00", SCHEDULING_TIMEZONE)
}

/** Calendar year and month (1–12) of an instant in the scheduling zone. */
export function easternYearMonth(now: Instant = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: SCHEDULING_TIMEZONE, year: "numeric", month: "numeric" }).formatToParts(new Date(now)).map(p => [p.type, p.value]))
  return { year: Number(parts.year), month: Number(parts.month) }
}

/** The latest graduation year whose Aug 1 default has passed at `now`. */
export function lastDefaultedGradYear(now: Instant = Date.now()) {
  const { year } = easternYearMonth(now)
  return +new Date(now) >= +graduationDefaultAt(year) ? year : year - 1
}

export function isAlumniProfile(profile: Pick<GraduationProfile, "graduatedAt"> | null | undefined, now: Instant = Date.now()) {
  return !!profile?.graduatedAt && +new Date(profile.graduatedAt) <= +new Date(now)
}

/** The Home prompt shows April–July of gradYear until the student answers or dismisses it. */
export function showGraduationPrompt(profile: GraduationProfile | null | undefined, now: Instant = Date.now()) {
  if (!profile || profile.graduatedAt || profile.graduationConfirmedAt || profile.graduationPromptDismissedAt) return false
  const { year, month } = easternYearMonth(now)
  return profile.gradYear === year && month >= GRADUATION_PROMPT_FIRST_MONTH && month <= GRADUATION_PROMPT_LAST_MONTH
}

/** "Yes" is accepted from April of gradYear on (and for any earlier year). */
export function canConfirmGraduation(profile: GraduationProfile, now: Instant = Date.now()) {
  if (isAlumniProfile(profile, now)) return false
  const { year, month } = easternYearMonth(now)
  return profile.gradYear < year || profile.gradYear === year && month >= GRADUATION_PROMPT_FIRST_MONTH
}

export function confirmedGraduationAt(gradYear: number, now: Instant = Date.now()) {
  const fallback = graduationDefaultAt(gradYear)
  return +fallback > +new Date(now) ? fallback : new Date(now)
}

/**
 * Profile fields to write when the student changes gradYear. A pending answer is cleared so the
 * prompt follows the new year. An alumnus whose status came from the Aug 1 default (never
 * confirmed) and who moves gradYear to a year whose Aug 1 is still ahead is restored to student;
 * `restoreAlumniSince` is then the alumniSince the job gave their memberships. Confirmed alumni
 * stay alumni.
 */
export function graduationYearChange(current: GraduationProfile, nextYear: number, now: Instant = Date.now()) {
  if (current.gradYear === nextYear) return null
  const reset = { graduatedAt: null, graduationConfirmedAt: null, graduationPromptDismissedAt: null }
  if (!isAlumniProfile(current, now)) return { data: reset, restoreAlumniSince: null }
  if (current.graduationConfirmedAt || +graduationDefaultAt(nextYear) <= +new Date(now)) return null
  return { data: reset, restoreAlumniSince: new Date(current.graduatedAt!) }
}
