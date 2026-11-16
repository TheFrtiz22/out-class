"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { LoadingState } from "@/components/ui/loading-state"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { AccountUnavailableSignOut } from "@/components/auth/account-unavailable-sign-out"
import { completeAvailabilityRequirement } from "@/actions/availability"
import { flushEditors } from "@/lib/autosave-navigation"
import { scheduleHasAvailability } from "@/lib/availability-requirement"
import type { AvailabilityDocument } from "@/lib/availability"
import { userMessage } from "@/lib/user-message"
import { unwrapAction } from "@/lib/action-result"

// The editor's code loads only for a student who is shown this step.
const AvailabilityEditor = dynamic(() => import("@/components/availability/my-availability").then(module => module.AvailabilityEditor), { loading: () => <LoadingState label="Loading your availability…" layout="calendar" calendarView="week" /> })

/**
 * The required weekly-availability step. AvailabilityGate renders it on the server in place of the
 * workspace (no product page is rendered behind it); finishing refreshes the route so the server
 * decides again.
 */
export function AvailabilityRequirementScreen({ initial }: { initial: AvailabilityDocument }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial), [none, setNone] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false)
  const hasTimes = scheduleHasAvailability(saved.schedule)

  async function finish() {
    setBusy(true); setError("")
    try {
      // Pending grid edits save first; the server then checks the saved schedule, not this page's copy.
      await flushEditors()
      unwrapAction(await completeAvailabilityRequirement({ noRegularTime: none }))
      setDone(true)
      router.refresh()
    } catch (cause) { setError(userMessage(cause, "Could not save your availability. Try again.")); setBusy(false) }
  }

  if (done) return <main id="availability-requirement" className="mx-auto w-full max-w-[var(--oc-content-width)] px-4 py-10 sm:px-6"><LoadingState label="Opening OutClass…" /></main>
  return <main id="availability-requirement" className="mx-auto w-full max-w-[var(--oc-content-width)] space-y-5 px-4 py-10 sm:px-6" aria-labelledby="availability-requirement-title">
    <PageHeader title="When are you usually free?" titleId="availability-requirement-title" description="Mark the times you’re usually free each week. Your clubs use this to find meeting times that work for everyone. You can change it anytime in Settings." />
    <AvailabilityEditor initial={initial} title="Your usual week" onSaved={value => { setSaved(value); if (scheduleHasAvailability(value.schedule)) setNone(false) }} />
    <div className="space-y-3">
      {!hasTimes && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="oc-checkbox" checked={none} disabled={busy} onChange={event => { setNone(event.target.checked); if (event.target.checked) setError("") }} />I don’t have regular free time right now</label>}
      {error && <p role="alert" className="oc-feedback">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void finish()} loading={busy} disabled={busy}>Continue</Button>
        <AccountUnavailableSignOut variant="ghost" />
      </div>
      <p className="text-sm text-muted-foreground">Leaders planning a club meeting see only whether you’re free at that time.</p>
    </div>
  </main>
}
