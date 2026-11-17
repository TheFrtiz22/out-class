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

/** Booking progress for one round after publishing: who has booked, out of whom, and what is still open. */
export function bookingProgress(invited: number | undefined, rooms: RoomWorkspace["rooms"], bookings: RoomWorkspace["bookings"], now = Date.now()) {
  const booked = new Set(bookings.map(b => b.applicationId)).size
  const open = rooms.filter(r => r.isOpen).flatMap(r => r.slots).filter(s => +new Date(s.startTime) > now).reduce((n, s) => n + Math.max(0, s.capacity - s.booked), 0)
  const people = (n: number) => `${n} ${n === 1 ? "applicant" : "applicants"}`
  const times = `${open} open ${open === 1 ? "time" : "times"} left.`
  if (invited == null) return `${people(booked)} booked. ${times}`
  if (!invited) return `No applicants are invited to this round yet. ${times}`
  if (booked >= invited) return `Every invited applicant has booked. ${times}`
  return `${booked} of ${invited} invited ${invited === 1 ? "applicant has" : "applicants have"} booked. ${times}`
}
