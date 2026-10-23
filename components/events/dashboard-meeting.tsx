"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getPublicCampusEvent } from "@/lib/workspace-api"
import { MeetingDetail } from "@/components/meeting-workspace"
import { RsvpControls } from "@/components/events/public-event-board"
import { Button } from "@/components/ui/button"
export function DashboardMeeting({ id, canRsvp, onUpdated }: { id: string; canRsvp: boolean; onUpdated: () => void }) {
  const { user } = useAuth(), [event, setEvent] = useState<Awaited<ReturnType<typeof getPublicCampusEvent>>>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0)
  useEffect(() => { if (!canRsvp) return; let current = true; getPublicCampusEvent(id).then(value => { if (current) { setEvent(value); setError(value ? "" : "RSVP is no longer available for this event.") } }).catch(() => { if (current) setError("Event registration could not load.") }); return () => { current = false } }, [id, canRsvp, retry])
  return <div className="space-y-6 py-5">{canRsvp && <section aria-label="Event registration" className="space-y-3 border-b pb-5">{event ? <RsvpControls key={`${id}:${user?.id}`} event={event} identity={user?.id ?? ""} onChanged={count => { setEvent({ ...event, rsvpCount: count }); onUpdated() }} /> : !error && <p role="status">Checking event registration…</p>}{error && <p role="alert">{error} <Button variant="outline" onClick={() => setRetry(n => n + 1)}>Retry registration</Button></p>}</section>}<MeetingDetail id={id} onUpdated={onUpdated} /></div>
}
