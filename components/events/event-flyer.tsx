import Image from "next/image";
import { CampusIllustration } from "@/components/product/campus-illustration";
import {
  eventDateLabel,
  eventTimeLabel,
  type CampusEvent,
} from "@/lib/campus-events";
export function EventFlyer({ event }: { event: CampusEvent }) {
  return (
    <div className="oc-event-paper" data-template={event.template}>
      {event.flyerUrl ? (
        <Image
          className="oc-uploaded-flyer"
          src={event.flyerUrl}
          alt={`${event.title} flyer`}
          width={600}
          height={800}
          unoptimized
        />
      ) : (
        <>
          <p className="oc-paper-club">{event.clubName}</p>
          <h3>{event.title}</h3>
          <span className="oc-paper-rule" />
          <p className="oc-paper-date">{eventDateLabel(event.date)}</p>
          <p>
            {eventTimeLabel(event.date)} – {eventTimeLabel(event.endDate)}
          </p>
          <p className="oc-paper-location">{event.location}</p>
          <p className="oc-paper-description">{event.description}</p>
          <div className="oc-paper-art">
            <CampusIllustration
              variant={
                event.category === "Arts"
                  ? "homer"
                  : event.category === "Service"
                    ? "lawn-archways"
                    : "rotunda"
              }
              treatment="quiet"
            />
          </div>
          <p className="oc-paper-category">
            {event.category} ·{" "}
            {event.rsvpRequired ? "RSVP required" : "Open to all"}
          </p>
        </>
      )}
    </div>
  );
}
