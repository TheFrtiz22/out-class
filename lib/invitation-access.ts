// Copy shared by the invitation check on the server and in the browser.

/**
 * How the account can prove it controls its school mailbox (utils/verified-email-policy):
 * a password account by consuming a password reset link; a Microsoft-only account through its
 * Microsoft sign-in, which carries the address (it has no password to reset).
 */
export type VerificationRemedy = "password" | "provider"
export type VerificationContext = { remedy?: VerificationRemedy | null; school?: string | null }

export const UNIVERSITY_VERIFICATION_UNAVAILABLE_MESSAGE = "Invitations can’t be checked right now. Try again in a few minutes."
export const UNIVERSITY_VERIFICATION_HREF = "/settings/account"

/** A school name from the server, or null. The browser never supplies it. */
export function verificationSchool(value: unknown) {
  return typeof value === "string" && value.trim() && value.length <= 120 ? value.trim() : null
}
export function verificationRemedy(value: unknown): VerificationRemedy | null {
  return value === "password" || value === "provider" ? value : null
}
/** "your University of Virginia email", or "your university email" when the school is not known. */
export function schoolEmailPhrase(school?: string | null) {
  return `your ${verificationSchool(school) ?? "university"} email`
}
export function verificationTitle(school?: string | null) {
  return `Confirm ${schoolEmailPhrase(school)}`
}
export function verificationRequiredMessage({ remedy, school }: VerificationContext = {}) {
  const email = schoolEmailPhrase(school)
  return remedy === "provider"
    ? `To see club invitations, OutClass needs to confirm ${email} from your Microsoft sign-in. Sign out and sign in with Microsoft again. If this keeps happening, contact OutClass support.`
    : `To see club invitations, confirm ${email}: send yourself a password reset from Account settings, then sign in again.`
}

/** "verify": a password reset from Account settings confirms the email; "verify-provider": sign in with Microsoft again. */
export type InvitationCheckBlock = "verify" | "verify-provider" | "unavailable" | null

/** Which refusal, if any, an invitation-check error represents (codes from lib/workspace-read). */
export function invitationCheckBlock(error: unknown): InvitationCheckBlock {
  const value = error && typeof error === "object" ? error as { code?: unknown; remedy?: unknown } : {}
  if (value.code === "UNIVERSITY_VERIFICATION_REQUIRED") return verificationRemedy(value.remedy) === "provider" ? "verify-provider" : "verify"
  return value.code === "UNIVERSITY_VERIFICATION_UNAVAILABLE" ? "unavailable" : null
}
