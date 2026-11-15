import { headers } from "next/headers"
import { nodeIsIp, rateLimiter, rateLimitKey, type RateLimitPolicy, type RateLimitResult } from "@/lib/rate-limit"

/** Server actions cannot set a status, so callers turn a failed result into their usual error shape. */
export async function limitAction(policy: RateLimitPolicy, { userId }: { userId?: string | null } = {}): Promise<RateLimitResult> {
  let forwardedFor: string | null = null
  // Without request headers the caller lands in the shared "unknown address" bucket, which is still limited.
  try { forwardedFor = (await headers()).get("x-forwarded-for") } catch { forwardedFor = null }
  return rateLimiter.check(policy, rateLimitKey({ userId, forwardedFor, isIp: nodeIsIp }))
}
