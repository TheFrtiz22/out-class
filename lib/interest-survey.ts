import { z } from "zod"
import type { TimeCommitment } from "@/lib/data"

/**
 * The optional club-interest survey (onboarding's last step, the Home prompt, Settings → Interests).
 * Answers are private to the student: they are read only by the student's own session to rank public
 * directory clubs (lib/club-suggestions.ts) and are never part of applicant, club, export, search
 * index or support-view data. Ids are stored, so they are stable strings; labels can change freely.
 */

/**
 * Each chip maps to the public directory's categories and tags. `terms` are matched against the words
 * of a club's category and tags (lib/club-suggestions.ts interestTerms); `categories` match a whole
 * category or tag exactly, for one-word categories that are too generic to match by word ("Social").
 * Sources: lib/data.ts clubCategories (the profile editor's list), the Club.category default
 * ("Social"), the seeded directory entries ("Finance & Investing") and the categories leaders use
 * ("Academic", "Arts", "Business", "Finance"). tests/interest-survey.test.cjs checks every chip
 * matches at least one of them.
 */
export const INTEREST_CHIPS = [
  { id: "consulting", label: "Consulting", terms: ["consulting"] },
  { id: "finance", label: "Finance & investing", terms: ["finance", "investing", "investment", "banking", "accounting"] },
  { id: "business", label: "Business & startups", terms: ["business", "entrepreneurship", "startup", "startups", "venture", "marketing"] },
  { id: "tech", label: "Tech & engineering", terms: ["tech", "technology", "engineering", "software", "computing", "data", "coding"] },
  { id: "impact", label: "Social impact", terms: ["impact", "nonprofit", "philanthropy"] },
  { id: "pre-professional", label: "Pre-professional", terms: ["professional", "prelaw", "premed"] },
  { id: "greek", label: "Greek life", terms: ["greek", "fraternity", "sorority"] },
  { id: "sports", label: "Sports & recreation", terms: ["sports", "sport", "recreation", "athletics", "outdoors", "fitness"] },
  { id: "arts", label: "Arts & performance", terms: ["arts", "art", "music", "theater", "theatre", "dance", "cappella", "performing", "design"] },
  { id: "academic", label: "Academic & research", terms: ["academic", "research", "science", "honors"] },
  { id: "social", label: "Social", terms: [], categories: ["social"] },
] as const satisfies readonly { id: string; label: string; terms: readonly string[]; categories?: readonly string[] }[]

/**
 * What a student wants from a club. `phrase` completes "Because you want …". Leadership has no
 * directory category today, so it only matches clubs whose category or tags name it.
 */
export const CLUB_GOALS = [
  { id: "career", label: "Career", phrase: "career experience", terms: ["consulting", "finance", "investing", "banking", "business", "professional", "engineering", "tech", "technology", "entrepreneurship", "accounting", "marketing"] },
  { id: "community", label: "Community and friends", phrase: "community and friends", terms: ["greek", "cultural", "culture", "community", "fraternity", "sorority"], categories: ["social"] },
  { id: "service", label: "Service", phrase: "service", terms: ["service", "impact", "volunteer", "volunteering", "nonprofit", "philanthropy"] },
  { id: "creative", label: "Creative outlet", phrase: "a creative outlet", terms: ["arts", "art", "music", "theater", "theatre", "dance", "design", "creative", "media", "writing", "performing", "cappella"] },
  { id: "competition", label: "Competition", phrase: "competition", terms: ["sports", "sport", "competition", "competitive", "debate", "recreation", "athletics", "hackathon"] },
  { id: "leadership", label: "Leadership", phrase: "leadership", terms: ["leadership", "government", "council", "governance"] },
] as const satisfies readonly { id: string; label: string; phrase: string; terms: readonly string[]; categories?: readonly string[] }[]

export const WEEKLY_HOURS = [
  { id: "1-2", label: "1–2 hours" },
  { id: "3-5", label: "3–5 hours" },
  { id: "6+", label: "6+ hours" },
] as const
export const SELECTIVITY = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "either", label: "Either" },
] as const

export type InterestId = (typeof INTEREST_CHIPS)[number]["id"]
export type GoalId = (typeof CLUB_GOALS)[number]["id"]
export type WeeklyHours = (typeof WEEKLY_HOURS)[number]["id"]
export type Selectivity = (typeof SELECTIVITY)[number]["id"]

export const MAX_INTERESTS = 6
const interestIds = INTEREST_CHIPS.map(chip => chip.id) as [InterestId, ...InterestId[]]
const goalIds = CLUB_GOALS.map(goal => goal.id) as [GoalId, ...GoalId[]]
const hourIds = WEEKLY_HOURS.map(option => option.id) as [WeeklyHours, ...WeeklyHours[]]
const selectivityIds = SELECTIVITY.map(option => option.id) as [Selectivity, ...Selectivity[]]
const unique = <T,>(values: T[]) => new Set(values).size === values.length

/** The answers themselves. Every field is optional: an empty survey is a valid (cleared) one. */
export const interestAnswersSchema = z.object({
  interests: z.array(z.enum(interestIds)).max(MAX_INTERESTS).refine(unique, "Choose each interest once."),
  goals: z.array(z.enum(goalIds)).max(goalIds.length).refine(unique, "Choose each option once."),
  weeklyHours: z.enum(hourIds).nullable(),
  selectivity: z.enum(selectivityIds).nullable(),
}).strict()
/** A save from the signed-in student: their answers and the revision they loaded (0 before the first save). */
export const interestSurveySaveSchema = interestAnswersSchema.extend({ revision: z.number().int().nonnegative().max(1_000_000) }).strict()

export type InterestAnswers = z.infer<typeof interestAnswersSchema>
export type InterestSurveyDocument = InterestAnswers & { revision: number; completed: boolean; dismissed: boolean }
export const emptyInterestAnswers: InterestAnswers = { interests: [], goals: [], weeklyHours: null, selectivity: null }
export const answeredAny = (answers: InterestAnswers) => answers.interests.length > 0 || answers.goals.length > 0 || !!answers.weeklyHours || !!answers.selectivity

/** Stored rows are re-read through the schema's vocabulary, so a retired id is dropped, never shown or scored. */
export function readInterestAnswers(row: { interests?: readonly string[] | null; goals?: readonly string[] | null; weeklyHours?: string | null; selectivity?: string | null } | null | undefined): InterestAnswers {
  if (!row) return { ...emptyInterestAnswers }
  const known = <T extends string>(ids: readonly T[], values: readonly string[] | null | undefined) => [...new Set((values ?? []).filter((value): value is T => (ids as readonly string[]).includes(value)))]
  return {
    interests: known(interestIds, row.interests).slice(0, MAX_INTERESTS),
    goals: known(goalIds, row.goals),
    weeklyHours: (hourIds as readonly string[]).includes(row.weeklyHours ?? "") ? row.weeklyHours as WeeklyHours : null,
    selectivity: (selectivityIds as readonly string[]).includes(row.selectivity ?? "") ? row.selectivity as Selectivity : null,
  }
}

/** The directory's own time field (filter values "1-3" | "3-5" | "5+") closest to each answer. */
export const weeklyHoursCommitment: Record<WeeklyHours, TimeCommitment> = { "1-2": "1-3", "3-5": "3-5", "6+": "5+" }
/** A published acceptance rate at or below this percentage counts as selective. */
export const SELECTIVE_ACCEPTANCE_RATE = 25
