"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listAdminCampusEvents } from "@/actions/campus-events";
import type { ManagedCampusEvent } from "@/lib/campus-events";
import { EventFlyer } from "@/components/events/event-flyer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "@/components/events/events.css";
export function AdminCorkboard() {
  const [events, setEvents] = useState<ManagedCampusEvent[]>([]), [query, setQuery] = useState(""), [status, setStatus] = useState(""), [selected, setSelected] = useState<ManagedCampusEvent | null>(null), [error, setError] = useState("");
  useEffect(() => { let live = true; listAdminCampusEvents({ query, status }).then(rows => { if (live) setEvents(rows); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [query, status]);
  return <section className="space-y-5"><div className="flex flex-wrap gap-3"><label className="flex-1">Search events or clubs<Input value={query} onChange={e => setQuery(e.target.value)} /></label><label>Publication status<select className="block min-h-11 rounded-md border bg-card px-3" value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option>{["DRAFT", "PENDING", "PUBLISHED", "REJECTED", "CANCELLED", "ARCHIVED"].map(s => <option key={s}>{s}</option>)}</select></label></div>{error && <p role="alert">{error}</p>}<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{events.map(event => <li className="space-y-3 rounded-xl border bg-card p-4" key={event.id}><p className="text-xs font-semibold uppercase text-muted-foreground">{event.status} · {event.clubName}</p><h2 className="font-semibold">{event.title}</h2><p className="text-sm">{new Date(event.date).toLocaleString()}</p><Button variant="outline" onClick={() => setSelected(event)}>Inspect flyer and event</Button></li>)}</ul>{!events.length && <p>No matching moderated events.</p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto"><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Administrative preview · Unapproved flyers remain private.</DialogDescription>{selected && <div className="grid gap-5 sm:grid-cols-2"><EventFlyer event={selected} /><div className="space-y-4"><p>{selected.description}</p><p>{selected.clubName} · {selected.status}</p><p>{selected.location}</p><p>{new Date(selected.date).toLocaleString()}</p><p>RSVPs: {selected.rsvpCount}{selected.capacity ? ` / ${selected.capacity}` : ""}</p>{selected.rejectionReason && <p>Rejection reason: {selected.rejectionReason}</p>}<Link href="/platform/events" className="inline-flex min-h-11 items-center underline">Review in Event Approvals</Link></div></div>}</DialogContent></Dialog>
  </section>;
}
