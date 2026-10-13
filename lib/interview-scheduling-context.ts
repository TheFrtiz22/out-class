import { monday } from "@/lib/availability"
import { dayKey, type RoomWorkspace } from "@/lib/interview-rooms"

/** A different round starts at its next open session, rather than inheriting unrelated dates. */
export function interviewRoundWeek(data: RoomWorkspace, roundId: string, now = Date.now()) {
  const next = data.rooms.filter(room => room.roundId === roundId && room.isOpen)
    .flatMap(room => room.slots.filter(slot => +new Date(slot.startTime) > now).map(slot => ({ slot, timezone: room.timezone })))
    .sort((a, b) => +new Date(a.slot.startTime) - +new Date(b.slot.startTime))[0]
  return next ? monday(dayKey(next.slot.startTime, next.timezone)) : monday(dayKey(new Date(now), "America/New_York"))
}
