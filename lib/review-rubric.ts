import { z } from "zod"

/**
 * Applicant review grading. A club lists 0–12 categories, each on its own scale (out of 5, 10, 100…).
 * A reviewer may score any of them; the overall is the equal-weight average of the scored categories,
 * normalized to 10 (7/10, 10/10 and 6/10 → 7.7), unless the reviewer overrides it.
 *
 * `Club.reviewRubric` NULL keeps the original behaviour: one "Overall" category out of 10. An empty list
 * turns grading off, leaving only Advance / Hold / Reject.
 *
 * Storage: the evaluation's canonical `score` stays 1–10 in half points (enforced by the database for every
 * evaluation, including the interview room), so the precise overall and each category score are kept beside
 * it in `Evaluation.rubricScores`.
 */
export const RUBRIC_MAX_CATEGORIES = 12
export const DEFAULT_OVERALL_CATEGORY_ID = "00000000-0000-4000-8000-00000000c010"
export const rubricScalePresets = [5, 10, 100] as const

export const rubricCategorySchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1, "Name each category.").max(60),
  max: z.number().int().min(1).max(100),
}).strict()
export type RubricCategory = z.infer<typeof rubricCategorySchema>

export const reviewRubricSchema = z.object({
  categories: z.array(rubricCategorySchema).max(RUBRIC_MAX_CATEGORIES)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, "Category IDs must be unique."),
}).strict()
export type ReviewRubric = z.infer<typeof reviewRubricSchema>

export const defaultReviewRubric: ReviewRubric = { categories: [{ id: DEFAULT_OVERALL_CATEGORY_ID, label: "Overall", max: 10 }] }

/** NULL or unreadable stored values fall back to the single Overall /10 category. */
export function normalizeReviewRubric(value: unknown): ReviewRubric {
  if (value == null) return defaultReviewRubric
  const parsed = reviewRubricSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultReviewRubric
}

export const rubricScoresSchema = z.object({
  categories: z.array(rubricCategorySchema.extend({ score: z.number().finite().min(0) })).max(RUBRIC_MAX_CATEGORIES)
    .refine(items => items.every(item => item.score <= item.max), "A category score is above its scale.")
    .refine(items => new Set(items.map(item => item.id)).size === items.length, "Category IDs must be unique."),
  overall: z.number().finite().min(0).max(10),
  overridden: z.boolean(),
}).strict()
export type RubricScores = z.infer<typeof rubricScoresSchema>

const tenth = (value: number) => Math.round(value * 10) / 10

/** Equal-weight average of the scored categories, out of 10, to one decimal. Null when nothing is scored. */
export function rubricOverall(scores: readonly { score: number; max: number }[]): number | null {
  const valid = scores.filter(item => Number.isFinite(item.score) && item.max > 0)
  if (!valid.length) return null
  return tenth(valid.reduce((sum, item) => sum + Math.min(1, Math.max(0, item.score / item.max)), 0) / valid.length * 10)
}

/** The canonical evaluation score: 1–10 in half points (the database rule for every evaluation). */
export function canonicalEvaluationScore(overall: number) {
  return Math.min(10, Math.max(1, Math.round(overall * 2) / 2))
}

/** Server check: the submitted overall matches the categories unless the reviewer overrode it. */
export function validateRubricScores(value: RubricScores, rubric: ReviewRubric) {
  for (const item of value.categories) {
    const category = rubric.categories.find(candidate => candidate.id === item.id)
    if (!category || category.max !== item.max) throw new Error("Grading categories changed. Reload before submitting.")
  }
  if (!value.overridden) {
    const computed = rubricOverall(value.categories)
    if (computed === null || Math.abs(computed - value.overall) > 0.051) throw new Error("The overall score does not match the category scores.")
  }
  return value
}

export const formatOverall = (value: number | null | undefined) => value == null ? "—" : (Math.round(value * 10) / 10).toFixed(1)
