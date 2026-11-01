"use client"
import { useEffect, useState } from "react"
import { startWelcomeClock } from "@/lib/welcome-clock"

export function useWelcomeClock() {
  // Identical server/first-client render; local time is read only after hydration.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => startWelcomeClock(setNow, {
    now: () => new Date(), setTimeout, clearTimeout, window, document,
  }), [])
  return now
}
