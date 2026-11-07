"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getMyAvailability } from "@/lib/availability-workspace-read"
import { availabilityHref, responseLabels, type AvailabilityRound } from "@/lib/availability"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { DashboardCard, GlassRow, GlassRowList } from "@/components/product/dashboard/dashboard"

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
  return <DashboardCard id="home-availability" title="Interview availability" label="Availability requests" className="oc-home-availability">
    {error ? <div role="alert" className="oc-dashboard-state"><p className="text-sm">Could not refresh your requests.</p><Button variant="outline" onClick={() => setAttempt(v => v + 1)}>Retry</Button></div>
      : <GlassRowList>{rounds.map(round => <li key={round.id}><GlassRow title={`${round.clubName} · ${round.name}`} detail={responseLabels[round.response]}
        action={<Button variant={round.response === "AWAITING" ? "default" : "outline"} asChild><Link href={availabilityHref(round.clubId, round.id)}>{round.response === "AWAITING" ? "Respond to request" : "View response"}</Link></Button>} /></li>)}</GlassRowList>}
  </DashboardCard>
}
