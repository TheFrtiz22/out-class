/**
 * Cloudflare Turnstile bot checks for public, signed-out forms.
 *
 * Off unless both keys are set, so deployments without keys keep today's
 * behavior. Once configured, verification fails closed: a missing, reused,
 * mismatched or unverifiable token never reaches account creation or email.
 */
export type TurnstileAction = "signup" | "password-recovery" | "school-request"
export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "rejected" | "unavailable" }

type Env = Record<string, string | undefined>
type Fetcher = (input: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
/** Cloudflare issues tokens up to 2048 characters. */
const MAX_TOKEN_LENGTH = 2048

/** NEXT_PUBLIC_ values are fixed at build time. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""

export function turnstileConfigured(env: Env = process.env) {
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY)
}

/** First hop of x-forwarded-for (Vercel sets it); optional for siteverify. */
export function turnstileRemoteIp(forwardedFor: string | null | undefined) {
  const first = forwardedFor?.split(",")[0]?.trim()
  return first && first.length <= 64 ? first : undefined
}

export async function verifyTurnstile(token: unknown, { action, remoteIp, env = process.env, fetcher = fetch }: {
  action: TurnstileAction; remoteIp?: string; env?: Env; fetcher?: Fetcher
}): Promise<TurnstileResult> {
  if (!turnstileConfigured(env)) return { ok: true }
  if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "missing" }
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token })
  if (remoteIp) body.set("remoteip", remoteIp)
  try {
    const response = await fetcher(VERIFY_URL, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return { ok: false, reason: "unavailable" }
    const result = await response.json() as { success?: unknown; action?: unknown }
    // A token minted for another form is not accepted here.
    return result.success === true && result.action === action ? { ok: true } : { ok: false, reason: "rejected" }
  } catch {
    return { ok: false, reason: "unavailable" }
  }
}

export function turnstileMessage(reason: "missing" | "rejected" | "unavailable") {
  return reason === "unavailable"
    ? "The security check is temporarily unavailable. Please try again."
    : "Complete the security check and try again."
}
