"use client"
import { useEffect, useState } from "react"
import { getAdminReportsPulse } from "@/lib/workspace-api"
import { adminReportsRealtime, startAdminReportsLive } from "@/lib/admin-reports-live"
import { ADMIN_REPORTS_CHANGED_EVENT, adminReportsRealtimeEnabled } from "@/lib/feedback-reports"

/**
 * Open issue/feedback count for the admin Reports nav item. One live connection per admin shell:
 * when the queue's fingerprint changes it dispatches ADMIN_REPORTS_CHANGED_EVENT, and the Reports
 * page refetches through listAdminReports. Off outside the admin workspace, in Demo Mode and
 * during support sessions.
 */
export function useAdminReportsBadge(enabled: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) { setCount(0); return }
    let active = true, running = false, again = false, fingerprint: string | undefined
    const check = async () => {
      if (running) { again = true; return }
      running = true
      try {
        const pulse = await getAdminReportsPulse()
        if (!active) return
        setCount(pulse.openFeedback)
        if (fingerprint !== undefined && fingerprint !== pulse.fingerprint) window.dispatchEvent(new Event(ADMIN_REPORTS_CHANGED_EVENT))
        fingerprint = pulse.fingerprint
      } catch { /* The next poll, focus or signal tries again. */ }
      finally { running = false; if (again && active) { again = false; void check() } }
    }
    const refresh = () => { void check() }
    // A resolve on the Reports page re-checks at once instead of waiting for the next poll.
    window.addEventListener("outclass:admin-reports-resolved", refresh)
    const stop = startAdminReportsLive({ check: refresh, openRealtime: adminReportsRealtimeEnabled() ? adminReportsRealtime() : undefined })
    return () => { active = false; stop(); window.removeEventListener("outclass:admin-reports-resolved", refresh) }
  }, [enabled])
  return count
}
