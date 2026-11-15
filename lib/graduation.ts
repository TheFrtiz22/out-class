/**
 * Graduation and alumni lifecycle. Pure and browser-safe: the Home prompt, the profile year editor,
 * the apply check and the daily job (utils/graduation.ts) share these rules.
 *
 * - A student becomes alumni at StudentProfile.graduatedAt. With no answer, the job sets it to
 *   Aug 1, 00:00 America/New_York of gradYear. "Yes, I'm graduating" sets the same instant (or now,
 *   if Aug 1 has passed), so confirmed and unconfirmed students change over together and keep full
 *   student access through the summer.
 * - Home asks "Graduating this spring?" from April through July of gradYear (Eastern calendar).
 * - Alumni can sign in and see their own account, profile and history, export their data and delete
 *   their account. They cannot do anything active: apply (drafts included), RSVP (public events
 *   included), check in, vote, accept an offer or invitation. Each server action refuses with a
 *   friendly message (ALUMNI_REFUSALS, utils/graduation.ts assertNotAlumni) and the UI hides those
 *   controls. Their club memberships stay on rosters as Alumni (ClubMember.alumniSince) without club
 *   capabilities (lib/permissions.ts isActiveMembership), so member announcements do not reach them.
 * - "Yes, I'm graduating" may add where they are going to work (StudentProfile.postGradEmployer and
 *   postGradRole). The employer name alone, never the student's name, is added to the "Where members
 *   go" placements of each club they were a member of, unless they opt out (alumniPlacementShare).
 *   Current members of those clubs see name, email, employer, role and class year in the club's
 *   Alumni tab unless they opt out (alumniDirectoryVisible).
 */
import { z } from "zod"
import { zonedInstant } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

export const GRADUATION_PROMPT_FIRST_MONTH = 4
export const GRADUATION_PROMPT_LAST_MONTH = 7
export const ALUMNI_APPLY_MESSAGE = "Congratulations on graduating. Alumni accounts can’t submit new applications; your past applications stay in your history."
/** Server refusals for alumni, one per active feature. Shown as written (ActionError / { ok: false }). */
export const ALUMNI_REFUSALS = {
  apply: ALUMNI_APPLY_MESSAGE,
  rsvp: "Alumni accounts can’t RSVP to events. Your past RSVPs stay in your history.",
  checkIn: "Alumni accounts can’t check in to meetings. Your past attendance stays in your history.",
  vote: "Alumni accounts can’t vote. Your vote was not recorded.",
  join: "Alumni accounts can’t join clubs. Your past memberships stay in your history.",
} as const
export type AlumniAction = keyof typeof ALUMNI_REFUSALS
export const ALUMNI_REFUSED = "ALUMNI_ACCOUNT"

/** Matches the "Where members go" placement limit (lib/club-marketing.ts placements: text(100), 20 entries). */
export const POST_GRAD_TEXT_MAX = 100
export const PLACEMENT_LIMIT = 20
const postGradText = (label: string) => z.preprocess(
  value => typeof value === "string" ? value.replace(/\s+/g, " ").trim() || null : value ?? null,
  z.string()
    .max(POST_GRAD_TEXT_MAX, `Use ${POST_GRAD_TEXT_MAX} characters or fewer for the ${label}.`)
    // Names only: no links, email addresses or control characters on a public club page.
    .refine(v => !/[\u0000-\u001f\u007f<>]/.test(v) && !/(?:https?:|www\.|@)/i.test(v), `Enter just the ${label}, without links or email addresses.`)
    .nullable(),
)
/** "Where are you going to work?" (optional) and the two alumni privacy choices (default on). */
export const postGradDetailsSchema = z.object({
  employer: postGradText("employer name"),
  role: postGradText("role"),
  showInAlumniList: z.boolean().default(true),
  shareEmployer: z.boolean().default(true),
}).strict()
export type PostGradDetails = z.infer<typeof postGradDetailsSchema>

/** Case- and spacing-insensitive key, so "Goldman Sachs" and " goldman  sachs" are one placement. */
export const placementKey = (name: string) => name.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US")

/**
 * Appends an employer to a club's placements (company name only). Returns null when nothing
 * changes: already listed (any case), blank, or the list is full (leader entries are never evicted).
 */
export function mergePlacement(placements: unknown, employer: string | null | undefined): string[] | null {
  const name = (employer ?? "").replace(/\s+/g, " ").trim().slice(0, POST_GRAD_TEXT_MAX)
  if (!name) return null
  const list = Array.isArray(placements) ? placements.filter((p): p is string => typeof p === "string") : []
  if (list.some(p => placementKey(p) === placementKey(name)) || list.length >= PLACEMENT_LIMIT) return null
  return [...list, name]
}

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
