"use client"

import { useEffect, useState } from "react"

/**
 * A minute clock anchored to the server's render time. The first render (server and hydration) uses
 * `serverNow`, so time-dependent markup such as deadline state matches the server's HTML even when the
 * device clock is off; later ticks keep the offset measured at hydration. Without `serverNow` (a view
 * opened client-side) it is the device clock.
 */
export function useServerAnchoredNow(serverNow?: number, tickMs = 60_000) {
  const [offset] = useState(() => serverNow === undefined ? 0 : serverNow - Date.now())
  const [now, setNow] = useState(() => serverNow ?? Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), tickMs)
    return () => clearInterval(timer)
  }, [offset, tickMs])
  return now
}
