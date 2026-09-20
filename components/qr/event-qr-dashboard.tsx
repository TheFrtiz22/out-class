"use client"

import { useState } from "react"
import { useApplicationState } from "@/lib/application-state"
import { QrCodeCard } from "./qr-code-card"

export function EventQrDashboard({ clubId }: { clubId: string }) {
  const { managedEvents } = useApplicationState()
  const events = managedEvents.filter(event => event.clubId === clubId && event.scope === "Public" && !event.recurring)
  const [selected, setSelected] = useState("")
  const active = events.find(event => event.id === selected) ?? events[0]
  return <section className="space-y-4 font-sans">
    <div><h2 className="text-lg font-semibold text-black">Attendance QR codes</h2><p className="mt-1 text-sm text-neutral-500">Create a public, dated event above, then share its check-in code. Each student is counted once per event.</p></div>
    <p className="text-xs text-neutral-500">Demo: attendance and newly created events are saved in this browser only. Live cross-device check-in requires a connected database and authentication.</p>
    {active ? <><label className="block text-sm font-medium" htmlFor="attendance-event">Trackable event</label><select id="attendance-event" className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-sm sm:max-w-lg" value={active.id} onChange={event => setSelected(event.target.value)}>{events.map(event => <option key={event.id} value={event.id}>{event.title} — {event.date}</option>)}</select>
      <QrCodeCard title={active.title} description={`${active.date} · ${active.time} · ${active.location}`} path={`/check-in/?eventId=${encodeURIComponent(active.id)}`} filename={`${clubId}-${active.id}-check-in`} /></> : <p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-500">No trackable events yet. Recurring and members-only meetings do not collect recruitment leads.</p>}
  </section>
}
