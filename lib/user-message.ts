import { isActionResult } from "@/lib/action-result"

// Text that must never reach a person, even inside a message marked safe.
const internal = [
  // Next's production replacement text (the digest itself is checked as a property below).
  /server components render/i,
  /omitted in production/i,
  /\bNEXT_[A-Z_]{3,}/,
  // Prisma: client error classes, error codes and query invocations.
  /\bPrisma(?:Client)?[A-Z]\w*Error\b|\bP[1-5]\d{3}\b|[Ii]nvalid `prisma\.|`prisma\.\w+\.\w+\(\)`/,
  // Supabase/PostgREST/Postgres internals.
  /\bPGRST\d+\b|\bSQLSTATE\b|duplicate key value|violates (?:unique|foreign key|check|not-null|exclusion) constraint|\b(?:relation|column) "[^"]+" does not exist|\bJWT expired\b|\bsupabase(?:\.co|-js)\b|storage upload failed/i,
  // JavaScript runtime errors and stack frames.
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError):|undefined is not|cannot read properties of/i,
  /\n\s+at |\bat (?:async )?\S*[\\/]\S+:\d+:\d+/,
  // Network internals.
  /^fetch failed$|\bECONN[A-Z]+\b|\bETIMEDOUT\b|\bENOTFOUND\b|socket hang up/i,
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
