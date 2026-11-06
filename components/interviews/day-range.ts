import { slotTime } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"

/**
 * Collapsed day-row summary: "6 slots · 9:00 AM–4:30 PM" (first to last slot start),
 * "1 slot · 9:00 AM", or "No slots". Times use the shared scheduling display.
 */
export function daySlotSummary(slots: { startTime: string | Date }[], timezone = SCHEDULING_TIMEZONE) {
  if (!slots.length) return "No slots"
  const starts = slots.map(s => +new Date(s.startTime)).filter(Number.isFinite).sort((a, b) => a - b)
  const count = `${slots.length} ${slots.length === 1 ? "slot" : "slots"}`
  if (!starts.length) return count
  const first = slotTime(new Date(starts[0]), timezone), last = slotTime(new Date(starts[starts.length - 1]), timezone)
  return `${count} · ${first === last ? first : `${first}–${last}`}`
}
