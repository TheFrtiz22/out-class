import { z } from "zod";
import type { ApplicantInterviewFilters } from "@/lib/applicant-interview-navigation";

/** Keyset paging for leadership interview lists (submitted reviews, résumé moderation).
 * A cursor is only a position: the club, round, cycle and applicant always come from the
 * authorized request, and every page re-runs the same permission check and filters.
 * The token names its list and filter scope so a cursor from another list or filter set is
 * refused; it carries only the anchor row's id, never its timestamp. The server reads the
 * anchor's sort key again under the full authorized filter, so anonymous reviews never expose
 * their withheld submission time and a cursor outside the caller's scope resolves to nothing. */
export const INTERVIEW_LIST_PAGE_SIZE = 50;
export type InterviewListKind = "reviews" | "resumes";
export type InterviewListPage<T> = { items: T[]; nextCursor: string | null; total: number };
export const INVALID_INTERVIEW_LIST_CURSOR = "Invalid list position. Reload the list.";
export const STALE_INTERVIEW_LIST_CURSOR = "This list changed. Reload the list.";

export const interviewListFiltersSchema = z.object({ applicationId: z.string().uuid().optional(), roundId: z.string().uuid().optional(), cycleId: z.string().uuid().optional() });
const tokenSchema = z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+$/);
const payloadSchema = z.object({ v: z.literal(1), k: z.enum(["reviews", "resumes"]), s: z.string().max(200), i: z.string().min(1).max(64).regex(/^[A-Za-z0-9-]+$/) }).strict();

/** Equality key for the filters a cursor was issued under. Never used to choose scope. */
export function interviewListScope(clubId: string, filters: ApplicantInterviewFilters) {
  return [clubId, filters.applicationId ?? "", filters.roundId ?? "", filters.cycleId ?? ""].join(":");
}
const toBase64Url = (text: string) => btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (token: string) => atob(token.replace(/-/g, "+").replace(/_/g, "/"));

export function encodeInterviewListCursor(kind: InterviewListKind, scope: string, id: string) {
  return toBase64Url(JSON.stringify({ v: 1, k: kind, s: scope, i: id }));
}
/** null/undefined means the first page. A malformed token, or one issued for another list or
 * filter scope, is refused rather than reinterpreted. */
export function decodeInterviewListCursor(cursor: unknown, kind: InterviewListKind, scope: string): { id: string } | null {
  if (cursor === null || cursor === undefined) return null;
  const token = tokenSchema.safeParse(cursor);
  if (!token.success) throw new Error(INVALID_INTERVIEW_LIST_CURSOR);
  let json: unknown;
  try { json = JSON.parse(fromBase64Url(token.data)); } catch { throw new Error(INVALID_INTERVIEW_LIST_CURSOR); }
  const payload = payloadSchema.safeParse(json);
  if (!payload.success) throw new Error(INVALID_INTERVIEW_LIST_CURSOR);
  if (payload.data.k !== kind || payload.data.s !== scope) throw new Error(STALE_INTERVIEW_LIST_CURSOR);
  return { id: payload.data.i };
}

/** Builds a page from up to PAGE_SIZE + 1 rows already ordered newest first, ties by id desc. */
export function interviewListPage<T>(rows: T[], idOf: (row: T) => string, kind: InterviewListKind, scope: string, total: number): InterviewListPage<T> {
  const items = rows.slice(0, INTERVIEW_LIST_PAGE_SIZE);
  return { items, nextCursor: rows.length > INTERVIEW_LIST_PAGE_SIZE && items.length ? encodeInterviewListCursor(kind, scope, idOf(items[items.length - 1])) : null, total };
}

/** In-memory equivalent for Demo Mode: `sorted` is the full filtered list in display order. */
export function pageSortedInterviewList<T>(sorted: T[], idOf: (row: T) => string, position: { id: string } | null, kind: InterviewListKind, scope: string): InterviewListPage<T> {
  let start = 0;
  if (position) {
    const anchor = sorted.findIndex(row => idOf(row) === position.id);
    if (anchor < 0) throw new Error(STALE_INTERVIEW_LIST_CURSOR);
    start = anchor + 1;
  }
  return interviewListPage(sorted.slice(start, start + INTERVIEW_LIST_PAGE_SIZE + 1), idOf, kind, scope, sorted.length);
}
