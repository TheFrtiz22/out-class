import { z } from "zod";

export const scholarPrograms = ["ECHOLS", "JEFFERSON", "COLLEGE_SCIENCE", "RODMAN", "MILLER_ARTS", "CORE"] as const;
// Historical designations remain valid so editing education never destroys existing data.
export const scholarSelections = [...scholarPrograms, "WALENTAS", "NOT_APPLICABLE", "OTHER"] as const;
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
