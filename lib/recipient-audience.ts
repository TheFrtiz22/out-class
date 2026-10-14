import { z } from "zod";

const ids = z.array(z.string().uuid()).max(1000);
const years = z.array(z.number().int().min(1900).max(2200)).max(50).default([]);
const member = z.object({
  source: z.enum(["MEMBERS", "OFFICERS"]), gradYears: years,
  accessRoles: z.array(z.enum(["OWNER", "ADMIN", "RECRUITING_ADMIN", "INTERVIEWER", "MEMBER"])).max(5).default([]),
  cohorts: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  labels: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  joinedAfter: z.string().datetime().optional(), joinedBefore: z.string().datetime().optional(),
}).strict();
const applicants = z.object({
  source: z.enum(["APPLICANTS", "REJECTED"]), gradYears: years,
  roundIds: ids.default([]), cycleIds: ids.default([]),
  statuses: z.array(z.enum(["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "ACCEPTED", "WAITLISTED"])).max(5).default([]),
  interview: z.enum(["ANY", "INTERVIEWING", "BOOKED", "UNBOOKED", "COMPLETED"]).default("ANY"),
  offerStatuses: z.array(z.enum(["NONE", "PENDING", "ACCEPTED", "DECLINED", "REVOKED", "EXPIRED"])).max(6).default([]),
}).strict();
const events = z.object({ source: z.enum(["EVENT", "LEADS"]), eventIds: ids.min(1), gradYears: years,
  participation: z.enum(["RSVP", "ATTENDED", "EITHER"]).default("EITHER"),
}).strict();
export const audienceRuleSchema = z.union([member, applicants, events,
  z.object({ source: z.literal("GROUP"), groupId: z.string().uuid() }).strict(),
  z.object({ source: z.literal("PEOPLE"), userIds: ids }).strict(),
]);
export const recipientAudienceSchema = z.object({
  include: z.array(audienceRuleSchema).min(1).max(20),
  exclude: z.array(audienceRuleSchema).max(20).default([]),
}).strict();
export type AudienceRule = z.infer<typeof audienceRuleSchema>;
export type RecipientAudience = z.infer<typeof recipientAudienceSchema>;
// Stable comparison is part of publication retry idempotency, independent of JSON key order.
export function audienceKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(audienceKey).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${audienceKey(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const audienceCapabilities = {
  recruitmentCycle: "Recorded application cycle only; unknown legacy cycles are never inferred.",
  cohort: "Recorded membership cohort only; missing values are not inferred.",
  leads: "Recorded RSVP/attendance at selected club events, excluding active members and submitted applicants. Private saves are never used.",
  eligibility: "Audience membership is separate from email consent, channel preferences and delivery eligibility.",
};
