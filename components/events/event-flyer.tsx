"use client";
import { useState } from "react";
import Image from "next/image";
import {
  eventScheduleLabel,
  type CampusEvent,
} from "@/lib/campus-events";
export function EventFlyer({ event }: { event: CampusEvent }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="oc-event-paper" data-template={event.template}>
      {event.flyerUrl && failed !== event.flyerUrl ? (
        <Image
          className="oc-uploaded-flyer"
          src={event.flyerUrl}
          alt={`${event.title} flyer`}
          width={600}
          height={800}
          onError={() => setFailed(event.flyerUrl)}
          unoptimized
        />
      ) : (
        <>
          <p className="oc-paper-club">{event.clubName}</p>
          <h3>{event.title}</h3>
          <span className="oc-paper-rule" />
          <p>
            {eventScheduleLabel(event)}
          </p>
          <p className="oc-paper-location">{event.location}</p>
          <p className="oc-paper-description">{event.description}</p>
          <p className="oc-paper-category">
            {event.category} ·{" "}
            {event.rsvpRequired ? "RSVP required" : "Open to all"}
          </p>
        </>
      )}
    </div>
  );
}
