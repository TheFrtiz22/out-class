/**
 * Shared request limiter core (edge-safe: no Node built-ins, so middleware can use it too).
 * Route handlers import `@/lib/rate-limit`; server actions import `@/lib/rate-limit-action`.
 *
 * Counts live in process memory, so every limit here is per serverless instance. Vercel runs many
 * instances, so these limits bound the cost of a burst that lands on one instance; the global layer is
 * the Vercel Firewall rules in docs/rate-limits.md. Routes whose single request is expensive add a
 * coarse database check on top (club exports count recent audit rows).
 */

export type RateLimitPolicy = { name: string; limit: number; windowMs: number }
export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number }
type Entry = { count: number; resetAt: number; logged: boolean }

const minute = 60_000

/** Per-route policies. Keep this table and docs/rate-limits.md in step. */
export const RATE_LIMITS = {
  search: { name: "search", limit: 60, windowMs: minute },
  clubExports: { name: "club-exports", limit: 10, windowMs: 10 * minute },
  // Generous: a large event can put many phones behind one campus network address.
  shortLinks: { name: "short-links", limit: 120, windowMs: minute },
  clubAssets: { name: "club-assets", limit: 300, windowMs: minute },
  calendarFeed: { name: "calendar-feed", limit: 30, windowMs: 10 * minute },
  schoolRequests: { name: "school-requests", limit: 10, windowMs: 60 * minute },
  passwordRecovery: { name: "password-recovery", limit: 10, windowMs: 15 * minute },
  studentClaim: { name: "student-claim", limit: 10, windowMs: 15 * minute },
  signup: { name: "signup", limit: 20, windowMs: 60 * minute },
  adminElevation: { name: "admin-elevation", limit: 20, windowMs: 15 * minute },
  adminViewAs: { name: "admin-view-as", limit: 60, windowMs: 10 * minute },
  adminViewAsBlocked: { name: "admin-view-as-blocked", limit: 60, windowMs: minute },
  demoMode: { name: "demo-mode", limit: 30, windowMs: 10 * minute },
} as const satisfies Record<string, RateLimitPolicy>

export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again."

/** Fixed-window counter keyed by policy and caller, bounded as an LRU so memory stays flat. */
export function createRateLimiter({ maxKeys = 10_000, now = () => Date.now(), log = (message: string) => console.warn(message) } = {}) {
  const entries = new Map<string, Entry>()
  function check(policy: RateLimitPolicy, key: string): RateLimitResult {
    const id = `${policy.name}:${key}`, time = now()
    let entry = entries.get(id)
    if (entry) entries.delete(id)
    if (!entry || entry.resetAt <= time) entry = { count: 0, resetAt: time + policy.windowMs, logged: false }
    entry.count++
    entries.set(id, entry)
    while (entries.size > maxKeys) entries.delete(entries.keys().next().value as string)
    if (entry.count <= policy.limit) return { ok: true, remaining: policy.limit - entry.count }
    if (!entry.logged) {
      entry.logged = true
      // Logged once per key and window, without the key: addresses and account ids stay out of logs.
      log(`rate-limit: ${policy.name} limit reached (${policy.limit} per ${Math.round(policy.windowMs / 1000)}s)`)
    }
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - time) / 1000)) }
  }
  return { check, size: () => entries.size, reset: () => entries.clear() }
}

/** One limiter per instance, shared by every route that imports this module. */
export const rateLimiter = createRateLimiter()

const ipv4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** Edge-safe equivalent of `net.isIP(value) !== 0` (tests assert parity), except scoped `%zone` addresses are refused. */
export function isIpAddress(value: string) {
  if (!value || value.length > 45) return false
  if (ipv4.test(value)) return true
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return false
  // An embedded IPv4 tail must itself be valid; the URL parser is lenient about it.
  const tail = value.slice(value.lastIndexOf(":") + 1)
  if (tail.includes(".") && !ipv4.test(tail)) return false
  try { return new URL(`http://[${value}]/`).hostname.length > 2 } catch { return false }
}

/** The client address from the first x-forwarded-for hop (set by Vercel), or null when invalid. */
export function clientIp(forwardedFor: string | null | undefined, isIp: (value: string) => boolean = isIpAddress) {
  const first = forwardedFor?.split(",")[0]?.trim()
  return first && first.length <= 45 && isIp(first) ? first.toLowerCase() : null
}

/**
 * Signed-in callers are keyed by account, anonymous ones by address. Requests with no valid address
 * share one bucket per policy, so a missing header cannot be used to skip the limit.
 */
export function rateLimitKey({ userId, forwardedFor, isIp }: { userId?: string | null; forwardedFor?: string | null; isIp?: (value: string) => boolean }) {
  if (userId) return `user:${userId}`
  const ip = clientIp(forwardedFor, isIp)
  return ip ? `ip:${ip}` : "ip:unknown"
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return { "Retry-After": String(retryAfterSeconds), "Cache-Control": "private, no-store" }
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: RATE_LIMIT_MESSAGE }), {
    status: 429, headers: { ...rateLimitHeaders(retryAfterSeconds), "Content-Type": "application/json; charset=utf-8" },
  })
}
