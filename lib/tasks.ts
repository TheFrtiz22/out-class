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
  match: z.enum(["ANY", "ALL"]).default("ANY"),
  excludeMembers: z.array(uuid).max(1000).default([]),
  excludeGroups: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  excludeTasks: z.array(uuid).max(100).default([]),
  random: z.object({ seed: uuid, count: z.number().int().min(1).max(1000).nullable(), groups: z.number().int().min(2).max(100).nullable() }).refine(value => (value.count === null) !== (value.groups === null), "Choose a sample size or number of groups.").nullable().default(null),
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
  status: z.enum(["DRAFT", "OPEN", "IN_PROGRESS", "DONE"]).default("OPEN"),
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
  expectedRecipients: z.array(uuid).max(1000).optional(),
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
  if (audience.excludeMembers.includes(member.id) || member.groups.some(group => audience.excludeGroups.includes(group))) return false;
  if (audience.everyone) return true;
  const conditions = [
    audience.members.length ? audience.members.includes(member.id) : null,
    audience.groups.length ? member.groups.some(g => audience.groups.includes(g)) : null,
    audience.cohorts.length ? !!member.cohort && audience.cohorts.includes(member.cohort) : null,
    audience.years.length ? member.gradYear !== null && audience.years.includes(member.gradYear) : null,
    audience.roles.length ? audience.roles.includes(member.role as "GENERAL_MEMBER") : null,
  ].filter(value => value !== null);
  return conditions.length > 0 && (audience.match === "ALL" ? conditions.every(Boolean) : conditions.some(Boolean));
}
export function taskState(
  task: { dueAt: Date | string | null },
  assignment: {
    submittedAt: Date | string | null;
    reviewedAt: Date | string | null;
    revisionRequestedAt?: Date | string | null;
  },
  now = Date.now(),
) {
  if (assignment.revisionRequestedAt) return "Revisions requested";
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

export type TaskAudience = z.infer<typeof taskAudienceSchema>;
export type AudienceMember = { id: string; groups: string[]; cohort: string | null; role: string; user: { id: string; studentProfile: { gradYear: number | null } | null } };
/** Stable seeded shuffle over sorted IDs; the resulting assignments are saved once. */
export function resolveTaskRecipients<T extends AudienceMember>(members: readonly T[], audience: TaskAudience, excludedByTasks: readonly string[] = []) {
  let selected = members.filter(member => !excludedByTasks.includes(member.id) && matchesTaskAudience({ ...member, gradYear: member.user.studentProfile?.gradYear ?? null }, audience)).sort((a,b) => a.id.localeCompare(b.id));
  if (audience.random) {
    let state = 2166136261;
    for (const char of audience.random.seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
    const random = () => { state += 0x6D2B79F5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296 };
    for (let i=selected.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [selected[i],selected[j]]=[selected[j],selected[i]] }
    if (audience.random.count) {
      if (audience.random.count > selected.length) throw new Error(`Only ${selected.length} members match this audience. Choose a smaller sample.`);
      selected = selected.slice(0,audience.random.count);
    }
    if (audience.random.groups && audience.random.groups > selected.length) throw new Error("Choose no more groups than eligible members.");
  }
  return selected.map((member,index) => ({ member, groupLabel: audience.random?.groups ? `Group ${index % audience.random.groups + 1}` : null }));
}
export function assertRecipientPreview(recipients: readonly { member: { id: string } }[], expected?: readonly string[]) {
  if (expected && JSON.stringify(recipients.map(r=>r.member.id).sort()) !== JSON.stringify([...new Set(expected)].sort())) throw new Error("The recipient list changed. Review the updated recipients before assigning.");
}
export const reviewTaskSchema = z.object({ assignmentId: uuid, revision: z.number().int().nonnegative(), feedback: z.string().max(5000), reopen: z.boolean(), requestChanges: z.boolean().default(false) }).refine(value => !value.requestChanges || value.reopen && !!value.feedback.trim(), "Add feedback explaining the requested revisions.");
export const bulkTaskSchema = z.object({ clubId: uuid, tasks: z.array(z.object({ id: uuid, revision: z.number().int().nonnegative() })).min(1).max(100), action: z.enum(["DUE", "CLOSE"]), dueAt: z.string().datetime().nullable().default(null) });
export const bulkReviewSchema = z.object({ clubId: uuid, assignments: z.array(z.object({ id: uuid, revision: z.number().int().nonnegative() })).min(1).max(50) });
