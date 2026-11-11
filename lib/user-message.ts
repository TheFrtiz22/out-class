import { isActionResult } from "@/lib/action-result"

// Text that must never reach a person, even inside a message marked safe.
const internal = [
  /server components render/i,
  /omitted in production/i,
  /\bdigest\b/i,
  /NEXT_[A-Z_]+/,
  /prisma|\bP[1-5]\d{3}\b|invalid `|\binvocation\b/i,
  /supabase|PGRST\d*|postgres|\bSQLSTATE\b|duplicate key|violates|relation "|column "/i,
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b|undefined is not|cannot read propert/i,
  /\bat \S+ \(|\bat (?:async )?\S+:\d+:\d+|\n\s+at /,
  /fetch failed|ECONN[A-Z]+|ETIMEDOUT|ENOTFOUND|socket hang up/i,
]

function safe(message: unknown): message is string {
  if (typeof message !== "string") return false
  const text = message.trim()
  return text.length > 0 && text.length <= 400 && !internal.some(pattern => pattern.test(text))
}

/**
 * The text to show for a failed operation. Only messages our own code marked
 * user-facing (an `ActionError` returned through `actionResult`, a
 * `UserFacingError`, or a failed action result) are shown; everything else,
 * including Next's production "Server Components render" text, digests, stack
 * traces and Prisma/Supabase internals, becomes the calm `fallback`.
 */
export function userMessage(error: unknown, fallback: string): string {
  if (isActionResult(error)) return !error.ok && safe(error.error) ? error.error.trim() : fallback
  if (!error || typeof error !== "object") return fallback
  const candidate = error as { userFacing?: unknown; message?: unknown; digest?: unknown }
  if (candidate.userFacing !== true || candidate.digest !== undefined) return fallback
  return safe(candidate.message) ? candidate.message.trim() : fallback
}
