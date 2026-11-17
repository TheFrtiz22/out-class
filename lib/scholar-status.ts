import { z } from "zod";

export const scholarPrograms = ["ECHOLS", "JEFFERSON", "WALENTAS", "COLLEGE_SCIENCE", "RODMAN", "MILLER_ARTS", "CORE"] as const;
// Historical designations remain valid so editing education never destroys existing data.
export const scholarSelections = [...scholarPrograms, "NOT_APPLICABLE", "OTHER"] as const;
export const scholarLabels = { JEFFERSON: "Jefferson Scholars Program", WALENTAS: "Walentas Scholar", ECHOLS: "Echols Scholars Program", RODMAN: "Rodman Scholars Program", COLLEGE_SCIENCE: "College Science Scholars Program", MILLER_ARTS: "Miller Arts Scholars Program", CORE: "CORE Scholars Program", NOT_APPLICABLE: "Not Applicable", OTHER: "Other" };
export function scholarNames(value: unknown): string[] {
  const parsed = scholarStatusSchema.safeParse(value);
  return parsed.success && parsed.data ? parsed.data.selections.filter(v => v !== "NOT_APPLICABLE").map(v => v === "OTHER" ? parsed.data!.other : scholarLabels[v]) : [];
}
export function toggleScholar(value: unknown, selection: typeof scholarSelections[number], checked: boolean) {
  // Other may be temporarily blank while editing; validate on submission.
  const current = value && typeof value === "object" && "selections" in value && Array.isArray(value.selections) ? value as { selections: typeof scholarSelections[number][]; other?: string } : { selections: [], other: "" };
  const selections = checked ? selection === "NOT_APPLICABLE" ? [selection] : [...current.selections.filter(v => v !== "NOT_APPLICABLE" && v !== selection), selection] : current.selections.filter(v => v !== selection);
  return selections.length ? { selections, other: selections.includes("OTHER") ? current.other || "" : "" } : null;
}
export const scholarStatusSchema = z.object({
  selections: z.array(z.enum(scholarSelections)).min(1).max(9),
  other: z.string().trim().max(200).default(""),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.selections).size !== v.selections.length || (v.selections.includes("NOT_APPLICABLE") && v.selections.length !== 1))
    ctx.addIssue({ code: "custom", message: "Not Applicable must stand alone; choose each status once." });
  if (v.selections.includes("OTHER") && !v.other)
    ctx.addIssue({ code: "custom", message: "Describe Other scholar status." });
}).transform(v => ({ ...v, other: v.selections.includes("OTHER") ? v.other : "" })).nullable();

/** Leader filter on scholar status: a scholar, answered "No", or never answered. */
export const scholarFilterStates = ["scholar", "none", "unknown"] as const;
export type ScholarFilterState = typeof scholarFilterStates[number];
export const scholarFilterLabels: Record<ScholarFilterState, string> = { scholar: "Scholars only", none: "Not a scholar", unknown: "Not provided" };
/** Programs a leader can filter by: every current program plus Other. */
export const scholarFilterPrograms = [...scholarPrograms, "OTHER"] as const;
export type ScholarFilterProgram = typeof scholarFilterPrograms[number];

type ScholarStatus = NonNullable<z.infer<typeof scholarStatusSchema>>;
/** The validated stored value, or null when unanswered or unreadable. Never passes other keys through. */
export function scholarStatusValue(value: unknown): ScholarStatus | null {
  const parsed = scholarStatusSchema.safeParse(value ?? null);
  return parsed.success ? parsed.data : null;
}
/** "Not Applicable" means the student answered No; null means they never answered. */
export function scholarState(value: unknown): ScholarFilterState {
  const status = scholarStatusValue(value);
  return !status ? "unknown" : status.selections.some(v => v !== "NOT_APPLICABLE") ? "scholar" : "none";
}
/** Scholars first, then "Not a scholar", then "Not provided". */
export function scholarRank(value: unknown) {
  return scholarFilterStates.indexOf(scholarState(value));
}
/**
 * One applicant against the scholar filter. `known` is false when the viewer may not see the
 * applicant's profile (anonymous review): such an applicant matches only when no scholar filter is set.
 * Choosing programs implies "Scholars only" and matches any of the chosen programs.
 */
export function matchesScholarFilter(value: unknown, known: boolean, state?: ScholarFilterState, programs?: readonly string[]) {
  if (!state && !programs?.length) return true;
  if (!known) return false;
  const status = scholarStatusValue(value);
  if (state && scholarState(status) !== state) return false;
  return !programs?.length || !!status?.selections.some(v => programs.includes(v));
}
/** Leader-facing summary: program names, "Not a scholar", or null when unanswered. */
export function scholarSummary(value: unknown) {
  const state = scholarState(value);
  return state === "scholar" ? scholarNames(value).join(", ") : state === "none" ? scholarFilterLabels.none : null;
}
/**
 * Whether leaders see the scholar filter, sort and column: the club shows the field, the viewer may
 * identify applicants, and the list (or the chosen round) includes a round that is not anonymous.
 */
export function scholarFilterAvailable(showField: boolean, canIdentify: boolean, rounds: readonly { id: string; anonymousReview: boolean }[], roundId?: string) {
  return showField && canIdentify && rounds.some(round => !round.anonymousReview && (!roundId || round.id === roundId));
}
