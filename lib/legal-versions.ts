import { LEGAL_PAGES_PUBLIC } from "@/lib/legal-content"

/**
 * Versions of the Terms of Service and Privacy Policy that a new or returning account accepts
 * (clickwrap, stored server-side in "TermsAcceptance" with the user id and time).
 *
 * Changing either value asks every signed-in user to accept again, once. Set both to the ISO
 * publication date (YYYY-MM-DD, the same day as LEGAL_EFFECTIVE_DATE) when the pages go public;
 * tests/terms-acceptance.test.cjs refuses a non-date version once LEGAL_PAGES_PUBLIC is on.
 *
 * Acceptance is collected only while the pages are public: nobody is asked to agree to a draft
 * they cannot open. Until LEGAL_PAGES_PUBLIC is turned on, sign-up shows no checkbox, the server
 * requires none and nobody is prompted; turning it on enables pages and acceptance together.
 */
export const TERMS_VERSION = "draft-2026-11"
export const PRIVACY_VERSION = "draft-2026-11"
export const TERMS_ACCEPTANCE_REQUIRED: boolean = LEGAL_PAGES_PUBLIC

export type TermsAcceptanceSource = "SIGNUP" | "CLAIM" | "PROMPT"
export type LegalVersions = { termsVersion: string; privacyVersion: string }

export const currentLegalVersions = (): LegalVersions => ({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })

export const TERMS_REQUIRED_MESSAGE = "Agree to the Terms of Service and Privacy Policy to create your account."
export const TERMS_STALE_MESSAGE = "The Terms or Privacy Policy changed while this page was open. Reload, review them and accept again."

/**
 * Validates a clickwrap answer from a form: the box must be explicitly ticked (true, never a
 * default) and the versions shown must be the current ones, so a stale page cannot accept old text.
 */
export function checkClickwrap(input: unknown, required = TERMS_ACCEPTANCE_REQUIRED): { ok: true } | { ok: false; error: string } {
  if (!required) return { ok: true }
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {}
  if (value.acceptTerms !== true) return { ok: false, error: TERMS_REQUIRED_MESSAGE }
  if (value.termsVersion !== TERMS_VERSION || value.privacyVersion !== PRIVACY_VERSION) return { ok: false, error: TERMS_STALE_MESSAGE }
  return { ok: true }
}

/** Routes that stay reachable before acceptance: account settings (deletion and data requests) and sign-in steps. */
export function termsGateExempt(pathname: string) {
  return pathname === "/settings/account" || pathname.startsWith("/settings/account/") || pathname.startsWith("/auth/")
}
