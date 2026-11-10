export const INTERVIEW_ROUNDS_CHANGED = "outclass:interview-rounds-changed";
export type InterviewSetupStatus = { roundId: string; label: "Setup needed" | "Ready to publish" | "Schedule published"; next: string; configured: boolean; tab: "kits" | "schedule" };
/** Read-only guidance; publication still runs the canonical current server checks. */
export function interviewSetupStatus(input: { roundId: string; questions: number; rooms: number; published: boolean; paused: boolean; anonymous: boolean; coverage: { bookable: boolean; reasons: string[] }[] }): InterviewSetupStatus {
  const result = { roundId: input.roundId, configured: input.questions > 0 || input.rooms > 0, tab: "schedule" as "kits" | "schedule" };
  if (input.published && !input.paused) return { ...result, label: "Schedule published", next: "" };
  if (input.anonymous) return { ...result, label: "Setup needed", next: "Booking needs a named (non-anonymous) interview round." };
  if (input.coverage.length && input.coverage.every(slot => slot.bookable)) return { ...result, label: "Ready to publish", next: input.paused ? "Booking is paused. Resume it when ready." : "Finish scheduling, then publish the schedule." };
  if (!input.questions && !input.rooms) return { ...result, label: "Setup needed", next: "Add interview questions.", tab: "kits" };
  if (!input.coverage.length) return { ...result, label: "Setup needed", next: "Set future interview times." };
  const blocked = input.coverage.find(slot => !slot.bookable);
  if (blocked) return { ...result, label: "Setup needed", next: blocked.reasons.find(reason => !/^0 unfilled/.test(reason)) || "Confirm who can interview." };
  return { ...result, label: "Ready to publish", next: input.paused ? "Booking is paused. Resume it when ready." : "Finish scheduling, then publish the schedule." };
}
