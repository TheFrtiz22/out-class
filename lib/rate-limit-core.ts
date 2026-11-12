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
  // Signed-in search is keyed by account, so one person cannot use up a shared campus address's budget.
  searchUser: { name: "search-user", limit: 120, windowMs: minute },
  searchAnonymous: { name: "search-anonymous", limit: 300, windowMs: minute },
  clubExports: { name: "club-exports", limit: 10, windowMs: 10 * minute },
  // Generous: a 200-person check-in can put every phone behind one campus network address.
  shortLinks: { name: "short-links", limit: 600, windowMs: minute },
  clubAssets: { name: "club-assets", limit: 300, windowMs: minute },
  calendarFeed: { name: "calendar-feed", limit: 30, windowMs: 10 * minute },
  // Checked before the token lookup, so guessing random tokens cannot skip it. Calendar services poll many
  // people's feeds from shared addresses, so this stays well above a real fetcher's rate.
  calendarFeedAddress: { name: "calendar-feed-address", limit: 300, windowMs: minute },
  schoolRequests: { name: "school-requests", limit: 10, windowMs: 60 * minute },
  passwordRecovery: { name: "password-recovery", limit: 30, windowMs: 15 * minute },
  studentClaim: { name: "student-claim", limit: 30, windowMs: 15 * minute },
  // Per address, on top of the per-account attempt count the two-step route keeps in the database.
  twoStep: { name: "two-step", limit: 30, windowMs: 15 * minute },
  signup: { name: "signup", limit: 60, windowMs: 60 * minute },
  adminElevation: { name: "admin-elevation", limit: 20, windowMs: 15 * minute },
  adminViewAs: { name: "admin-view-as", limit: 60, windowMs: 10 * minute },
  adminViewAsBlocked: { name: "admin-view-as-blocked", limit: 60, windowMs: minute },
  demoMode: { name: "demo-mode", limit: 30, windowMs: 10 * minute },
} as const satisfies Record<string, RateLimitPolicy>

export const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a moment and try again."

export const UNKNOWN_ADDRESS_KEY = "ip:unknown"

/**
 * Fixed-window counters keyed by caller. Each policy has its own LRU of at most `maxKeys` callers, so a
 * flood against one policy can never evict another policy's counters, and memory stays flat.
 */
export function createRateLimiter({ maxKeys = 10_000, now = () => Date.now(), log = (message: string) => console.warn(message) } = {}) {
  const policies = new Map<string, Map<string, Entry>>()
  // Logging is best effort: a broken logger must never turn a counted request into a failure.
  const note = (message: string) => { try { log(message) } catch { /* ignore */ } }
  function check(policy: RateLimitPolicy, key: string): RateLimitResult {
    const time = now()
    let entries = policies.get(policy.name)
    if (!entries) policies.set(policy.name, entries = new Map())
    let entry = entries.get(key)
    if (entry) entries.delete(key)
    if (!entry || entry.resetAt <= time) {
      entry = { count: 0, resetAt: time + policy.windowMs, logged: false }
      // A missing or invalid client address usually means a proxy or header problem, so say so once per window.
      if (key === UNKNOWN_ADDRESS_KEY) note(`rate-limit: ${policy.name} request without a valid client address; using the shared bucket`)
    }
    entry.count++
    entries.set(key, entry)
    while (entries.size > maxKeys) entries.delete(entries.keys().next().value as string)
    if (entry.count <= policy.limit) return { ok: true, remaining: policy.limit - entry.count }
    if (!entry.logged) {
      entry.logged = true
      // Logged once per key and window, without the key: addresses and account ids stay out of logs.
      note(`rate-limit: ${policy.name} limit reached (${policy.limit} per ${Math.round(policy.windowMs / 1000)}s)`)
    }
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - time) / 1000)) }
  }
  const size = (policyName?: string) => policyName ? policies.get(policyName)?.size ?? 0 : [...policies.values()].reduce((sum, entries) => sum + entries.size, 0)
  return { check, size, reset: () => policies.clear() }
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
  return ip ? `ip:${ip}` : UNKNOWN_ADDRESS_KEY
}

export function rateLimitHeaders(retryAfterSeconds: number) {
  return { "Retry-After": String(retryAfterSeconds), "Cache-Control": "private, no-store" }
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return new Response(JSON.stringify({ error: RATE_LIMIT_MESSAGE }), {
    status: 429, headers: { ...rateLimitHeaders(retryAfterSeconds), "Content-Type": "application/json; charset=utf-8" },
  })
}
