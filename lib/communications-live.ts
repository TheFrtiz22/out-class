/**
 * Keeps the inbox current with as little server work as possible:
 * - a visible tab joins its private Supabase Realtime inbox channel and refreshes
 *   on each signal (the signal carries no data, only "something changed");
 * - if Realtime cannot be joined, it falls back to the communications stream and
 *   refreshes only when the stream's revision changes (the stream re-sends its
 *   current revision on every reconnect, roughly every 48 seconds);
 * - a hidden tab holds no channel or stream and does not poll, then catches up
 *   when it becomes visible again;
 * - polling is the fallback only while nothing live is connected (support
 *   sessions, both live transports unavailable, or a reconnect gap).
 */
type Source = Pick<EventSource, "addEventListener" | "close" | "readyState">
export type RealtimeHandlers = { signal: () => void; ready: () => void; failed: () => void }
export type RealtimeConnection = { close: () => void }

export type CommunicationsLiveOptions = {
  /** Reload the inbox. */
  changed: () => void
  /** False during support sessions, which may not open live channels. */
  streamAllowed: boolean
  /** Joins the private inbox channel; omitted, only the stream is used. */
  openRealtime?: (handlers: RealtimeHandlers) => RealtimeConnection
  pollMs?: number
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
  win?: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">
  openStream?: () => Source
}

const OPEN = 1

export function startCommunicationsLive({
  changed,
  streamAllowed,
  openRealtime,
  pollMs = 30000,
  doc = document,
  win = window,
  openStream = () => new EventSource("/api/communications/stream"),
}: CommunicationsLiveOptions) {
  let source: Source | null = null, revision: string | undefined, unavailable = !streamAllowed, stopped = false
  let realtime: RealtimeConnection | null = null, realtimeReady = false, realtimeFailed = !openRealtime
  const hidden = () => doc.visibilityState === "hidden"
  const disconnect = () => {
    source?.close(); source = null
    realtime?.close(); realtime = null; realtimeReady = false
  }
  const connectStream = () => {
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
      source?.close(); source = null
    })
  }
  const connect = () => {
    if (stopped || unavailable || source || realtime || hidden()) return
    if (realtimeFailed) { connectStream(); return }
    const connection: RealtimeConnection = realtime = openRealtime!({
      signal: () => { if (realtime === connection) changed() },
      // Every (re)join refreshes once: signals sent while disconnected are not replayed.
      ready: () => { if (realtime === connection) { realtimeReady = true; changed() } },
      failed: () => {
        if (realtime !== connection) return
        realtimeFailed = true
        connection.close(); realtime = null; realtimeReady = false
        connectStream()
      },
    })
  }
  const visibility = () => {
    if (hidden()) { disconnect(); return }
    // Without a live transport, catch up directly; with one, joining refreshes.
    if (unavailable) changed()
    else connect()
  }
  const poll = () => {
    if (hidden() || realtimeReady || source?.readyState === OPEN) return
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
