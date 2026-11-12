"use client";
import { userMessage } from "@/lib/user-message"
import { SearchField } from "@/components/ui/search-field"
import { PillGroup } from "@/components/ui/segmented-control"
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAdminCampusEvents } from "@/actions/campus-events";
import type { ManagedCampusEvent } from "@/lib/campus-events";
import { EventFlyer } from "@/components/events/event-flyer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "@/components/events/events.css";
export function AdminCorkboard() {
  const [events, setEvents] = useState<ManagedCampusEvent[]>([]), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [selected, setSelected] = useState<ManagedCampusEvent | null>(null), [error, setError] = useState("");
  useEffect(() => { let live = true; listAdminCampusEvents({ query, status }).then(rows => { if (live) setEvents(rows); }).catch(e => { if (live) setError(userMessage(e, "Couldn’t load campus events. Try again.")); }); return () => { live = false; }; }, [query, status]);
  return <section className="space-y-5"><div className="oc-toolbar"><SearchField aria-label="Search events or clubs" placeholder="Search events or clubs" containerClassName="flex-1" value={query} onChange={e => setQuery(e.target.value)} onClear={() => setQuery("")} /><PillGroup label="Status" size="compact" value={status} onChange={setStatus} options={[{ value: "", label: "All" }, ...["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "CANCELLED", "ARCHIVED"].map(s => ({ value: s, label: s.charAt(0)+s.slice(1).toLowerCase().replaceAll("_"," ") }))]} /></div>{error && <p role="alert">{error}</p>}<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{events.map(event => <li className="oc-content-panel space-y-3" key={event.id}><p className="text-xs font-semibold uppercase text-muted-foreground">{event.status} · {event.clubName}</p><h2 className="font-semibold">{event.title}</h2><p className="text-sm">{new Date(event.date).toLocaleString()}</p><Button variant="outline" onClick={() => setSelected(event)}>Inspect flyer and event</Button></li>)}</ul>{!events.length && <p>No matching moderated events.</p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto"><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Administrative preview · Unapproved flyers remain private.</DialogDescription>{selected && <div className="grid gap-5 sm:grid-cols-2"><EventFlyer event={selected} /><div className="oc-workspace-stack"><p>{selected.description}</p><p>{selected.clubName} · {selected.status}</p><p>{selected.location}</p><p>{new Date(selected.date).toLocaleString()}</p><p>RSVPs: {selected.rsvpCount}{selected.capacity ? ` / ${selected.capacity}` : ""}</p>{selected.rejectionReason && <p>Rejection reason: {selected.rejectionReason}</p>}<Link href="/platform/events" className="inline-flex min-h-11 items-center underline">Review in Event Approvals</Link></div></div>}</DialogContent></Dialog>
  </section>;
}
