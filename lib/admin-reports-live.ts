import type { RealtimeConnection, RealtimeHandlers } from "@/lib/communications-live"
import { ADMIN_REPORTS_EVENT, ADMIN_REPORTS_POLL_MS, ADMIN_REPORTS_TOPIC } from "@/lib/feedback-reports"

/**
 * Joins the private platform-admin reports channel (same client pattern as lib/inbox-realtime.ts).
 * The server broadcasts an empty "reports" event there after a report is filed or resolved;
 * Realtime admits only active platform admins once the owner installs the receive policy.
 */
export function adminReportsRealtime() {
  return ({ signal, ready, failed }: RealtimeHandlers): RealtimeConnection => {
    let closed = false, remove: (() => void) | undefined
    void import("@/utils/supabase/client").then(async ({ createClient }) => {
      if (closed) return
      const supabase = createClient()
      await supabase.realtime.setAuth()
      if (closed) return
      const channel = supabase.channel(ADMIN_REPORTS_TOPIC, { config: { private: true } })
      // The payload is ignored: it is empty by design, and the page refetches through the audited action.
      channel.on("broadcast", { event: ADMIN_REPORTS_EVENT }, () => signal())
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") ready()
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") failed()
      })
      remove = () => { void supabase.removeChannel(channel) }
    }).catch(() => { if (!closed) failed() })
    return { close() { closed = true; remove?.() } }
  }
}

export type AdminReportsLiveOptions = {
  /** Re-check the queue (the shell calls getAdminReportsPulse). */
  check: () => void
  /** Omitted while the Realtime policy is not installed: polling only. */
  openRealtime?: (handlers: RealtimeHandlers) => RealtimeConnection
  pollMs?: number
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
  win?: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">
}

/**
 * Keeps the admin Reports badge and queue current: a visible tab joins the private channel and
 * re-checks on each signal; without a joined channel it polls every 20 s while visible. A hidden
 * tab holds no channel and does not poll, then re-checks when it becomes visible or focused.
 */
export function startAdminReportsLive({ check, openRealtime, pollMs = ADMIN_REPORTS_POLL_MS, doc = document, win = window }: AdminReportsLiveOptions) {
  let realtime: RealtimeConnection | null = null, ready = false, failed = !openRealtime, stopped = false
  const hidden = () => doc.visibilityState === "hidden"
  const disconnect = () => { realtime?.close(); realtime = null; ready = false }
  const connect = () => {
    if (stopped || failed || realtime || hidden()) return
    const connection: RealtimeConnection = realtime = openRealtime!({
      signal: () => { if (realtime === connection) check() },
      // Signals sent while disconnected are not replayed, so every (re)join re-checks once.
      ready: () => { if (realtime === connection) { ready = true; check() } },
      failed: () => { if (realtime !== connection) return; failed = true; disconnect() },
    })
  }
  const visibility = () => { if (hidden()) disconnect(); else { check(); connect() } }
  const poll = () => { if (!hidden() && !ready) check() }
  const timer = win.setInterval(poll, pollMs)
  doc.addEventListener("visibilitychange", visibility)
  win.addEventListener("focus", check)
  check()
  connect()
  return () => {
    stopped = true
    win.clearInterval(timer)
    disconnect()
    doc.removeEventListener("visibilitychange", visibility)
    win.removeEventListener("focus", check)
  }
}
