/**
 * Client-side checks for account creation, so a typo is caught before a round trip. They mirror
 * the web's rules (lib/onboarding-schemas.ts, lib/password-policy.ts); the server checks again
 * and its message wins when the two disagree.
 */
export const PASSWORD_HINT = "At least 10 characters. Mix letters with numbers, symbols or spaces.";

export function isUvaEmail(value: string) {
  return /^[a-z0-9]+(?:[._+-][a-z0-9]+)*@virginia\.edu$/i.test(value.trim());
}

export function nameIssue(value: string, which: "First" | "Last") {
  const text = value.trim();
  if (!text) return `${which} name is required.`;
  if (text.length > 50) return `${which} name is too long.`;
  return null;
}

export function emailIssue(value: string) {
  if (!value.trim()) return "Enter your UVA email.";
  if (!isUvaEmail(value)) return "Use your @virginia.edu email address.";
  return null;
}

export function passwordIssue(value: string) {
  if (!value) return "Enter a password.";
  if (new TextEncoder().encode(value).length > 72) return "Use a shorter password. The limit is 72 bytes, and some characters count as more than one.";
  if (Array.from(value).length < 10) return "Use at least 10 characters.";
  const kinds = new Set(Array.from(value).map(ch => /\p{Ll}/u.test(ch) ? "lower" : /\p{Lu}/u.test(ch) ? "upper" : /\p{Nd}/u.test(ch) ? "digit" : "other"));
  if (kinds.size < 2) return "Add another kind of character, such as a number, symbol or space.";
  return null;
}

/** The computing ID the server derives from the account's email (actions/profile.ts). */
export function computingIdFor(email: string | null | undefined) {
  return (email ?? "").split("@")[0] ?? "";
}

export type SignupOptions = { termsRequired: boolean; turnstileSiteKey: string | null; graduationYears: string[] };

// The Terms box ticked on the sign-up screen, carried to complete-profile (which records the
// acceptance once the account is signed in). Memory only: a restarted app simply asks again.
let termsAcceptedBy: string | null = null;
export function rememberTermsAccepted(email: string) { termsAcceptedBy = email.trim().toLowerCase(); }
export function termsAcceptedFor(email: string | null | undefined) { return !!email && termsAcceptedBy === email.trim().toLowerCase(); }
