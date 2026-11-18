// Copy shared by the invitation check on the server and in the browser.

/** Accounts whose UVA mailbox has not been confirmed yet. A password reset records the confirmation. */
export const UNIVERSITY_VERIFICATION_REQUIRED_MESSAGE = "To see club invitations, confirm your UVA email: send yourself a password reset from Account settings, then sign in again."
export const UNIVERSITY_VERIFICATION_UNAVAILABLE_MESSAGE = "Invitations can’t be checked right now. Try again in a few minutes."
export const UNIVERSITY_VERIFICATION_HREF = "/settings/account"

export type InvitationCheckBlock = "verify" | "unavailable" | null

/** Which refusal, if any, an invitation-check error represents (codes from lib/workspace-read). */
export function invitationCheckBlock(error: unknown): InvitationCheckBlock {
  const code = error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined
  return code === "UNIVERSITY_VERIFICATION_REQUIRED" ? "verify" : code === "UNIVERSITY_VERIFICATION_UNAVAILABLE" ? "unavailable" : null
}
