/**
 * Optional two-step sign-in (TOTP) for every account, backed by Supabase Auth MFA factors.
 * Ships dark: nothing changes until the server sets OUTCLASS_USER_MFA=1. Edge-safe (middleware).
 */
export const TWO_STEP_CHALLENGE_PATH = "/auth/two-step"

export function userMfaEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.OUTCLASS_USER_MFA === "1"
}

type FactorLike = { status?: string | null }
/** Pass only a user returned by Auth.getUser (server-verified), never cookie-stored session data. */
export function verifiedFactorCount(user: { factors?: FactorLike[] | null } | null | undefined): number {
  return (user?.factors ?? []).filter(factor => factor?.status === "verified").length
}

/** Reads the `aal` claim. Call only on a token Auth.getUser has just verified. */
export function tokenAssurance(token: string | null | undefined): string | null {
  try {
    const part = token?.split(".")[1]
    if (!part) return null
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")
    const claims = JSON.parse(atob(base64))
    return typeof claims?.aal === "string" ? claims.aal : null
  } catch {
    return null
  }
}

/** True when an enrolled account's session has not completed its second factor. */
export function secondFactorPending(
  user: { factors?: FactorLike[] | null } | null | undefined,
  token: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!userMfaEnabled(env) || !user || verifiedFactorCount(user) === 0) return false
  return tokenAssurance(token) !== "aal2"
}

/** Paths an enrolled, not-yet-verified session may still reach: the challenge, sign-out and recovery. */
const PENDING_ALLOWED = new Set([
  TWO_STEP_CHALLENGE_PATH,
  "/api/auth/two-step",
  "/api/auth/logout",
  "/api/auth/password-recovery",
  "/auth/callback",
  "/auth/microsoft",
  "/forgot-password",
  "/reset-password",
])
export function allowedWhileSecondFactorPending(path: string): boolean {
  return PENDING_ALLOWED.has(path)
}

export function twoStepChallengeHref(pathname: string, search = ""): string {
  const next = pathname + search
  const safe = next.startsWith("/") && !next.startsWith("//") && pathname !== TWO_STEP_CHALLENGE_PATH ? next : "/"
  return `${TWO_STEP_CHALLENGE_PATH}?next=${encodeURIComponent(safe)}`
}

export const TWO_STEP_REQUIRED_MESSAGE = "Enter the code from your authenticator app to continue."
