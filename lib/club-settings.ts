import { z } from "zod";
import { questionConditionSchema } from "@/lib/student-applications";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
import { interviewCapabilities } from "@/lib/interview-access";
export const roundTypes = [
  "APPLICATION_REVIEW",
  "INTERVIEW",
  "GROUP_INTERVIEW",
  "CASE_TASK",
  "VOTE",
  "CUSTOM",
  "FINAL_DECISION",
] as const;
export const roundTypeLabels: Record<(typeof roundTypes)[number], string> = {
  APPLICATION_REVIEW: "Application Review",
  INTERVIEW: "Interview",
  GROUP_INTERVIEW: "Group Interview",
  CASE_TASK: "Case / Task",
  VOTE: "Vote",
  CUSTOM: "Custom",
  FINAL_DECISION: "Final Decision",
};
export const roundConfigurationSchema = z.object({
  instructions: z.string().trim().max(5000).default(""),
  duration: z.number().int().min(5).max(180).default(30),
});
export const questionDraftSchema = z
  .object({
    id: z.string().uuid(),
    prompt: z.string().trim().min(1).max(3000),
    type: z.enum(["ESSAY", "MULTIPLE_CHOICE", "MULTI_SELECT", "FILE_UPLOAD"]),
    showIf: questionConditionSchema.nullable().default(null),
    required: z.boolean(),
    wordLimit: z.number().int().min(1).max(10000).nullable(),
    options: z.array(z.string().trim().min(1).max(300)).max(30),
  })
  .superRefine((q, ctx) => {
    if (
      (q.type === "MULTIPLE_CHOICE" || q.type === "MULTI_SELECT") &&
      (q.options.length === 1 || new Set(q.options).size !== q.options.length)
    )
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message:
          "Multiple choice questions need at least two distinct options.",
      });
  });
export type QuestionDraft = z.infer<typeof questionDraftSchema>;
export const isChoiceQuestion = (q: Pick<QuestionDraft, "type">) => q.type === "MULTIPLE_CHOICE" || q.type === "MULTI_SELECT"

/** Drops conditions that no longer point at an earlier choice question or its options
 * (after a move, delete or edit), so the builder never saves an impossible rule. */
export function withValidConditions(items: QuestionDraft[]): QuestionDraft[] {
  return items.map((q, index) => {
    if (!q.showIf) return q
    const parent = items.slice(0, index).find(p => p.id === q.showIf!.questionId)
    const anyOf = parent && isChoiceQuestion(parent) ? q.showIf.anyOf.filter(option => parent.options.includes(option)) : []
    return { ...q, showIf: anyOf.length ? { questionId: q.showIf.questionId, anyOf } : null }
  })
}

export const applicationSettingsSchema = z
  .object({
    clubId: z.string().uuid(),
    version: z.number().int().min(0),
    open: z.boolean(),
    deadline: z.string().datetime().nullable(),
    questions: z.array(questionDraftSchema).max(100),
  })
  .refine(
    (x) => new Set(x.questions.map((q) => q.id)).size === x.questions.length,
    "Duplicate question IDs.",
  )
  .superRefine((x, ctx) => {
    // A condition points at an earlier choice question and only at its own options.
    x.questions.forEach((q, index) => {
      if (!q.showIf) return
      const parent = x.questions.slice(0, index).find(p => p.id === q.showIf!.questionId)
      if (!parent || !(parent.type === "MULTIPLE_CHOICE" || parent.type === "MULTI_SELECT") || q.showIf.anyOf.some(option => !parent.options.includes(option)))
        ctx.addIssue({ code: "custom", path: ["questions", index, "showIf"], message: "A follow-up question must depend on an earlier multiple-choice question and its options." })
    })
  });
export const pipelineSettingsSchema = z
  .object({
    clubId: z.string().uuid(),
    version: z.number().int().min(0),
    rounds: z
      .array(
        z.object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(100),
          type: z.enum(roundTypes),
          configuration: roundConfigurationSchema,
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((x, ctx) => {
    if (
      new Set(x.rounds.map((r) => r.id)).size !== x.rounds.length ||
      new Set(x.rounds.map((r) => r.name.toLowerCase())).size !==
        x.rounds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Round names and IDs must be unique.",
      });
    if (x.rounds[0]?.type !== "APPLICATION_REVIEW")
      ctx.addIssue({
        code: "custom",
        message: "The first round must be Application Review.",
      });
  });
export type RoundDraft = z.infer<
  typeof pipelineSettingsSchema
>["rounds"][number];
export function applicationAvailability(
  club: {
    applicationOpen?: boolean;
    applicationDeadline?: Date | string | null;
  },
  now = new Date(),
) {
  return (
    club.applicationOpen !== false &&
    (!club.applicationDeadline || new Date(club.applicationDeadline) > now)
  );
}
export const settingsSections = [
  { id: "general", label: "Public profile", permission: "club.settings" },
  { id: "application", label: "Recruitment & applications", permission: "application.manage" },
  { id: "profiles", label: "Applicant profiles", permission: "club.settings" },
  { id: "cycles", label: "Application cycles", permission: "recruitment.manage" },
  {
    id: "pipeline",
    label: "Recruitment rounds",
    permission: "recruitment.manage",
  },
  {
    id: "members",
    label: "Members & permissions",
    permission: "members.manage",
  },
  { id: "notifications", label: "Communications", permission: "club.settings" },
  { id: "advanced", label: "Ownership & administration", permission: "club.settings" },
] as const;
export function availableSettings(member: ClubAccess) {
  return settingsSections.filter(
    (s) =>
      hasPermission(member, s.permission) ||
      (s.id === "notifications" && (hasPermission(member, "members.manage") || hasPermission(member, "recruitment.manage"))) ||
      ((s.id === "members" || s.id === "notifications") &&
        hasPermission(member, "leaders.manage")),
  );
}

/** One permission-aware tab resolution for both settings content and its decoration. */
export function resolveSettingsTab(member: ClubAccess | null | undefined, requested: string | null | undefined) {
  const sections = member ? availableSettings(member) : [];
  const active = sections.find(section => section.id === requested)?.id ?? sections[0]?.id;
  return { sections, active };
}
