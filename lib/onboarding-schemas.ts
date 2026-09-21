import { z } from "zod"

// ─── Step 1: Account Basics ───────────────────────────────────────────────────

export const accountBasicsSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .refine(
      (v) => /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(v.trim()),
      "Only @virginia.edu email addresses are accepted"
    ),
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
    .refine(
      (v) => {
        const n = Number(v)
        return Number.isInteger(n) && n >= 2025 && n <= 2030
      },
      "Choose a year between 2025 and 2030"
    ),
  major: z
    .string()
    .min(1, "Major is required")
    .max(120, "Major is too long"),
  gpa: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v === "") return true
        const n = parseFloat(v)
        return !isNaN(n) && n >= 0 && n <= 4.0
      },
      "GPA must be between 0.0 and 4.0"
    ),
  satScore: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v === "") return true
        const n = parseInt(v, 10)
        return !isNaN(n) && n >= 400 && n <= 1600
      },
      "SAT score must be between 400 and 1600"
    ),
})

export type AcademicProfileData = z.infer<typeof academicProfileSchema>

// ─── Step 4: Experience & Assets ──────────────────────────────────────────────

export const experienceAssetsSchema = z.object({
  linkedinUrl: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || v === "") return true
        try {
          const url = new URL(v)
          return url.hostname.endsWith("linkedin.com")
        } catch {
          return false
        }
      },
      "Enter a valid LinkedIn URL"
    ),
})

export type ExperienceAssetsData = z.infer<typeof experienceAssetsSchema>

// ─── Full Wizard Data (accumulated across all steps) ──────────────────────────

export type WizardData = {
  accountBasics: AccountBasicsData | null
  academic: AcademicProfileData | null
  experience: ExperienceAssetsData | null
  resumeUrl: string | null
}

