import { z } from "zod"

/**
 * The one password rule for every flow that sets a password: signup, recovery,
 * invitation claim, and the client hints for each. Safe to import in the browser.
 *
 * - At least 10 characters (Unicode code points, so an emoji counts once).
 * - At most 72 bytes of UTF-8, because bcrypt ignores everything after byte 72.
 * - Not all one kind of character, and not on a short list of common passwords.
 */
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_BYTES = 72

export const PASSWORD_HINT = "At least 10 characters. Mix letters with numbers, symbols or spaces."

export const PASSWORD_MESSAGES = {
  required: "Enter a password.",
  tooShort: "Use at least 10 characters.",
  tooLong: "Use a shorter password. The limit is 72 bytes, and some characters count as more than one.",
  oneKind: "Add another kind of character, such as a number, symbol or space.",
  common: "That password is too common. Try something less predictable.",
} as const

// Lowercased; length 10+ only, since shorter ones already fail the minimum.
const COMMON_PASSWORDS = new Set([
  "password12", "password123", "password1!", "password1234", "passw0rd123",
  "qwerty1234", "qwerty12345", "qwertyuiop1", "1q2w3e4r5t", "1qaz2wsx3edc",
  "abc1234567", "abcd123456", "iloveyou12", "iloveyou123", "welcome123",
  "welcome1234", "letmein123", "football123", "baseball123", "sunshine123",
  "princess123", "starwars123", "trustno1234", "monkey12345", "dragon12345",
  "changeme123", "admin12345", "administrator", "virginia123", "wahoowa123",
  "outclass123", "student123", "university1", "summer2026!", "fall2026!!",
])

export function passwordByteLength(value: string) {
  return new TextEncoder().encode(value).length
}

function characterKinds(value: string) {
  const kinds = new Set<string>()
  for (const ch of value) {
    if (/\p{Ll}/u.test(ch)) kinds.add("lower")
    else if (/\p{Lu}/u.test(ch)) kinds.add("upper")
    else if (/\p{Nd}/u.test(ch)) kinds.add("digit")
    else kinds.add("other")
  }
  return kinds.size
}

/** The first rule a new password breaks, as a short message, or null when it is acceptable. */
export function passwordIssue(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return PASSWORD_MESSAGES.required
  if (passwordByteLength(value) > PASSWORD_MAX_BYTES) return PASSWORD_MESSAGES.tooLong
  if (Array.from(value).length < PASSWORD_MIN_LENGTH) return PASSWORD_MESSAGES.tooShort
  if (characterKinds(value) < 2) return PASSWORD_MESSAGES.oneKind
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return PASSWORD_MESSAGES.common
  return null
}

/** Schema for a password being chosen now. */
export const newPasswordSchema = z.string().superRefine((value, ctx) => {
  const issue = passwordIssue(value)
  if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue })
})

/**
 * Schema for checking a password the account already has (for example, admin elevation).
 * Only the byte cap applies, so older passwords that predate this rule still verify.
 */
export const existingPasswordSchema = z
  .string()
  .min(1, PASSWORD_MESSAGES.required)
  .refine((value) => passwordByteLength(value) <= PASSWORD_MAX_BYTES, PASSWORD_MESSAGES.tooLong)
