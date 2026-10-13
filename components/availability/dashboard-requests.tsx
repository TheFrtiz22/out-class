"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getMyAvailability } from "@/lib/availability-workspace-read"
import { availabilityHref, responseLabels, type AvailabilityRound } from "@/lib/availability"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"

/** Compact, account-bound dashboard actions; no availability documents rendered here. */
export function AvailabilityDashboardRequests() {
  const { user } = useAuth(), demo = useDemoMode()
  const [rounds, setRounds] = useState<AvailabilityRound[]>([]), [error, setError] = useState(false), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!user || demo.isDemoEnabled) return
    let active = true
    const load = () => getMyAvailability().then(value => { if (active) { setRounds(value.rounds.filter(r => r.requested)); setError(false) } }).catch(() => { if (active) setError(true) })
    void load(); window.addEventListener("focus", load); window.addEventListener("outclass:availability-changed", load)
    return () => { active = false; window.removeEventListener("focus", load); window.removeEventListener("outclass:availability-changed", load) }
  }, [user?.id, demo.isDemoEnabled, attempt, user])
  if (!rounds.length && !error) return null
  return <section aria-label="Availability requests" className="mb-4 rounded-xl border px-4 py-3"><h2 className="text-sm font-semibold">Interview availability</h2>{error ? <p role="alert" className="text-sm">Could not refresh your requests. <button className="min-h-11 underline" onClick={() => setAttempt(v => v + 1)}>Retry</button></p> : <ul className="divide-y">{rounds.map(round => <li key={round.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{round.clubName} · {round.name}<span className="ml-2 text-xs text-muted-foreground">{responseLabels[round.response]}</span></span><Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" href={availabilityHref(round.clubId, round.id)}>{round.response === "AWAITING" ? "Respond to request" : "View response"}</Link></li>)}</ul>}</section>
}
