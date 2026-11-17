import type { BookingSettings, RoomWorkspace } from "./interview-rooms"

export const schedulingSections = ["rooms", "review", "publish", "bookings", "availability", "preview"] as const
export function schedulingEntry(data: RoomWorkspace, roundId: string, requested?: string | null) {
  if (requested === "fill") return "review"
  if (schedulingSections.includes(requested as typeof schedulingSections[number])) return requested!
  if (data.rounds.find(r => r.id === roundId)?.booking?.bookingPublishedAt) return "bookings"
  return data.rooms.some(r => r.roundId === roundId) ? "review" : "rooms"
}

/** Presentation only. Publication eligibility always comes from the server. */
export function bookingState(settings: BookingSettings, rooms: RoomWorkspace["rooms"], now = Date.now()) {
  if (!settings.bookingPublishedAt) return "Draft"
  if (settings.bookingPaused) return "Paused"
  const slots = rooms.filter(r => r.isOpen).flatMap(r => r.slots).filter(s => +new Date(s.startTime) > now)
  return slots.length && slots.every(s => s.booked >= s.capacity) ? "Full" : "Published"
}

/** The cycle holding the most invited applicants, when the current choice holds none of them. */
export function suggestedCycle(invited: { cycleId: string | null; count: number }[], current: string): string | null {
  if (invited.some(g => (g.cycleId ?? "") === current && g.count > 0)) return null
  const best = invited.filter(g => g.count > 0).sort((a, b) => b.count - a.count)[0]
  return best ? best.cycleId ?? "" : null
}
