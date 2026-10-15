"use client"
import { useEffect, useRef, useState } from "react"
import { getInterviewBookingPublication, setInterviewBookingPublication } from "@/lib/workspace-api"
import type { BookingSettings, InterviewRoom } from "@/lib/interview-rooms"
import { bookingState } from "@/lib/interview-scheduling-ui"
import { schedulingDateTime } from "@/lib/scheduling-config"
import { Button } from "@/components/ui/button"
import { NativeSelect } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function InterviewBookingPublication({ clubId, roundId, settings, cycles, rooms, onChanged, onPublished, onFixSlot, onTimes }: { clubId: string; roundId: string; settings: BookingSettings; cycles: { id: string; name: string }[]; rooms: InterviewRoom[]; onChanged: () => void; onPublished?: () => void; onFixSlot?: (id: string) => void; onTimes?: () => void }) {
  const [coverage, setCoverage] = useState<Awaited<ReturnType<typeof getInterviewBookingPublication>> | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0), [notice, setNotice] = useState("")
  const [cycleId, setCycle] = useState(settings.bookingCycleId || ""), [cancel, setCancel] = useState(settings.bookingAllowCancellation), [reschedule, setReschedule] = useState(settings.bookingAllowRescheduling), [pause, setPause] = useState(false)
  const saving = useRef(false)
  useEffect(() => { let current = true; setCoverage(null); getInterviewBookingPublication({ clubId, roundId }).then(value => { if (current) { setCoverage(value); setError("") } }).catch(() => { if (current) setError("Could not check booking readiness. Retry before publishing.") }); return () => { current = false } }, [clubId, roundId, retry])
  useEffect(() => { const refresh = () => setRetry(v => v + 1); for (const name of ["outclass:panels-changed", "outclass:staffing-changed", "outclass:availability-changed"]) window.addEventListener(name, refresh); return () => { for (const name of ["outclass:panels-changed", "outclass:staffing-changed", "outclass:availability-changed"]) window.removeEventListener(name, refresh) } }, [])
  async function save(action: "PUBLISH" | "PAUSE" | "POLICY") {
    if (saving.current) return
    saving.current = true; setBusy(true); setError(""); setNotice("")
    try {
      await setInterviewBookingPublication({ clubId, roundId, revision: settings.bookingRevision, action, cycleId: cycleId || null, allowCancellation: cancel, allowRescheduling: reschedule })
      setNotice(action === "PUBLISH" ? "Booking published." : action === "PAUSE" ? "New bookings paused. Confirmed reservations are retained." : "Booking policy saved.")
      setPause(false); onChanged(); if (action === "PUBLISH") onPublished?.()
    } catch (e) { setError(e instanceof Error && !("digest" in e) ? e.message : "Could not save booking settings. Your choices are retained; retry.") }
    finally { saving.current = false; setBusy(false) }
  }
  const blocked = coverage?.slots.filter(s => !s.bookable) ?? []
  return <section aria-label="Publish interview booking" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-medium">Publish booking</h3><span className="text-sm text-muted-foreground">{bookingState(settings, rooms)}</span></header>
    {!coverage && !error && <p role="status" className="text-sm">Checking interviewer coverage…</p>}
    {coverage && <p role="status" className="text-sm">{coverage.slots.length - blocked.length} {coverage.slots.length - blocked.length === 1 ? "slot" : "slots"} ready{blocked.length ? ` · ${blocked.length} need attention` : ""}</p>}
    {!!blocked.length && <details><summary className="cursor-pointer text-sm font-medium">Resolve booking issues ({blocked.length})</summary><ul className="mt-2 divide-y text-sm">{blocked.map(row => { const room = rooms.find(r => r.slots.some(s => s.id === row.slotId)), slot = room?.slots.find(s => s.id === row.slotId); return <li key={row.slotId} className="py-2"><button type="button" className="min-h-9 text-left font-medium underline underline-offset-4" onClick={() => onFixSlot?.(row.slotId)}>{room?.name || "Interview"} · {slot ? schedulingDateTime(slot.startTime) : "Time"}</button><p className="text-muted-foreground">{row.reasons.join(" ")}</p></li> })}</ul></details>}
    {coverage && !coverage.slots.length && <div className="space-y-2 text-sm"><p>No upcoming interview times.</p>{onTimes && <Button variant="outline" onClick={onTimes}>Set interview times</Button>}</div>}
    <label className="ir-field max-w-sm">Recruitment cycle<NativeSelect aria-label="Booking recruitment cycle" disabled={busy} value={cycleId} onChange={e => setCycle(e.target.value)}><option value="">Applications without a cycle</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
    <Button disabled={busy || !coverage || !coverage.slots.length || !!blocked.length} onClick={() => void save("PUBLISH")}>{busy ? "Saving…" : settings.bookingPublishedAt && settings.bookingPaused ? "Resume booking" : "Publish booking"}</Button>
    <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">More options</summary><div className="mt-3 space-y-3">
      <fieldset disabled={busy} className="flex flex-wrap gap-4 text-sm"><legend className="mb-2 text-muted-foreground">Applicant changes before the interview starts</legend><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={cancel} onChange={e => setCancel(e.target.checked)}/>Allow cancellation</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reschedule} onChange={e => setReschedule(e.target.checked)}/>Allow rescheduling</label></fieldset>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void save("POLICY")}>Save booking policy</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setRetry(v => v + 1)}>Recheck readiness</Button>{settings.bookingPublishedAt && !settings.bookingPaused && <Button size="sm" variant="outline" disabled={busy} onClick={() => setPause(true)}>Pause booking</Button>}</div>
    </div></details>
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" disabled={busy} onClick={() => setRetry(v => v + 1)}>Retry readiness</Button></div>}{notice && <p role="status" className="text-sm">{notice}</p>}
    <Dialog open={pause} onOpenChange={open => { if (!busy) setPause(open) }}><DialogContent><DialogHeader><DialogTitle>Pause new bookings?</DialogTitle><DialogDescription>Applicants cannot reserve a new time while paused. Confirmed reservations stay in place.</DialogDescription></DialogHeader>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setPause(false)}>Keep booking open</Button><Button disabled={busy} onClick={() => void save("PAUSE")}>{busy ? "Pausing…" : "Pause booking"}</Button></div></DialogContent></Dialog>
  </section>
}