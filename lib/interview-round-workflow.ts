export const INTERVIEW_ROUNDS_CHANGED = "outclass:interview-rounds-changed";
export type InterviewSetupStatus = { roundId: string; label: "Setup needed" | "Ready to publish" | "Schedule published"; next: string; configured: boolean; tab: "kits" | "schedule" };
/** Read-only guidance; publication still runs the canonical current server checks. */
export function interviewSetupStatus(input: { roundId: string; questions: number; rooms: number; published: boolean; paused: boolean; anonymous: boolean; coverage: { bookable: boolean; unoffered?: boolean; reasons: string[] }[] }): InterviewSetupStatus {
  // Times with no interviewers and no bookings are not offered, so they never block readiness.
  const coverage = input.coverage.filter(slot => !slot.unoffered)
  const result = { roundId: input.roundId, configured: input.questions > 0 || input.rooms > 0, tab: "schedule" as "kits" | "schedule" };
  if (input.published && !input.paused) return { ...result, label: "Schedule published", next: "" };
  if (input.anonymous) return { ...result, label: "Setup needed", next: "Booking needs a named (non-anonymous) interview round." };
  if (coverage.length && coverage.every(slot => slot.bookable)) return { ...result, label: "Ready to publish", next: input.paused ? "Booking is paused. Resume it when ready." : "Finish scheduling, then publish the schedule." };
  if (!input.questions && !input.rooms) return { ...result, label: "Setup needed", next: "Add interview questions.", tab: "kits" };
  if (!input.coverage.length) return { ...result, label: "Setup needed", next: "Set future interview times." };
  if (!coverage.length) return { ...result, label: "Setup needed", next: "Confirm who can interview." };
  const blocked = coverage.find(slot => !slot.bookable);
  if (blocked) return { ...result, label: "Setup needed", next: blocked.reasons.find(reason => !/^0 unfilled/.test(reason)) || "Confirm who can interview." };
  return { ...result, label: "Ready to publish", next: input.paused ? "Booking is paused. Resume it when ready." : "Finish scheduling, then publish the schedule." };
}
