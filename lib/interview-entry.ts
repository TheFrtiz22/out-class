import { applicantInterviewHref } from "@/lib/applicant-interview-navigation";
export type InterviewRoomEntry = {
  id: string; slotId: string; roomId: string; bookingId: string | null;
  clubId: string; roundId: string; roundName: string; roomName: string; location: string;
  timezone: string; startTime: string; endTime: string;
  applicationId: string | null; candidate: string | null; interviewers: string[];
  reviewId?: string; completed: boolean; started: boolean; cancelled: boolean; canOpen: boolean;
};

/** Keep the originating tab/date filters, but never accept an external return URL. */
export function interviewEntryHref(entry: Pick<InterviewRoomEntry, "clubId" | "applicationId" | "roundId" | "slotId" | "bookingId" | "roomId"> & { reviewId?: string }, origin?: string) {
  const base = `/club/${encodeURIComponent(entry.clubId)}/workspace`;
  const parsed = origin ? new URL(origin, "https://out-class.net") : null;
  const query = parsed?.pathname === base || parsed?.pathname === clubInterviewHref(entry.clubId) ? new URLSearchParams(parsed.search) : new URLSearchParams("section=recruitment&tool=interviews&interviewTab=rooms");
  query.set("section", "recruitment"); query.set("tool", "interviews"); query.delete("interview"); query.delete("reviewId");
  for (const [key, value] of Object.entries({ applicationId: entry.applicationId, roundId: entry.roundId, slotId: entry.slotId, bookingId: entry.bookingId, roomId: entry.roomId })) {
    if (value) query.set(key, value); else query.delete(key);
  }
  if (entry.reviewId) { query.set("reviewId", entry.reviewId); return applicantInterviewHref(entry.clubId, "reviews", query.toString(), entry.applicationId || undefined); }
  return clubInterviewHref(entry.clubId, query.toString());
}
/**
 * The interview room's own route. It keeps the list's filters (interviewTab, dates, round)
 * so Exit returns to the same list; section/tool/interview belong to the workspace URL.
 */
export function clubInterviewHref(clubId: string, search = "") {
  const query = new URLSearchParams(search);
  for (const key of ["section", "tool", "interview"]) query.delete(key);
  const rest = query.toString();
  return `/club/${encodeURIComponent(clubId)}/interview${rest ? `?${rest}` : ""}`;
}
/** Old room URLs (`/club/x/workspace?section=recruitment&tool=interviews&interview=1…`) move to the route. */
export function legacyInterviewRoomHref(clubId: string, search: string) {
  const query = new URLSearchParams(search);
  return query.get("section") === "recruitment" && query.get("tool") === "interviews" && query.get("interview") === "1" ? clubInterviewHref(clubId, search) : null;
}
export function interviewListHref(clubId: string, search: string) {
  const query = new URLSearchParams(search);
  for (const key of ["interview", "applicationId", "bookingId", "roomId"]) query.delete(key);
  // Scheduling uses slotId/sessionId and roundId for its selected detail.
  if (query.get("interviewTab") !== "schedule") query.delete("slotId");
  query.set("section", "recruitment"); query.set("tool", "interviews");
  if (!query.has("interviewTab")) query.set("interviewTab", "rooms");
  return `/club/${encodeURIComponent(clubId)}/workspace?${query}`;
}
/** Scheduled times are context only; entry is never denied by the clock. Server
 * access (membership, assignment, applicant, cycle, round, booking) decides. */
export function interviewEntryStatus(row: InterviewRoomEntry, now = Date.now()) {
  if (row.cancelled) return "Cancelled";
  if (row.completed) return "Review submitted";
  if (!row.bookingId) return "Needs a time";
  if (row.started) return "In progress";
  if (+new Date(row.startTime) <= now && +new Date(row.endTime) >= now) return "Scheduled now";
  if (+new Date(row.endTime) < now) return "Scheduled time has ended";
  return "Upcoming";
}
/** The one entry action per interviewer: their own review state decides it, never the clock. */
export function interviewEntryAction(row: Pick<InterviewRoomEntry, "completed" | "started">) {
  return row.completed ? "View review" : row.started ? "Resume interview" : "Enter interview";
}
function relative(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
/** Concise timing context, e.g. "Scheduled for 3:00–3:20 PM EST · Starts in 10 minutes". */
export function interviewTimingContext(row: Pick<InterviewRoomEntry, "startTime" | "endTime" | "timezone" | "completed" | "cancelled">, now = Date.now()) {
  const start = new Date(row.startTime), end = new Date(row.endTime);
  const parts = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).formatToParts(d);
  const pick = (p: Intl.DateTimeFormatPart[], type: string) => p.find(x => x.type === type)?.value ?? "";
  const a = parts(start), b = parts(end), clock = (p: Intl.DateTimeFormatPart[]) => `${pick(p, "hour")}:${pick(p, "minute")}`;
  // "3:00–3:20 PM EST", or "11:30 AM–12:10 PM EST" when the period changes.
  const scheduled = `Scheduled for ${clock(a)}${pick(a, "dayPeriod") === pick(b, "dayPeriod") ? "" : ` ${pick(a, "dayPeriod")}`}–${clock(b)} ${pick(b, "dayPeriod")} ${pick(b, "timeZoneName")}`;
  if (row.cancelled || row.completed) return scheduled;
  if (+start > now) return `${scheduled} · Starts in ${relative(+start - now)}`;
  if (+end >= now) return `${scheduled} · Scheduled now`;
  return `${scheduled} · Scheduled time has ended`;
}
/** Unfinished interviews whose scheduled time has passed, so they stay discoverable without an old notification. */
export function unfinishedInterviewEntries(rows: InterviewRoomEntry[], now = Date.now()) {
  return rows.filter(r => r.canOpen && !!r.applicationId && !r.completed && !r.cancelled && !!r.bookingId && +new Date(r.endTime) < now)
    .sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime) || a.id.localeCompare(b.id));
}
export function sortInterviewEntries(rows: InterviewRoomEntry[], now = Date.now()) {
  const past = (r: InterviewRoomEntry) => r.completed || r.cancelled || !r.started && +new Date(r.endTime) < now;
  return [...rows].sort((a, b) => Number(past(a)) - Number(past(b)) || +new Date(a.startTime) - +new Date(b.startTime) || a.id.localeCompare(b.id));
}

/** Metadata from the authorized room projection only; never grants kit/review access. */
export function interviewRoomRoundOptions(rounds: { id: string; name: string }[], rows: InterviewRoomEntry[]) {
  const options = new Map(rounds.map(round => [round.id, { id: round.id, name: round.name }]));
  for (const row of rows) if (!options.has(row.roundId)) options.set(row.roundId, { id: row.roundId, name: row.roundName });
  return [...options.values()];
}
