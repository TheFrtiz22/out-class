import { ActionError, actionResult, type ActionResult } from "@/lib/action-result";
export type AdminDenialCode = "ADMIN_AUTH_REQUIRED" | "ADMIN_ACCESS_DENIED" | "ADMIN_ELEVATION_REQUIRED" | "ADMIN_MFA_REQUIRED" | "ADMIN_GRANT_REVOKED" | "ADMIN_SESSION_EXPIRED" | "ADMIN_SUPPORT_SESSION_CONFLICT";
export class AdminAccessError extends Error {
  constructor(public readonly code: AdminDenialCode, message: string) { super(message); }
}
/** Admin denials the console answers by sending the administrator back to /platform/login. */
export const ADMIN_REVERIFY_CODES: readonly string[] = ["ADMIN_ELEVATION_REQUIRED", "ADMIN_MFA_REQUIRED", "ADMIN_SESSION_EXPIRED"];
/**
 * actionResult for platform admin Server Actions. An AdminAccessError that only asks an administrator
 * to verify again (stale password/MFA check, missing MFA, expired session) becomes a returned refusal
 * carrying its safe message and code, so the console can offer re-verification instead of production
 * masking it as a 500. Other denials (not an admin, revoked grant) still throw, so they keep alerting.
 */
export function adminActionResult<T>(work: () => Promise<T>, action: string): Promise<ActionResult<T>> {
  return actionResult(async () => {
    try { return await work(); }
    catch (error) {
      if (error instanceof AdminAccessError && ADMIN_REVERIFY_CODES.includes(error.code)) throw new ActionError(error.message, error.code);
      throw error;
    }
  }, action);
}
const providerDenialCodes = new Set([
  "bad_jwt", "invalid_jwt", "no_authorization", "not_admin", "invalid_credentials",
  "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used",
  "user_not_found", "user_banned", "email_not_confirmed", "phone_not_confirmed",
  "insufficient_aal", "mfa_factor_not_found", "mfa_challenge_expired", "mfa_ip_address_mismatch",
  "mfa_verification_failed", "mfa_verification_rejected", "reauthentication_needed", "reauthentication_not_valid",
]);
/** Supabase error semantics, never a blanket HTTP 4xx or message-text match.
 * Unknown/malformed responses and provider configuration failures fail operationally.
 */
export function providerAuthFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { status, name, code } = error as { status?: unknown; name?: unknown; code?: unknown };
  if (status !== undefined && status !== 400 && status !== 401 && status !== 403 && status !== 422) return false;
  if (name === "AuthInvalidTokenResponseError" || name === "AuthUnknownError" || name === "AuthRetryableFetchError") return false;
  if (code !== undefined) return typeof code === "string" && providerDenialCodes.has(code);
  return name === "AuthSessionMissingError" || name === "AuthInvalidCredentialsError" || name === "AuthInvalidJwtError";
}
