import { z } from "zod"

export const schoolRequestRoles = ["STUDENT", "CLUB_LEADER", "UNIVERSITY_ADMINISTRATOR"] as const
export const schoolRequestStatuses = ["PENDING", "IN_REVIEW", "CONTACTED", "CLOSED"] as const
export const schoolRequestRoleLabels: Record<(typeof schoolRequestRoles)[number], string> = {
  STUDENT: "Student",
  CLUB_LEADER: "Club leader",
  UNIVERSITY_ADMINISTRATOR: "University administrator",
}
export const schoolRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  university: z.string().trim().min(2, "Enter your university’s name.").max(200),
  role: z.enum(schoolRequestRoles, { errorMap: () => ({ message: "Choose your role." }) }),
  organization: z.string().trim().max(200).default(""),
  message: z.string().trim().max(2000).default(""),
  website: z.string().max(200).default(""), // Honeypot, never persisted.
}).strict()

/**
 * Reads only the request's own fields from the form. Third-party widgets (such as the
 * bot check) may add hidden inputs to the form; the strict schema would refuse them.
 */
export function schoolRequestFormValues(form: { get(name: string): unknown }) {
  const values: Record<string, string> = {}
  for (const name of schoolRequestSchema.keyof().options) {
    const value = form.get(name)
    if (typeof value === "string") values[name] = value
  }
  return values
}

/** Shown when a problem cannot be tied to one field, so a submission never fails silently. */
export const schoolRequestFormError = "Check your request details and try again."

export const reviewSchoolRequestSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().min(0),
  status: z.enum(schoolRequestStatuses),
  note: z.string().trim().min(10, "Add a review note of at least 10 characters.").max(2000),
}).strict()

export const schoolRequestConfirmation = "Your request has been received. OutClass will review your school’s interest and may contact you at the email you provided. This does not approve your university or enable account access."
