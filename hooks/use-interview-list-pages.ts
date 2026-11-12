"use client";
import { useEffect, useRef, useState } from "react";
import { INTERVIEW_LIST_PAGE_SIZE, INTERVIEW_LIST_REFRESH_LIMIT, type InterviewListPage } from "@/lib/interview-list-page";

type Read<T> = (cursor: string | null, limit?: number) => Promise<InterviewListPage<T>>;
export type InterviewListMoreState = "idle" | "loading" | "error";
/** A deep-linked item past the first page is looked for in at most this many extra pages. */
export const INTERVIEW_LIST_SEEK_PAGES = 4;

/** Server-paged leadership list with the existing 10-second visible-tab refresh.
 * `deps` are the request scope (club and filters): changing any of them resets paging.
 * A refresh re-reads every row already loaded (up to INTERVIEW_LIST_REFRESH_LIMIT) from the
 * top in one request and replaces the list, so later pages never keep stale names,
 * anonymity labels or rows that left the authorized scope.
 * `seek` is a deep-linked row id: when it is not on the first page, a few more pages load
 * quietly to find it, and `seekMissing` reports when it is still not found. */
export function useInterviewListPages<T>(read: Read<T>, idOf: (row: T) => string, deps: readonly unknown[], unavailable: string, itemDomId: (id: string) => string, seek?: string | null) {
  const [rows, setRows] = useState<T[]>([]), [total, setTotal] = useState(0), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [more, setMore] = useState<InterviewListMoreState>("idle");
  const [announcement, setAnnouncement] = useState(""), [focusId, setFocusId] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const [seekMissing, setSeekMissing] = useState(false);
  const live = useRef({ rows: [] as T[], nextCursor: null as string | null, generation: 0, loadingMore: false, seekPages: 0, seekDone: false, read, idOf });
  live.current.read = read; live.current.idOf = idOf;
  const apply = (next: T[], cursor: string | null, count: number) => {
    live.current.rows = next; live.current.nextCursor = cursor;
    setRows(next); setNextCursor(cursor); setTotal(count);
  };
  useEffect(() => {
    const state = live.current, generation = ++state.generation;
    state.seekPages = 0; state.seekDone = false;
    let pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try {
        const depth = live.current.rows.length;
        const page = await live.current.read(null, Math.min(Math.max(depth, INTERVIEW_LIST_PAGE_SIZE), INTERVIEW_LIST_REFRESH_LIMIT));
        if (generation !== live.current.generation) return;
        // A Load more that landed meanwhile is newer than this read; the next refresh covers it.
        if (live.current.rows.length > Math.max(depth, page.items.length)) return;
        apply(page.items, page.nextCursor, page.total);
        setError("");
      } catch {
        if (generation !== live.current.generation) return;
        apply([], null, 0); setMore("idle"); setError(unavailable);
      } finally { pending = false; if (generation === live.current.generation) setLoading(false); }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    apply([], null, 0); setLoading(true); setError(""); setMore("idle"); setAnnouncement(""); setFocusId(null); setSeekMissing(false); void refresh();
    const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { state.generation++; clearInterval(timer); window.removeEventListener("focus", visible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's request scope
  }, [...deps, retry]);
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(itemDomId(focusId))?.focus();
    setFocusId(null);
  }, [focusId, itemDomId]);
  const loadMore = async (quiet = false) => {
    const from = live.current.nextCursor, generation = live.current.generation;
    if (!from || live.current.loadingMore) return;
    live.current.loadingMore = true; setMore("loading");
    try {
      const page = await live.current.read(from);
      if (generation !== live.current.generation || live.current.nextCursor !== from) { setMore("idle"); return; }
      const key = live.current.idOf, seen = new Set(live.current.rows.map(key)), added = page.items.filter(row => !seen.has(key(row)));
      const next = [...live.current.rows, ...added];
      apply(next, page.nextCursor, page.total); setMore("idle");
      if (quiet) return;
      setAnnouncement(`${added.length} more loaded. Showing ${next.length} of ${page.total}.`);
      setFocusId(added.length ? key(added[0]) : null);
    } catch { if (generation === live.current.generation) setMore("error"); }
    finally { live.current.loadingMore = false; }
  };
  useEffect(() => {
    const state = live.current;
    if (!seek || state.seekDone || loading || error || more !== "idle") return;
    if (rows.some(row => state.idOf(row) === seek)) { state.seekDone = true; setSeekMissing(false); return; }
    if (!nextCursor || state.seekPages >= INTERVIEW_LIST_SEEK_PAGES) { state.seekDone = true; setSeekMissing(true); return; }
    state.seekPages++; void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore reads the live ref
  }, [seek, rows, nextCursor, loading, error, more]);
  /** An opened item lost access: clear the list like a failed refresh. */
  const fail = (message: string) => { apply([], null, 0); setMore("idle"); setError(message); };
  return { rows, total, nextCursor, loading, error, more, announcement, seekMissing, loadMore: () => loadMore(), fail, retry: () => setRetry(value => value + 1) };
}
