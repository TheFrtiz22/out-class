import { z } from "zod";
import { hasPermission, isActiveMembership, type ClubAccess } from "@/lib/permissions";

export const interviewOffices = ["PRESIDENT", "VICE_PRESIDENT", "BOARD"] as const;
export const interviewOfficesSchema = z.array(z.enum(interviewOffices)).max(3)
  .refine(v => new Set(v).size === v.length, "Choose each office once.");
export type InterviewAccess = ClubAccess & { interviewOffices?: readonly string[] };
// Deliberately does not use hasPermission's owner bypass for these sensitive rights.
export function interviewCapabilities(member: InterviewAccess | null | undefined) {
  const offices = isActiveMembership(member) ? member?.interviewOffices || [] : [];
  const leadership = offices.some(v => interviewOffices.includes(v as typeof interviewOffices[number]));
  return {
    editKit: leadership,
    readClosing: leadership,
    moderateResume: offices.includes("PRESIDENT") || offices.includes("VICE_PRESIDENT"),
    participate: hasPermission(member, "applications.review") && hasPermission(member, "applicants.identify"),
    manageGrants: isActiveMembership(member) && member?.isOwner === true,
  };
}

export const interviewScopeSchema = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid(), roundId: z.string().uuid() });
export type InterviewScope = z.infer<typeof interviewScopeSchema>;
export const interviewScoreSchema = z.number().finite().min(1).max(10).multipleOf(0.5);
export const annotationContentSchema = z.object({
  kind: z.enum(["TEXT_HIGHLIGHT", "GENERAL_NOTE"]),
  comment: z.string().trim().min(1).max(10000),
  anchor: z.object({
    page: z.number().int().min(1).max(10000),
    start: z.number().int().min(0), end: z.number().int().min(1),
    quote: z.string().min(1).max(10000),
    prefix: z.string().max(500).default(""), suffix: z.string().max(500).default(""),
    rectangles: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }).strict().refine(r => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001, "Highlight must fit on its page.")).max(200).default([]),
  }).strict().nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.kind === "TEXT_HIGHLIGHT" ? !v.anchor || v.anchor.end <= v.anchor.start : v.anchor !== null)
    ctx.addIssue({ code: "custom", message: "Highlights require a valid text anchor; general notes have no anchor." });
});
