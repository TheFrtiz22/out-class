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
