import { z } from "zod";
import { ActionError } from "@/lib/action-result";
import { isUvaEmail } from "@/lib/auth";
import { graduationYearOptions } from "@/lib/graduation-years";
import { PRIVACY_VERSION, TERMS_ACCEPTANCE_REQUIRED, TERMS_VERSION } from "@/lib/legal-versions";
import { registrationSchema } from "@/lib/onboarding-schemas";
import { RATE_LIMITS, RATE_LIMIT_MESSAGE, clientIp, nodeIsIp, rateLimitKey, rateLimiter } from "@/lib/rate-limit";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";
import { AUTH_UNAVAILABLE } from "@/utils/auth";

/**
 * Account creation for the native app: the web's own steps (actions/onboarding.ts registerStudent,
 * then the email code through lib/email-code-session.ts, then actions/terms.ts and
 * actions/profile.ts once signed in). Nothing here decides who may register; it only adapts the
 * web's checks to an app that keeps its session on the device instead of in cookies.
 */

/** What the sign-up screens need to know before they ask anything. Public values only. */
export function mobileSignupOptions() {
  return {
    termsRequired: TERMS_ACCEPTANCE_REQUIRED,
    turnstileSiteKey: TURNSTILE_SITE_KEY || null,
    graduationYears: graduationYearOptions(),
  };
}

export const mobileRegisterInput = z.object({
  firstName: z.string().max(200),
  lastName: z.string().max(200),
  email: z.string().max(320),
  password: z.string().max(512),
  acceptTerms: z.boolean().optional(),
  turnstileToken: z.string().max(4096).optional(),
}).strict();

/** Sends the confirmation code. The answer never says whether the email already had an account. */
export async function mobileRegister(input: z.infer<typeof mobileRegisterInput>) {
  const { registerStudent } = await import("@/actions/onboarding");
  const { acceptTerms, turnstileToken, ...account } = input;
  // The app shows the current Terms it was given by mobileSignupOptions, so the versions are today's.
  const result = await registerStudent(account, turnstileToken, { acceptTerms: acceptTerms === true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  if ("error" in result && typeof result.error === "string") throw new ActionError(result.error, "SIGNUP_REFUSED");
  return { codeSent: true as const };
}

export const mobileConfirmInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320).refine(isUvaEmail),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().max(512).optional(),
}).strict();

/** Verifies the emailed code and hands the confirmed session to the app, which stores it in the Keychain. */
export async function mobileConfirmEmail(input: z.infer<typeof mobileConfirmInput>, request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  // The same per-address burst limit as the web route; the durable per-email limits are in verifyEmailCode.
  if (!rateLimiter.check(RATE_LIMITS.emailCode, rateLimitKey({ forwardedFor, isIp: nodeIsIp })).ok) throw new ActionError(RATE_LIMIT_MESSAGE, "RATE_LIMITED");
  const password = registrationSchema.shape.password.safeParse(input.password).success ? input.password : undefined;
  const { verifyEmailCode } = await import("@/lib/email-code-session");
  const verified = await verifyEmailCode({ email: input.email, code: input.code, password, clientIp: clientIp(forwardedFor, nodeIsIp) ?? undefined });
  if (!verified.ok) throw new ActionError(verified.error, verified.status === 429 ? "RATE_LIMITED" : verified.status === 503 ? AUTH_UNAVAILABLE : "CODE_REJECTED");
  return { session: verified.session, passwordSaved: !verified.passwordUpdated || verified.passwordSaved };
}

/** Records the clickwrap for the signed-in account (sign-up, once the email is confirmed). */
export async function mobileAcceptTerms() {
  const { acceptCurrentTerms } = await import("@/actions/terms");
  const result = await acceptCurrentTerms({ acceptTerms: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
  if ("error" in result && typeof result.error === "string") throw new ActionError(result.error, "TERMS_REFUSED");
  return { accepted: true as const };
}

export const mobileResetPasswordInput = z.object({
  tokenHash: z.string().max(512),
  password: z.string().max(512),
  confirmation: z.string().max(512),
  authenticatorCode: z.string().max(6).optional(),
}).strict();

const RESET_UNAVAILABLE = "Password recovery is temporarily unavailable. Please try again later.";

/**
 * Sets a new password from the emailed reset link, opened in the app (lib/app-links.ts claims
 * /reset-password). The same steps as the website (lib/password-reset-complete.ts), through an
 * isolated provider client, so the app's own session is never used or replaced. Like the website,
 * it ends by signing the account out everywhere; the app then asks for the new password.
 */
export async function mobileResetPassword(input: z.infer<typeof mobileResetPasswordInput>, request: Request) {
  // The website's per-address limit for the same route.
  if (!rateLimiter.check(RATE_LIMITS.passwordRecovery, rateLimitKey({ forwardedFor: request.headers.get("x-forwarded-for"), isIp: nodeIsIp })).ok)
    throw new ActionError(RATE_LIMIT_MESSAGE, "RATE_LIMITED");
  const { passwordReset } = await import("@/lib/password-recovery");
  const { passwordIssue } = await import("@/lib/password-policy");
  const reset = passwordReset.safeParse({ ...input, authenticatorCode: input.authenticatorCode || undefined });
  if (!reset.success) throw new ActionError(passwordIssue(input.password) ?? "Use matching passwords and a valid reset link.", "RESET_REFUSED");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ActionError(RESET_UNAVAILABLE, AUTH_UNAVAILABLE);
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { completePasswordReset } = await import("@/lib/password-reset-complete");
  const done = await completePasswordReset(client, reset.data, url);
  if (done.status === 200 && done.body.message) return { message: done.body.message };
  throw new ActionError(done.body.error ?? RESET_UNAVAILABLE,
    done.status === 503 ? AUTH_UNAVAILABLE : done.body.needsNewLink ? "RESET_LINK_INVALID" : "RESET_REFUSED");
}
