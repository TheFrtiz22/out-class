"use client";
import Link from "next/link";
import { Bookmark, CalendarPlus } from "@/components/icons";
import { calendarEventFile } from "@/lib/ical";
import type { CampusEvent } from "@/lib/campus-events";

export type EventSaveState = { identity: string; saved: boolean; ready: boolean; pending: boolean; onSave: () => void };

export function EventSaveButton({ event, identity, saved, ready, pending, onSave }: EventSaveState & { event: CampusEvent }) {
  if (!identity) return <Link className="oc-event-pill" href={`/login?next=${encodeURIComponent(`/corkboard?event=${event.id}`)}`} aria-label={`Sign in to save ${event.title}`}><Bookmark size={17} aria-hidden="true" />Save</Link>;
  return <button type="button" className="oc-event-pill" aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${event.title}`} disabled={!ready || pending} onClick={onSave}>
    <Bookmark size={17} weight={saved ? "fill" : "regular"} aria-hidden="true" />{pending ? "Saving…" : saved ? "Saved" : "Save"}
  </button>;
}

export function EventCalendarButton({ event }: { event: CampusEvent }) {
  function download() {
    const contents = calendarEventFile({ id: event.id, title: event.title,
      description: `${event.description}\nHosted by ${event.clubName}`, location: event.location,
      allDay: event.allDay, start: new Date(event.date), end: new Date(event.endDate), url: `${window.location.origin}/corkboard?event=${event.id}` });
    const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `outclass-${event.id}.ics`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Keep the object alive until the browser has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <button type="button" className="oc-event-pill" onClick={download} aria-label={`Add ${event.title} to calendar`}><CalendarPlus size={17} aria-hidden="true" />Add to Calendar</button>;
}
