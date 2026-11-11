"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { minuteClock } from "@/lib/minute-clock"

// Offset from this device's clock to the server's, measured when a server-rendered view hydrates. It
// includes the render-to-hydration delay (seconds), which is fine for minute-level deadline display.
let measuredOffset = 0
const subscribeNever = () => () => {}

/**
 * A minute clock for deadline and event state. While a server-rendered view hydrates, the first render
 * uses `serverNow`, the server's render time, so the markup matches the server's HTML even when the
 * device clock is off. Later renders and later mounts (e.g. returning to the profile from another view)
 * use the device clock plus the offset measured at that hydration, never the stale render time.
 * Without a hydration anchor it is the device clock.
 *
 * Every caller shares the one minute clock in `@/lib/minute-clock` (no per-view timers). `enabled`
 * false (e.g. a closed panel) stops the minute re-renders; turning it on reads the time at once.
 */
export function useServerAnchoredNow(serverNow?: number, enabled = true) {
  const hydrating = useSyncExternalStore(subscribeNever, () => false, () => true)
  const [now, setNow] = useState(() => {
    if (serverNow === undefined || !hydrating) return Date.now() + measuredOffset
    if (typeof window !== "undefined") measuredOffset = serverNow - Date.now()
    return serverNow
  })
  useEffect(() => {
    if (!enabled) return
    return minuteClock.subscribe(() => setNow(Date.now() + measuredOffset))
  }, [enabled])
  return now
}
