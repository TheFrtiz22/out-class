import { z } from "zod"

/**
 * Applicant phone numbers. Collected so a club's decision managers can call an applicant
 * they are accepting. Stored in E.164 ("+14345550123"); never used for text messages.
 * A number typed without a country code is read as US/Canada.
 */
export const PHONE_REQUIRED_MESSAGE = "Add a phone number to your profile before submitting. Clubs call applicants they accept."
const INVALID = "Enter a 10-digit US number, or start with + and your country code."

export function normalizePhone(value: string): string {
  const text = value.trim()
  if (!text || text.length > 40 || /[^\d\s().+-]/.test(text) || text.lastIndexOf("+") > 0) throw new Error(INVALID)
  const digits = text.replace(/\D/g, "")
  if (text.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error(INVALID)
    if (digits.startsWith("1") && !/^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)) throw new Error(INVALID)
    return `+${digits}`
  }
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) throw new Error(INVALID)
  return `+1${national}`
}

export const phoneSchema = z.string().max(40).transform((value, ctx) => {
  try { return normalizePhone(value) } catch { ctx.addIssue({ code: "custom", message: INVALID }); return z.NEVER }
})

/** A stored value is only trusted when it is already normalized. */
export function validPhone(value?: string | null): value is string {
  return !!value && /^\+[1-9]\d{7,14}$/.test(value)
}

/** "(434) 555-0123" for US/Canada numbers; other numbers are shown as stored. */
export function formatPhone(value?: string | null) {
  if (!validPhone(value)) return ""
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value)
  return us ? `(${us[1]}) ${us[2]}-${us[3]}` : value
}

export function phoneHref(value?: string | null) {
  return validPhone(value) ? `tel:${value}` : undefined
}
