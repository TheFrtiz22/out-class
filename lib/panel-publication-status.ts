import type { BookingSettings } from "@/lib/interview-rooms"
import { mergePanelPublication, panelScheduleChanges, type PanelDocument } from "@/lib/panel-proposals"

// Publication impact, not draft existence or bookkeeping revisions/provenance.
export function panelPublicationStatus(booking: Pick<BookingSettings, "bookingPublishedAt" | "bookingPaused"> | undefined, published?: PanelDocument, draft?: PanelDocument) {
  const next = published && draft ? mergePanelPublication(published, draft) : undefined
  const sessions = (doc: PanelDocument) => doc.sessions.map(s => [s.id, s.roomId, s.roomName, s.timezone, s.startTime, s.endTime, s.buffer, s.required, s.active]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const changed = !!(published && next && (panelScheduleChanges(published, next).length || JSON.stringify(sessions(published)) !== JSON.stringify(sessions(next)) || published.options.maxConsecutiveMinutes !== next.options.maxConsecutiveMinutes || published.options.breakMinutes !== next.options.breakMinutes))
  const status = !booking?.bookingPublishedAt ? "Booking is unpublished" : booking.bookingPaused ? "Booking is paused" : "Booking is live"
  return {
    changed,
    label: `${status}${changed ? " · Unpublished changes" : !published && draft ? " · Awaiting interviewer approval" : ""}`,
    detail: changed ? "Your changes take effect after approval." : !published && draft ? "Confirm interviewers before publishing booking." : "",
  }
}
