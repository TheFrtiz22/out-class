"use client"
import { useEffect, useState } from "react"
import { getInterviewBookingPublication, setInterviewBookingPublication } from "@/lib/workspace-api"
import type { BookingSettings, InterviewRoom } from "@/lib/interview-rooms"
import { schedulingDateTime } from "@/lib/scheduling-config"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"

export function InterviewBookingPublication({ clubId, roundId, settings, cycles, rooms, onChanged }: { clubId: string; roundId: string; settings: BookingSettings; cycles: { id: string; name: string }[]; rooms: InterviewRoom[]; onChanged: () => void }) {
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getInterviewBookingPublication>> | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [notice, setNotice] = useState("")
  const [cycleId, setCycle] = useState(settings.bookingCycleId || ""), [cancel, setCancel] = useState(settings.bookingAllowCancellation), [reschedule, setReschedule] = useState(settings.bookingAllowRescheduling)
  useEffect(() => { let current = true; setCoverage(null); getInterviewBookingPublication({ clubId, roundId }).then(value => { if (current) { setCoverage(value); setError("") } }).catch(() => { if (current) setError("Could not check booking readiness. Retry before publishing.") }); return () => { current = false } }, [clubId, roundId, retry])
  useEffect(() => { const refresh = () => setRetry(v => v + 1); for (const name of ["outclass:panels-changed", "outclass:staffing-changed", "outclass:availability-changed"]) window.addEventListener(name, refresh); return () => { for (const name of ["outclass:panels-changed", "outclass:staffing-changed", "outclass:availability-changed"]) window.removeEventListener(name, refresh) } }, [])
  async function save(action: "PUBLISH" | "PAUSE" | "POLICY") {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try { await setInterviewBookingPublication({ clubId, roundId, revision: settings.bookingRevision, action, cycleId: cycleId || null, allowCancellation: cancel, allowRescheduling: reschedule }); setNotice(action === "PUBLISH" ? "Interview booking published. Eligible applicants can choose a time." : action === "PAUSE" ? "New bookings paused. Existing reservations are retained." : "Booking policy saved."); onChanged() }
    catch (e) { setError(e instanceof Error && !("digest" in e) ? e.message : "Could not save booking settings. Your choices are retained; retry or refresh readiness.") }
    finally { setBusy(false) }
  }
  const blocked = coverage?.slots.filter(s => !s.bookable) ?? []
  return <section aria-label="Publish interview booking" className="space-y-3 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="oc-card-heading">Applicant booking</h3><span className="text-sm">{!settings.bookingPublishedAt ? "Not published" : settings.bookingPaused ? "Paused" : "Published"}</span></div>
    <p className="text-sm text-muted-foreground">Publish after approving complete panels. Pausing stops new reservations and keeps confirmed appointments.</p>
    <label className="block text-sm">Recruitment cycle<NativeSelect aria-label="Booking recruitment cycle" disabled={busy} value={cycleId} onChange={e => setCycle(e.target.value)}><option value="">Applications without a cycle</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
    <fieldset disabled={busy} className="flex flex-wrap gap-4 text-sm"><legend className="mb-2">Applicant changes before the interview starts</legend><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={cancel} onChange={e => setCancel(e.target.checked)} />Allow cancellation</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reschedule} onChange={e => setReschedule(e.target.checked)} />Allow rescheduling</label></fieldset>
    {!coverage && !error && <p role="status">Checking approved staffing…</p>}
    {blocked.length > 0 && <details><summary className="cursor-pointer text-sm">{blocked.length} sessions cannot be published</summary><ul className="mt-2 space-y-2 text-sm">{blocked.map(row => { const room = rooms.find(r => r.slots.some(s => s.id === row.slotId)), slot = room?.slots.find(s => s.id === row.slotId); return <li key={row.slotId}>{room?.name} · {slot ? schedulingDateTime(slot.startTime) : "Session"}: {row.reasons.join(" ")}</li> })}</ul></details>}
    {coverage && !coverage.slots.length && <p>No future sessions. Create interview times first.</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !coverage || !coverage.slots.length || !!blocked.length} onClick={() => void save("PUBLISH")}>{busy ? "Saving…" : "Publish interview booking"}</Button>{settings.bookingPublishedAt && !settings.bookingPaused && <Button variant="outline" disabled={busy} onClick={() => void save("PAUSE")}>Pause new bookings</Button>}<Button variant="outline" disabled={busy} onClick={() => void save("POLICY")}>Save booking policy</Button><Button variant="ghost" disabled={busy} onClick={() => setRetry(v => v + 1)}>Refresh readiness</Button></div>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
