import { actShape } from "@/lib/test-scores"
import { z } from "zod"
import type { Experience, StudentProfile } from "@prisma/client"

export type FullStudentProfile = StudentProfile & { experiences: Experience[] }
const webUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Use an http or https URL")
const optionalUrl = webUrl.or(z.literal("")).nullable()
export const storagePathSchema = z.string().trim().refine((val) => {
  if (!val) return true; // allow empty strings when chained with .or(literal(""))
  // Reject URLs and absolute paths
  if (val.includes('://') || val.startsWith('/') || val.startsWith('data:') || val.startsWith('javascript:')) return false;
  // Reject path traversal
  if (val.includes('..')) return false;
  
  const parts = val.split('/');
  if (parts.length !== 2) return false; // Expected format: uuid/filename
  
  // First part must be a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parts[0])) return false;
  
  // Second part must not be empty
  if (parts[1].length === 0) return false;
  
  return true;
}, "Invalid storage path");

export const profileSectionSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("identity"),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    bio: z.string().trim().max(3000),
  }),
  z.object({
    section: z.literal("education"),
    ...actShape,
    major: z.string().trim().min(1).max(200),
    gradYear: z.number().int().min(2020).max(2030),
    gpa: z.number().min(0).max(4).nullable(),
    satScore: z.number().int().min(400).max(1600).nullable(),
  }),
  z.object({
    section: z.literal("experience"),
    experiences: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          subtitle: z.string().trim().min(1).max(200),
          period: z.string().trim().max(100),
        }),
      )
      .max(50),
  }),
  z.object({
    section: z.literal("links"),
    linkedinUrl: optionalUrl.refine((value) => {
      if (!value) return true
      try {
        return /(^|\.)linkedin\.com$/i.test(new URL(value).hostname)
      } catch {
        return false
      }
    }, "Use a LinkedIn URL"),
    resumeUrl: storagePathSchema.nullable().or(z.literal("")),
  }),
])
export type ProfileSection = z.infer<typeof profileSectionSchema>["section"]
export function safeProfileUrl(value?: string | null) {
  return value && /^https?:\/\//i.test(value) ? value : undefined
}
export function resolveResumeUrl(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value) || value.startsWith('/')) return value;
  return `/api/resumes?path=${encodeURIComponent(value)}`;
}
export function profileChecklist(profile: FullStudentProfile) {
  return [
    { label: "Name", complete: Boolean(profile.firstName.trim() && profile.lastName.trim()) },
    { label: "Education", complete: Boolean(profile.major.trim() && profile.gradYear) },
    { label: "Introduction", complete: Boolean(profile.bio?.trim()) },
    { label: "Experience", complete: profile.experiences.length > 0 },
    { label: "Résumé", complete: Boolean(resolveResumeUrl(profile.resumeUrl)) },
    { label: "LinkedIn", complete: Boolean(safeProfileUrl(profile.linkedinUrl)) },
  ]
}
