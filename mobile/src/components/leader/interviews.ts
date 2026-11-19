import { EASTERN, easternDateKey } from "~/lib/eastern";

/** One row of the interviewer's own schedule (lib/interview-entry.ts InterviewRoomEntry). */
export type InterviewEntry = {
  id: string; slotId: string; roomId: string; bookingId: string | null; clubId: string; roundId: string; roundName: string; roomName: string; location: string;
  timezone: string; startTime: string; endTime: string; applicationId: string | null; candidate: string | null; interviewers: string[];
  reviewId?: string; completed: boolean; started: boolean; cancelled: boolean; canOpen: boolean;
};
/** The interviewer's own versioned draft (lib/interview-kits.ts). Fields the app does not edit are sent back unchanged. */
export type InterviewDraft = { additionalNotes?: string; overallReview: string; [field: string]: unknown };
export type InterviewSession = { id: string; revision: number; draft: InterviewDraft; completedAt: string | null; instructions?: string };

const at = (value: string) => +new Date(value);
const byStart = (a: InterviewEntry, b: InterviewEntry) => at(a.startTime) - at(b.startTime) || a.id.localeCompare(b.id);
export const openable = (row: InterviewEntry) => row.canOpen && !!row.applicationId;

// The wording and rules below are the web's (lib/interview-entry.ts); the clock never decides entry.
export function entryStatus(row: InterviewEntry, now: number) {
  if (row.cancelled) return "Cancelled";
  if (row.completed) return "Review submitted";
  if (!row.bookingId) return at(row.endTime) < now ? "Ended unbooked" : "Not booked";
  if (row.started) return "In progress";
  if (at(row.startTime) <= now && at(row.endTime) >= now) return "Scheduled now";
  if (at(row.endTime) < now) return "Scheduled time has ended";
  return "Upcoming";
}
export const entryCandidate = (row: InterviewEntry) => row.bookingId ? row.candidate || row.roomName : null;
export function entryLabel(row: InterviewEntry, now: number) {
  return !row.completed && at(row.endTime) < now ? "Finish notes" : row.completed ? "View review" : row.started ? "Resume interview" : "Enter interview";
}
/** "1:00–1:20 PM", or "11:30 AM–12:10 PM" when the period changes, in Eastern time. */
export function timeRange(row: Pick<InterviewEntry, "startTime" | "endTime">) {
  const parts = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, hour: "numeric", minute: "2-digit" }).formatToParts(new Date(value));
  const pick = (list: Intl.DateTimeFormatPart[], type: string) => list.find(part => part.type === type)?.value ?? "";
  const a = parts(row.startTime), b = parts(row.endTime), clock = (list: Intl.DateTimeFormatPart[]) => `${pick(list, "hour")}:${pick(list, "minute")}`;
  return `${clock(a)}${pick(a, "dayPeriod") === pick(b, "dayPeriod") ? "" : ` ${pick(a, "dayPeriod")}`}–${clock(b)} ${pick(b, "dayPeriod")}`;
}
export const shortDay = (row: InterviewEntry) => new Intl.DateTimeFormat("en-US", { timeZone: EASTERN, weekday: "short", month: "short", day: "numeric" }).format(new Date(row.startTime));

/**
 * The day's view: today's interviews in time order (Eastern), the next interviewee, unfinished past
 * interviews that still need notes, and what is coming on later days. Each interview appears once.
 */
export function interviewDay(rows: InterviewEntry[], now: number) {
  const today = easternDateKey(now);
  const sorted = [...rows].sort(byStart);
  const isToday = (row: InterviewEntry) => easternDateKey(row.startTime) === today;
  const todays = sorted.filter(isToday);
  const booked = todays.filter(row => !!row.bookingId && !row.cancelled);
  const next = booked.find(row => !row.completed && at(row.endTime) >= now) ?? null;
  const needsNotes = sorted.filter(row => openable(row) && !row.completed && !row.cancelled && !!row.bookingId && at(row.endTime) < now);
  const later = sorted.filter(row => !isToday(row) && !!row.bookingId && !row.cancelled && !row.completed && at(row.startTime) > now);
  return { todays, booked, openTimes: todays.filter(row => !row.bookingId && !row.cancelled && at(row.endTime) >= now).length, next, needsNotes, later };
}

/** The interview room on the web (lib/interview-entry.ts interviewEntryHref): questions, scores and submitting the review. */
export function interviewWebHref(row: InterviewEntry) {
  const query = new URLSearchParams();
  if (row.reviewId) {
    if (row.roundId) query.set("roundId", row.roundId);
    if (row.applicationId) query.set("applicantId", row.applicationId);
    query.set("reviewId", row.reviewId); query.set("section", "recruitment"); query.set("tool", "reviews");
    return `/club/${encodeURIComponent(row.clubId)}/workspace?${query}`;
  }
  query.set("interviewTab", "rooms");
  for (const [key, value] of Object.entries({ applicationId: row.applicationId, roundId: row.roundId, slotId: row.slotId, bookingId: row.bookingId, roomId: row.roomId })) if (value) query.set(key, value);
  return `/club/${encodeURIComponent(row.clubId)}/interview?${query}`;
}

/** "12:05" or "1:02:05": the countdown's digits. */
export function clock(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600), minutes = Math.floor((seconds % 3600) / 60), rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}
/** The timer for one interview, from its own start and end: time until it starts, then time remaining, then time's up. */
export function interviewClock(row: Pick<InterviewEntry, "startTime" | "endTime">, now: number) {
  const start = at(row.startTime), end = at(row.endTime);
  if (now < start) return { phase: "before" as const, label: "Starts in", digits: clock((start - now) / 1000) };
  if (now <= end) return { phase: "during" as const, label: "Remaining interview time", digits: clock((end - now) / 1000) };
  return { phase: "after" as const, label: "Time’s up", digits: clock(0) };
}
