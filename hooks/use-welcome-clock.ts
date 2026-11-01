"use client"
import { useEffect, useState } from "react"
import { startWelcomeClock } from "@/lib/welcome-clock"

export function useWelcomeClock() {
  // Identical server/first-client render; local time is read only after hydration.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => startWelcomeClock(setNow, {
    now: () => new Date(),
    // Native browser timers reject the ClockHost object as their receiver.
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: timer => clearTimeout(timer),
    window, document,
  }), [])
  return now
}
