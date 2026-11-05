/**
 * Keeps the inbox current with as little server work as possible:
 * - a visible tab listens to the communications stream and refreshes only when
 *   the stream's revision changes (the stream re-sends its current revision on
 *   every reconnect, roughly every 48 seconds);
 * - a hidden tab holds no stream open and does not poll, then catches up when
 *   it becomes visible again;
 * - polling is the fallback only while the stream is not connected (support
 *   sessions, the stream reporting it is unavailable, or a reconnect gap).
 */
type Source = Pick<EventSource, "addEventListener" | "close" | "readyState">

export type CommunicationsLiveOptions = {
  /** Reload the inbox. Called for the first stream revision and every change. */
  changed: () => void
  /** False during support sessions, which may not open the live stream. */
  streamAllowed: boolean
  pollMs?: number
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
  win?: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">
  openStream?: () => Source
}

const OPEN = 1

export function startCommunicationsLive({
  changed,
  streamAllowed,
  pollMs = 30000,
  doc = document,
  win = window,
  openStream = () => new EventSource("/api/communications/stream"),
}: CommunicationsLiveOptions) {
  let source: Source | null = null, revision: string | undefined, unavailable = !streamAllowed, stopped = false
  const hidden = () => doc.visibilityState === "hidden"
  const disconnect = () => { source?.close(); source = null }
  const connect = () => {
    if (stopped || unavailable || source || hidden()) return
    const stream = source = openStream()
    stream.addEventListener("communications", (event: Event) => {
      if (source !== stream) return
      let next: string | undefined
      try { next = JSON.parse((event as MessageEvent).data)?.revision } catch { /* Refresh below. */ }
      // The first revision may race the initial load, so it always refreshes.
      // Later identical revisions are reconnects with nothing new to fetch.
      if (typeof next === "string" && revision !== undefined && next === revision) return
      revision = next
      changed()
    })
    stream.addEventListener("unavailable", () => {
      if (source !== stream) return
      unavailable = true
      disconnect()
    })
  }
  const visibility = () => {
    if (hidden()) { disconnect(); return }
    // Without a stream, catch up directly; with one, its first revision decides.
    if (unavailable) changed()
    else connect()
  }
  const poll = () => {
    if (hidden() || source?.readyState === OPEN) return
    changed()
  }
  const timer = win.setInterval(poll, pollMs)
  const focus = () => changed()
  const notified = () => changed()
  doc.addEventListener("visibilitychange", visibility)
  win.addEventListener("focus", focus)
  win.addEventListener("outclass:communications-changed", notified)
  connect()
  return () => {
    stopped = true
    win.clearInterval(timer)
    disconnect()
    doc.removeEventListener("visibilitychange", visibility)
    win.removeEventListener("focus", focus)
    win.removeEventListener("outclass:communications-changed", notified)
  }
}
