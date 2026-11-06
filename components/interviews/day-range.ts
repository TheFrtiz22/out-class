import { slotTime } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

/**
 * Collapsed day-row summary: "6 slots · 9:00 AM–5:00 PM" (first start to last end, so it reads as
 * the span of interviewing), "1 slot · 9:00–9:30 AM", or "No slots". Without end times it falls
 * back to the last start. Times use the shared scheduling display.
 */
export function daySlotSummary(slots: { startTime: string | Date; endTime?: string | Date | null }[], timezone = SCHEDULING_TIMEZONE) {
  if (!slots.length) return "No slots"
  const count = `${slots.length} ${slots.length === 1 ? "slot" : "slots"}`
  const starts = slots.map(s => +new Date(s.startTime)).filter(Number.isFinite)
  if (!starts.length) return count
  const ends = slots.map(s => s.endTime ? +new Date(s.endTime) : NaN).filter(Number.isFinite)
  const first = slotTime(new Date(Math.min(...starts)), timezone)
  const last = slotTime(new Date(ends.length ? Math.max(...ends) : Math.max(...starts)), timezone)
  return `${count} · ${first === last ? first : `${first}–${last}`}`
}
