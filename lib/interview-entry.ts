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
  const query = parsed?.pathname === base ? new URLSearchParams(parsed.search) : new URLSearchParams("section=recruitment&tool=interviews&interviewTab=rooms");
  query.set("section", "recruitment"); query.set("tool", "interviews"); query.set("interview", "1"); query.delete("reviewId");
  for (const [key, value] of Object.entries({ applicationId: entry.applicationId, roundId: entry.roundId, slotId: entry.slotId, bookingId: entry.bookingId, roomId: entry.roomId })) {
    if (value) query.set(key, value); else query.delete(key);
  }
  if (entry.reviewId) { query.delete("interview"); query.set("interviewTab", "reviews"); query.set("reviewId", entry.reviewId); }
  return `${base}?${query}`;
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
export function interviewEntryStatus(row: InterviewRoomEntry, now = Date.now()) {
  if (row.cancelled) return "Cancelled";
  if (row.completed) return "Completed";
  if (!row.bookingId) return "Awaiting booking";
  if (row.started || +new Date(row.startTime) <= now && +new Date(row.endTime) >= now) return "In progress";
  return "Upcoming";
}
export function sortInterviewEntries(rows: InterviewRoomEntry[], now = Date.now()) {
  const past = (r: InterviewRoomEntry) => r.completed || r.cancelled || +new Date(r.endTime) < now;
  return [...rows].sort((a, b) => Number(past(a)) - Number(past(b)) || +new Date(a.startTime) - +new Date(b.startTime) || a.id.localeCompare(b.id));
}
