"use client"
import { ShareSheet } from "@/components/share/share-sheet"
import { useContext } from "react"
import { DemoContext } from "@/contexts/demo-mode"
import { eventScheduleLabel, type CampusEvent } from "@/lib/campus-events"
import { eventSharePath } from "@/lib/share-links"

/** Share sheet for one published event. Demo events have no public page, so demo mode shows nothing. */
export function EventShareButton({ event, clubName, className }: { event: Pick<CampusEvent, "id" | "title" | "date" | "endDate" | "allDay">; clubName: string; className?: string }) {
  // Read the context directly: public pages (Events) can render without the demo provider.
  if (useContext(DemoContext)?.isDemoEnabled) return null
  const when = eventScheduleLabel(event)
  return <ShareSheet
    path={eventSharePath(event.id)}
    title={event.title}
    text={`${event.title} (${when}), hosted by ${clubName}`}
    subtitle={`Hosted by ${clubName} · ${when}`}
    className={className}
  />
}
