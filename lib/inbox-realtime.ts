import type { RealtimeConnection, RealtimeHandlers } from "@/lib/communications-live"

/**
 * Joins the signed-in user's private inbox channel. The database broadcasts an
 * empty "inbox" event there on every notification change; Realtime admits only
 * the user whose auth id matches the topic (see the inbox_realtime_signal
 * migration). The Supabase client loads on demand, outside the root bundle.
 */
export function inboxRealtime(userId: string) {
  return ({ signal, ready, failed }: RealtimeHandlers): RealtimeConnection => {
    let closed = false, remove: (() => void) | undefined
    void import("@/utils/supabase/client").then(async ({ createClient }) => {
      if (closed) return
      const supabase = createClient()
      // Private channels are authorized with the user's access token, which must
      // be on the socket before joining; otherwise the join carries only the
      // publishable key and Realtime refuses the topic.
      await supabase.realtime.setAuth()
      if (closed) return
      const channel = supabase.channel(`inbox:${userId}`, { config: { private: true } })
      channel.on("broadcast", { event: "inbox" }, () => signal())
      channel.subscribe(status => {
        if (status === "SUBSCRIBED") ready()
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") failed()
      })
      remove = () => { void supabase.removeChannel(channel) }
    }).catch(() => { if (!closed) failed() })
    return { close() { closed = true; remove?.() } }
  }
}
