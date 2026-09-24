import { z } from "zod";
const uuid = z.string().uuid();
export const safeTaskLink = z
  .string()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an http or https link.");
export const taskAudienceSchema = z.object({
  everyone: z.boolean().default(false),
  members: z.array(uuid).max(1000).default([]),
  groups: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  cohorts: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  years: z.array(z.number().int().min(2000).max(2200)).max(20).default([]),
  roles: z
    .array(z.enum(["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"]))
    .max(3)
    .default([]),
});
export const taskInputSchema = z.object({
  clubId: uuid,
  id: uuid.optional(),
  revision: z.number().int().nonnegative().default(0),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10000).default(""),
  kind: z.enum(["TASK", "PROJECT"]).default("TASK"),
  projectId: uuid.nullable().default(null),
  dueAt: z.string().datetime().nullable().default(null),
  status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).default("OPEN"),
  resources: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(150),
        url: safeTaskLink.refine(Boolean),
      }),
    )
    .max(20)
    .default([]),
  requirements: z
    .array(z.enum(["TEXT", "LINK", "FILE"]))
    .max(3)
    .default([]),
  audience: taskAudienceSchema,
});
export type TaskInput = z.input<typeof taskInputSchema>;
export function matchesTaskAudience(
  member: {
    id: string;
    groups: string[];
    cohort: string | null;
    role: string;
    gradYear: number | null;
  },
  audience: z.infer<typeof taskAudienceSchema>,
) {
  return (
    audience.everyone ||
    audience.members.includes(member.id) ||
    member.groups.some((g) => audience.groups.includes(g)) ||
    (!!member.cohort && audience.cohorts.includes(member.cohort)) ||
    (member.gradYear !== null && audience.years.includes(member.gradYear)) ||
    audience.roles.includes(member.role as "GENERAL_MEMBER")
  );
}
export function taskState(
  task: { dueAt: Date | string | null },
  assignment: {
    submittedAt: Date | string | null;
    reviewedAt: Date | string | null;
  },
  now = Date.now(),
) {
  if (assignment.reviewedAt) return "Reviewed";
  if (assignment.submittedAt)
    return task.dueAt &&
      +new Date(assignment.submittedAt) > +new Date(task.dueAt)
      ? "Submitted late"
      : "Submitted";
  return task.dueAt && +new Date(task.dueAt) < now ? "Overdue" : "Assigned";
}
export const submissionSchema = z.object({
  assignmentId: uuid,
  revision: z.number().int().nonnegative(),
  text: z.string().trim().max(30000),
  link: safeTaskLink,
  fileIds: z.array(uuid).max(5),
});
export function validateTaskSubmission(
  requirements: string[],
  input: z.infer<typeof submissionSchema>,
) {
  if (requirements.includes("TEXT") && !input.text)
    throw new Error("A written response is required.");
  if (requirements.includes("LINK") && !input.link)
    throw new Error("A link is required.");
  if (requirements.includes("FILE") && !input.fileIds.length)
    throw new Error("A file is required.");
  if (!input.text && !input.link && !input.fileIds.length)
    throw new Error("Add a response, link, or file before submitting.");
}
export const taskFileSchema = z.object({
  assignmentId: uuid,
  name: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[^/\\\u0000-\u001f\u007f]+$/),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  mime: z.enum([
    "application/pdf",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
});
