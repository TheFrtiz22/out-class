import { z } from "zod";
export const platformResources = [
  "users",
  "clubs",
  "claims",
  "memberships",
  "rounds",
  "questions",
  "interviews",
  "applications",
  "meetings",
  "tasks",
  "content",
  "audit",
  "submissions",
  "view-sessions",
] as const;
export const platformFiltersSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    clubId: z.union([z.string().uuid(), z.literal("")]).default(""),
    userId: z.union([z.string().uuid(), z.literal("")]).default(""),
    status: z.string().max(40).default(""),
    action: z.string().trim().max(100).default(""),
    permission: z.string().max(80).default(""),
    from: z.union([z.string().datetime(), z.literal("")]).default(""),
    to: z.union([z.string().datetime(), z.literal("")]).default(""),
  })
  .refine(
    (v) => !v.from || !v.to || new Date(v.from) <= new Date(v.to),
    "Start date must precede end date.",
  );
export type PlatformFilters = z.input<typeof platformFiltersSchema>;
export const applicationStates = [
  "DRAFTING",
  "SUBMITTED",
  "IN_REVIEW",
  "INTERVIEWING",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED",
] as const;
export const platformStatuses: Partial<
  Record<(typeof platformResources)[number], readonly string[]>
> = {
  users: ["ACTIVE", "SUSPENDED"],
  clubs: ["CLAIMED", "UNCLAIMED"],
  claims: ["PENDING", "APPROVED", "REJECTED"],
  applications: applicationStates,
  tasks: ["OPEN", "IN_PROGRESS", "DONE"],
  meetings: ["RECRUITMENT", "MEMBERS"],
  submissions: ["ASSIGNED", "SUBMITTED", "REVIEWED"],
  "view-sessions": ["ACTIVE", "ENDED", "EXPIRED"],
};
