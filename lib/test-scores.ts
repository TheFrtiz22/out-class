import { z } from "zod";
export const testRequirements = [
  "OPTIONAL",
  "SAT_OR_ACT",
  "SAT",
  "ACT",
  "BOTH",
] as const;
export const testRequirementLabels: Record<
  (typeof testRequirements)[number],
  string
> = {
  OPTIONAL: "SAT and ACT optional",
  SAT_OR_ACT: "SAT or ACT required",
  SAT: "SAT required",
  ACT: "ACT required",
  BOTH: "SAT and ACT required",
};
export const actFields = [
  "actScore",
  "actEnglish",
  "actMath",
  "actReading",
  "actScience",
] as const;
export const actShape = Object.fromEntries(
  actFields.map((key) => [
    key,
    z.number().int().min(1).max(36).nullable().optional(),
  ]),
) as Record<
  (typeof actFields)[number],
  z.ZodOptional<z.ZodNullable<z.ZodNumber>>
>;
export function meetsTestRequirement(
  requirement: string | undefined,
  profile: { satScore?: number | null; actScore?: number | null } | null,
) {
  const sat = profile?.satScore != null,
    act = profile?.actScore != null;
  switch (requirement) {
    case "SAT_OR_ACT":
      return sat || act;
    case "SAT":
      return sat;
    case "ACT":
      return act;
    case "BOTH":
      return sat && act;
    default:
      return !requirement || requirement === "OPTIONAL";
  }
}
