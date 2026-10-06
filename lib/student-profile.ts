import { scholarStatusSchema } from "@/lib/scholar-status"
import { actShape } from "@/lib/test-scores"
import { z } from "zod"
import type { Experience, StudentProfile } from "@prisma/client"

export type FullStudentProfile = StudentProfile & { experiences: Experience[] }
/** Shared normalization for profile imports; internal storage keys never become URLs. */
export function normalizeWebUrl(value: string): string {
  const text = value.trim()
  if (!text || text.startsWith("/") || /^https?:\/\/\//i.test(text) || /[\s\\\x00-\x1f]/.test(text)) throw new Error("Enter a valid web URL")
  const explicit = /^[a-z][a-z0-9+.-]*:/i.test(text)
  if (explicit && !/^https?:\/\//i.test(text)) throw new Error("Use an http or https URL")
  const url = new URL(explicit ? text : `https://${text}`)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)) throw new Error("Enter a valid web URL")
  return url.href
}
export const webUrlSchema = z.string().transform((value, ctx) => {
  try { return normalizeWebUrl(value) } catch { ctx.addIssue({ code: 'custom', message: 'Enter a valid web URL' }); return z.NEVER }
})
export const headshotUrlSchema = z.string().url().refine(value => /^https?:\/\//i.test(value), "Use a web image URL")
export const linkedinUrlSchema = webUrlSchema.refine(value => { try { return /(^|\.)linkedin\.com$/i.test(new URL(value).hostname) } catch { return false } }, "Use a LinkedIn URL")
export function validateProfileFile(bytes: Uint8Array, type: string, kind: 'resume' | 'headshot') {
  if (!bytes.length) throw new Error("Choose a file")
  if (bytes.length > (kind === 'resume' ? 10 : 5) * 1024 * 1024) throw new Error(kind === 'resume' ? "Choose a PDF up to 10 MB" : "Choose an image up to 5 MB")
  const starts = (signature: number[]) => signature.every((v, i) => bytes[i] === v)
  if (kind === 'resume') {
    if (!['application/pdf', 'application/octet-stream', ''].includes(type) || !starts([37,80,68,70,45])) throw new Error("Choose a valid PDF")
    return 'application/pdf'
  }
  const detected = starts([137,80,78,71,13,10,26,10]) ? 'image/png' : starts([255,216,255]) ? 'image/jpeg' : starts([82,73,70,70]) && [87,69,66,80].every((v,i) => bytes[i+8] === v) ? 'image/webp' : null
  if (!detected || (type && type !== detected)) throw new Error("Choose a JPEG, PNG or WebP image")
  return detected
}
export const storagePathSchema = z.string().trim().refine((val) => {
  if (!val) return true; // allow empty strings when chained with .or(literal(""))
  // Reject URLs and absolute paths
  if (val.includes('://') || val.startsWith('/') || val.startsWith('data:') || val.startsWith('javascript:')) return false;
  // Reject path traversal
  if (val.includes('..') || /[\\%?#\x00-\x1f\x7f]/.test(val)) return false;
  
  const parts = val.split('/');
  if (parts.length !== 2) return false; // Expected format: uuid/filename
  
  // First part must be a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parts[0])) return false;
  
  // Second part must not be empty
  if (parts[1].length === 0) return false;
  
  return true;
}, "Invalid storage path");

export const resumeReferenceSchema = z.string().trim().transform((value, ctx) => {
  if (!value || storagePathSchema.safeParse(value).success) return value
  try { return normalizeWebUrl(value) } catch { ctx.addIssue({ code: 'custom', message: 'Enter a valid résumé URL or upload a PDF' }); return z.NEVER }
})
export function isPrivateResume(value: string) { return !!value && storagePathSchema.safeParse(value).success }

export const profileSectionSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("identity"),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    headshotUrl: headshotUrlSchema.nullable().or(z.literal("")).optional(),
  }),
  z.object({
    section: z.literal("education"),
    scholarStatus: scholarStatusSchema.optional(),
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
    linkedinUrl: linkedinUrlSchema.nullable().or(z.literal("")),
    resumeUrl: resumeReferenceSchema.nullable().or(z.literal("")),
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
/** Recruiter links carry application scope, never caller-selected private object paths. */
export function resolveRecruitingResumeUrl(value: string | null | undefined, clubId: string, applicationId: string) {
  if (!value) return undefined;
  if (isPrivateResume(value)) return `/api/recruiting-resumes?clubId=${encodeURIComponent(clubId)}&applicationId=${encodeURIComponent(applicationId)}`;
  return safeProfileUrl(value) ? value : undefined;
}
export function profileChecklist(profile: FullStudentProfile) {
  return [
    { label: "Name", complete: Boolean(profile.firstName.trim() && profile.lastName.trim()) },
    { label: "Education", complete: Boolean(profile.major.trim() && profile.gradYear) },
    { label: "Résumé", complete: Boolean(resolveResumeUrl(profile.resumeUrl)) },
    { label: "LinkedIn", complete: Boolean(safeProfileUrl(profile.linkedinUrl)) },
  ]
}
