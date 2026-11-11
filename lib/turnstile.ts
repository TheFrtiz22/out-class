/**
 * Cloudflare Turnstile bot checks for signed-out forms.
 *
 * A token can be redeemed once, so each token has exactly one verifier:
 * - Server paths (signup, password recovery, school requests, student claims):
 *   OutClass runs siteverify, unless TURNSTILE_AUTH_ENFORCED_BY_SUPABASE is "1".
 *   With that flag, Auth server paths only refuse a missing token and forward it
 *   to Supabase Auth as `captchaToken` (`authTurnstile`).
 * - Browser Auth calls (password and code sign-in, code resend) and the Admin
 *   password re-check always forward the token; only Supabase's Bot and Abuse
 *   Protection setting verifies them, so they are protected once that is on.
 *
 * Completely off (no script, no widget, no checks) unless BOTH
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set at build:
 * next.config.mjs turns that into TURNSTILE_ENABLED, which the browser and the
 * server both require, so keys added without a rebuild change nothing. The
 * browser never sees the secret. Once configured, verification fails closed.
 */
export type TurnstileAction = "signup" | "login" | "password-recovery" | "school-request" | "student-claim" | "admin" | "two-step"
export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "rejected" | "unavailable" }

type Env = Record<string, string | undefined>
type Fetcher = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json" | "status">>

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
/** Cloudflare issues tokens up to 2048 characters. */
const MAX_TOKEN_LENGTH = 2048
/** These mean OutClass is misconfigured or Cloudflare failed, not that the visitor is a bot. */
const OPERATOR_ERRORS = new Set(["missing-input-secret", "invalid-input-secret", "internal-error"])

/** Upper bound on one siteverify call. An outage fails closed with a "try again" message. */
export const TURNSTILE_TIMEOUT_MS = 2500

/**
 * Fixed at build time. TURNSTILE_ENABLED is "1" only when both keys were set at
 * build (next.config.mjs), so a site key alone never loads the widget.
 */
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_ENABLED === "1" ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "" : ""

/** Inlined at build by next.config.mjs; the same value the browser was built with. */
const BUILT_ENABLED = process.env.TURNSTILE_ENABLED

export function turnstileConfigured(env: Env = process.env) {
  return (env.TURNSTILE_ENABLED ?? BUILT_ENABLED) === "1" && Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY)
}

/** Server-only: "1" once Supabase Auth's captcha setting is on (same secret). */
export function supabaseVerifiesCaptcha(env: Env = process.env) {
  return env.TURNSTILE_AUTH_ENFORCED_BY_SUPABASE === "1"
}

/** Supabase Auth option. Only a well-formed token is passed; Supabase rejects missing ones when enforcing. */
export function captchaOption(token: unknown): { captchaToken?: string } {
  return typeof token === "string" && token && token.length <= MAX_TOKEN_LENGTH ? { captchaToken: token } : {}
}

/**
 * For server paths where Supabase Auth verifies the token: refuse a missing one
 * when configured, without calling siteverify (that would spend the single-use
 * token before Supabase sees it).
 */
export function turnstileTokenPresent(token: unknown, env: Env = process.env) {
  return !turnstileConfigured(env) || Boolean(captchaOption(token).captchaToken)
}

/** Adds the token to Supabase Auth call options; unchanged parameters when there is none. */
export function withCaptcha<T extends object>(params: T, token: unknown): T {
  const option = captchaOption(token)
  return option.captchaToken ? { ...params, options: { ...(params as { options?: object }).options, ...option } } : params
}

/** True when forms must wait for a token before submitting. */
export const turnstileRequired = Boolean(TURNSTILE_SITE_KEY)

/** Shown when a form is submitted before a token arrives. */
export const TURNSTILE_PENDING = "Finishing a quick security check. Try again in a moment."

/** Supabase reports a missing or failed captcha with this code. */
export function captchaFailed(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === "captcha_failed" || /captcha/i.test(error.message ?? ""))
}

/** First hop of x-forwarded-for (Vercel sets it); optional for siteverify. */
export function turnstileRemoteIp(forwardedFor: string | null | undefined) {
  const first = forwardedFor?.split(",")[0]?.trim()
  return first && first.length <= 64 ? first : undefined
}

export async function verifyTurnstile(token: unknown, { action, remoteIp, env = process.env, fetcher = fetch, timeoutMs = TURNSTILE_TIMEOUT_MS }: {
  action: TurnstileAction; remoteIp?: string; env?: Env; fetcher?: Fetcher; timeoutMs?: number
}): Promise<TurnstileResult> {
  if (!turnstileConfigured(env)) return { ok: true }
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "missing" }
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token })
  if (remoteIp) body.set("remoteip", remoteIp)
  try {
    const response = await fetcher(VERIFY_URL, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.warn("Turnstile verification unavailable", { status: response.status })
      return { ok: false, reason: "unavailable" }
    }
    const result = await response.json() as { success?: unknown; action?: unknown; "error-codes"?: unknown }
    if (result.success === true && result.action === action) return { ok: true }
    const codes = Array.isArray(result["error-codes"]) ? result["error-codes"].filter((code): code is string => typeof code === "string").slice(0, 5) : []
    if (codes.some(code => OPERATOR_ERRORS.has(code))) {
      console.warn("Turnstile verification misconfigured", { codes })
      return { ok: false, reason: "unavailable" }
    }
    // A token minted for another form is not accepted here.
    return { ok: false, reason: "rejected" }
  } catch {
    console.warn("Turnstile verification unavailable")
    return { ok: false, reason: "unavailable" }
  }
}

/**
 * Server-side Supabase Auth calls (signup, password recovery). Returns the
 * options to spread into the Auth call: the token only when Supabase is the
 * verifier, otherwise nothing, because siteverify has already spent it.
 */
export async function authTurnstile(token: unknown, opts: {
  action: TurnstileAction; remoteIp?: string; env?: Env; fetcher?: Fetcher; timeoutMs?: number
}): Promise<{ ok: true; captcha: { captchaToken?: string } } | { ok: false; reason: "missing" | "rejected" | "unavailable" }> {
  const env = opts.env ?? process.env
  if (!turnstileConfigured(env)) return { ok: true, captcha: captchaOption(token) }
  if (supabaseVerifiesCaptcha(env)) return turnstileTokenPresent(token, env) ? { ok: true, captcha: captchaOption(token) } : { ok: false, reason: "missing" }
  const check = await verifyTurnstile(token, { ...opts, env })
  return check.ok ? { ok: true, captcha: {} } : check
}

export function turnstileMessage(reason: "missing" | "rejected" | "unavailable") {
  return reason === "unavailable"
    ? "The security check is temporarily unavailable. Please try again."
    : "The security check expired. Please submit again."
}
