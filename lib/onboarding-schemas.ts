import { gpaSchema, linkedinUrlSchema } from "@/lib/student-profile"
import { z } from "zod"
import { newPasswordSchema } from "@/lib/password-policy"
import { normalizePhone } from "@/lib/phone"
import { graduationYearMessage, isSupportedGraduationYear } from "@/lib/graduation-years"

// ─── Step 1: Account Basics ───────────────────────────────────────────────────

export const accountBasicsSchema = z.object({
  firstName: z
    .string().trim()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  lastName: z
    .string().trim()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  email: z
    .string().trim().toLowerCase()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .refine(
      (v) => /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(v.trim()),
      "Only @virginia.edu email addresses are accepted"
    ),
})

export const registrationSchema = accountBasicsSchema.extend({
  password: newPasswordSchema,
})

export type AccountBasicsData = z.infer<typeof accountBasicsSchema>

// ─── Step 2: OTP Verification ─────────────────────────────────────────────────

export const otpVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Enter the full 6-digit code")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
})

export type OtpVerifyData = z.infer<typeof otpVerifySchema>

// ─── Step 3: Academic Profile ─────────────────────────────────────────────────

export const academicProfileSchema = z.object({
  gradYear: z
    .string()
    .min(1, "Graduation year is required")
    .superRefine((v, ctx) => {
      const now = new Date()
      if (v && !isSupportedGraduationYear(v, now)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: graduationYearMessage(now) })
    }),
  major: z
    .string()
    .min(1, "Major is required")
    .max(120, "Major is too long"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (v) => { try { normalizePhone(v); return true } catch { return false } },
      "Enter a 10-digit US number, or start with + and your country code."
    ),
  gpa: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v === "") return true
        const n = Number(v)
        return /^\d(?:\.\d{1,3})?$/.test(v) && gpaSchema.safeParse(n).success
      },
      "GPA must be between 0.0 and 4.0"
    ),
  actScore: z.string().optional().refine(v => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 36), "ACT composite must be between 1 and 36"),
  satScore: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v === "") return true
        const n = Number(v)
        return Number.isInteger(n) && n >= 400 && n <= 1600
      },
      "SAT score must be between 400 and 1600"
    ),
})

export type AcademicProfileData = z.infer<typeof academicProfileSchema>

// ─── Step 4: Experience & Assets ──────────────────────────────────────────────

export const experienceAssetsSchema = z.object({
  experiences: z.array(z.object({
    title: z.string().trim().min(1, "Add a role or title").max(120),
    subtitle: z.string().trim().min(1, "Add an organization").max(120),
    period: z.string().trim().min(1, "Add a date or period").max(100),
  })).max(20).optional(),
  linkedinUrl: linkedinUrlSchema.optional().or(z.literal("")),
})

export type ExperienceAssetsData = z.infer<typeof experienceAssetsSchema>

// ─── Full Wizard Data (accumulated across all steps) ──────────────────────────

export type WizardData = {
  accountBasics: AccountBasicsData | null
  academic: AcademicProfileData | null
  experience: ExperienceAssetsData | null
  resumeUrl: string | null
}

