import { z } from "zod"
import type { Experience, StudentProfile } from "@prisma/client"

export type FullStudentProfile = StudentProfile & { experiences: Experience[] }
const webUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Use an http or https URL")
const optionalUrl = webUrl.or(z.literal("")).nullable()
export const profileSectionSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("identity"),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    bio: z.string().trim().max(3000),
  }),
  z.object({
    section: z.literal("education"),
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
    resumeUrl: optionalUrl,
  }),
])
export type ProfileSection = z.infer<typeof profileSectionSchema>["section"]
export function safeProfileUrl(value?: string | null) {
  return value && /^https?:\/\//i.test(value) ? value : undefined
}
export function profileChecklist(profile: FullStudentProfile) {
  return [
    { label: "Name", complete: Boolean(profile.firstName.trim() && profile.lastName.trim()) },
    { label: "Education", complete: Boolean(profile.major.trim() && profile.gradYear) },
    { label: "Introduction", complete: Boolean(profile.bio?.trim()) },
    { label: "Experience", complete: profile.experiences.length > 0 },
    { label: "Résumé", complete: Boolean(safeProfileUrl(profile.resumeUrl)) },
    { label: "LinkedIn", complete: Boolean(safeProfileUrl(profile.linkedinUrl)) },
  ]
}
