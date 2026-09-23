import { isUvaEmail } from "@/lib/auth"

export const DEMO_COOKIE = "outclass-demo-session"
export type DemoAccessReason = "available" | "disabled" | "invalid-configuration" | "sign-in-required" | "not-allowlisted"

/** Server configuration only. NODE_ENV/VERCEL_ENV never grant presentation access. */
export function getDemoAccess(email: string | undefined, environment = process.env): {
  allowed: boolean
  reason: DemoAccessReason
} {
  const enabled = environment.OUTCLASS_DEMO_ENABLED?.trim().toLowerCase()
  if (!enabled || enabled === "false") return { allowed: false, reason: "disabled" }
  const emails = (environment.OUTCLASS_DEMO_ALLOWED_EMAILS || "")
    .split(",").map(value => value.trim().toLowerCase())
  if (enabled !== "true" || !emails.length || emails.some(value => !isUvaEmail(value))) {
    return { allowed: false, reason: "invalid-configuration" }
  }
  if (!email) return { allowed: false, reason: "sign-in-required" }
  const allowed = isUvaEmail(email) && emails.includes(email.trim().toLowerCase())
  return { allowed, reason: allowed ? "available" : "not-allowlisted" }
}

let warned = false
export function canAccessDemo(email: string | undefined, environment = process.env) {
  const access = getDemoAccess(email, environment)
  if (access.reason === "invalid-configuration" && !warned) {
    warned = true
    console.warn("[OutClass demo] Invalid configuration. Set OUTCLASS_DEMO_ENABLED to true/false and, when enabled, OUTCLASS_DEMO_ALLOWED_EMAILS to a comma-separated list of UVA account emails. Access denied.")
  }
  return access.allowed
}
