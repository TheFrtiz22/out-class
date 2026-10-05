import { z } from "zod";
import { hasPermission, type ClubAccess } from "@/lib/permissions";
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
    type: z.enum(["ESSAY", "MULTIPLE_CHOICE", "FILE_UPLOAD"]),
    required: z.boolean(),
    wordLimit: z.number().int().min(1).max(10000).nullable(),
    options: z.array(z.string().trim().min(1).max(300)).max(30),
  })
  .superRefine((q, ctx) => {
    if (
      q.type === "MULTIPLE_CHOICE" &&
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
  );
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
  { id: "general", label: "General", permission: "club.settings" },
  { id: "application", label: "Application", permission: "application.manage" },
  {
    id: "pipeline",
    label: "Recruiting Pipeline",
    permission: "recruitment.manage",
  },
  {
    id: "interviews",
    label: "Interview Setup",
    permission: "interviews.manage",
  },
  {
    id: "members",
    label: "Members & Permissions",
    permission: "members.manage",
  },
  { id: "notifications", label: "Notifications", permission: "members.manage" },
  { id: "advanced", label: "Advanced", permission: "club.settings" },
] as const;
export function availableSettings(member: ClubAccess) {
  return settingsSections.filter(
    (s) =>
      hasPermission(member, s.permission) ||
      ((s.id === "members" || s.id === "notifications") &&
        hasPermission(member, "leaders.manage")),
  );
}
