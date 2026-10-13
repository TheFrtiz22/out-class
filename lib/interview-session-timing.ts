import type { InterviewScope } from "@/lib/interview-access";

export type InterviewTiming = { durationMs: number; contextKey: string; source: "booking" | "round" };
type Booking = { id: string; applicationId: string; roundId: string | null; slot: { id: string; startTime: string | Date; endTime: string | Date; room: { id: string; clubId: string; roundId: string; duration: number } | null } };

/** Call only with an already-authorized room/round. Missing legacy configuration
 * is not a scheduling default; a booked slot never falls back to another room. */
export function interviewTiming(scope: InterviewScope, configuration: unknown, booking: Booking | null): InterviewTiming | null {
  if (booking) {
    const { slot } = booking, room = slot.room;
    if (!room || booking.applicationId !== scope.applicationId || booking.roundId !== scope.roundId || room.clubId !== scope.clubId || room.roundId !== scope.roundId) return null;
    const start = +new Date(slot.startTime), end = +new Date(slot.endTime), durationMs = end - start;
    if (!Number.isFinite(start) || !Number.isFinite(end) || durationMs < 60_000 || durationMs > 180 * 60_000) return null;
    return { durationMs, source: "booking", contextKey: `booking:${booking.id}:${slot.id}:${room.id}:${start}:${end}` };
  }
  const duration = configuration && typeof configuration === "object" && "duration" in configuration ? configuration.duration : undefined;
  if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 5 || duration > 180) return null;
  return { durationMs: duration * 60_000, source: "round", contextKey: `round:${scope.clubId}:${scope.roundId}:${duration}` };
}
