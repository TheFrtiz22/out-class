import { adminReportsRealtimeEnabled, adminReportsSignal } from "@/lib/feedback-reports"

/**
 * After a commit that changes the queue: tells active platform admins' open pages to refetch.
 * The payload is empty; no report content travels over Realtime. Best effort and off until the
 * owner installs the receive policy, because every page also polls.
 */
export async function signalAdminReportsChanged(fetchImpl: typeof fetch = fetch) {
  if (!adminReportsRealtimeEnabled()) return false
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  try {
    const response = await fetchImpl(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      // Legacy service-role keys are JWTs and go in Authorization too; new secret keys go in apikey only.
      headers: { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" },
      body: JSON.stringify(adminReportsSignal()),
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}
