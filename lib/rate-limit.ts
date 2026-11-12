import { isIP } from "node:net"
import { rateLimiter, rateLimitKey, rateLimitedResponse, type RateLimitPolicy } from "@/lib/rate-limit-core"

export * from "@/lib/rate-limit-core"

export const nodeIsIp = (value: string) => isIP(value) !== 0

/** Route handlers: a 429 response (with Retry-After) when the caller is over the limit, otherwise null. */
export function limitRequest(request: Request, policy: RateLimitPolicy, { userId, key }: { userId?: string | null; key?: string } = {}) {
  const result = rateLimiter.check(policy, key ?? rateLimitKey({ userId, forwardedFor: request.headers.get("x-forwarded-for"), isIp: nodeIsIp }))
  return result.ok ? null : rateLimitedResponse(result.retryAfterSeconds)
}
