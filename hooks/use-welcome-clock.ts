"use client"
import { useEffect, useState } from "react"
import { minuteClock } from "@/lib/minute-clock"

export function useWelcomeClock() {
  // Identical server/first-client render; local time is read only after hydration.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => minuteClock.subscribe(setNow), [])
  return now
}
