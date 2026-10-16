"use client";
import { useState, type MouseEvent } from "react";
import Image from "next/image";
import { ArrowUpRight, Clock, MapPin } from "@/components/icons";
import { EVENT_TIMEZONE, eventDateLabel, eventScheduleLabel, type CampusEvent } from "@/lib/campus-events";
import { EventCalendarButton, EventSaveButton, type EventSaveState } from "./event-discovery-actions";

const month = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIMEZONE, month: "short" });
const day = new Intl.DateTimeFormat("en-US", { timeZone: EVENT_TIMEZONE, day: "2-digit" });

export function SmartEventCard({ event, save, onOpen }: { event: CampusEvent; save: EventSaveState; onOpen: (event: CampusEvent, origin: HTMLAnchorElement) => void }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const hasImage = !!event.flyerUrl && failedImage !== event.flyerUrl;
  function open(e: MouseEvent<HTMLAnchorElement>) {
    // Preserve native open-in-new-tab and copy-link behavior.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen(event, e.currentTarget);
  }
  return <article className="oc-smart-event-card">
    <div className="oc-smart-event-media" data-template={event.template}>
      {hasImage ? <Image src={event.flyerUrl!} alt={`${event.title} event poster`} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 38vw, 420px" unoptimized loading="lazy" onError={() => setFailedImage(event.flyerUrl)} /> :
        <div className="oc-smart-event-fallback" aria-hidden="true"><span>{event.clubName}</span><strong>{event.title}</strong><span className="oc-smart-event-fallback-rule" /><span>{event.category || "On Grounds"} · OutClass</span></div>}
      <time className="oc-smart-event-date" dateTime={event.date} aria-label={eventDateLabel(event.date)}><span>{month.format(new Date(event.date))}</span><strong>{day.format(new Date(event.date))}</strong></time>
    </div>
    <div className="oc-smart-event-copy">
      <div className="oc-smart-event-meta"><span className="oc-smart-event-host">{event.clubName}</span>{event.category && <span className="oc-smart-event-category">{event.category}</span>}</div>
      <h2><a href={`/corkboard?event=${event.id}`} onClick={open} className="oc-smart-event-link">{event.title}</a></h2>
      <dl className="oc-smart-event-facts">
        <div><dt><Clock size={17} aria-hidden="true" /><span className="sr-only">Date and time</span></dt><dd>{eventScheduleLabel(event)}</dd></div>
        <div><dt><MapPin size={17} aria-hidden="true" /><span className="sr-only">Location</span></dt><dd>{event.location}</dd></div>
      </dl>
      <p className="oc-smart-event-description">{event.description}</p>
      <div className="oc-smart-event-footer">
        <div className="oc-smart-event-actions"><EventSaveButton event={event} {...save} /><EventCalendarButton event={event} /></div>
        <a className="oc-event-pill oc-event-pill-primary" href={`/corkboard?event=${event.id}`} onClick={open}>View Event<ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
      {event.rsvpEnabled && <p className="oc-smart-event-rsvp">{event.capacity !== null && event.rsvpCount >= event.capacity ? "Event full" : event.rsvpRequired ? "RSVP required · Register in event details" : "RSVP available in event details"}</p>}
    </div>
  </article>;
}
