"use client";
import { useEffect, useRef, useState } from "react";
import type { InterviewListPage } from "@/lib/interview-list-page";

type Read<T> = (cursor: string | null) => Promise<InterviewListPage<T>>;
export type InterviewListMoreState = "idle" | "loading" | "error";

/** Server-paged leadership list with the existing 10-second visible-tab refresh.
 * `deps` are the request scope (club and filters): changing any of them resets paging.
 * A refresh re-reads the first page and keeps rows already loaded after it: keyset
 * positions after them are unchanged, so Load more continues without gaps or repeats. */
export function useInterviewListPages<T>(read: Read<T>, idOf: (row: T) => string, deps: readonly unknown[], unavailable: string, itemDomId: (id: string) => string) {
  const [rows, setRows] = useState<T[]>([]), [total, setTotal] = useState(0), [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [more, setMore] = useState<InterviewListMoreState>("idle");
  const [announcement, setAnnouncement] = useState(""), [focusId, setFocusId] = useState<string | null>(null), [retry, setRetry] = useState(0);
  const live = useRef({ rows: [] as T[], nextCursor: null as string | null, generation: 0, loadingMore: false, read, idOf });
  live.current.read = read; live.current.idOf = idOf;
  const apply = (next: T[], cursor: string | null, count: number) => {
    live.current.rows = next; live.current.nextCursor = cursor;
    setRows(next); setNextCursor(cursor); setTotal(count);
  };
  useEffect(() => {
    const state = live.current, generation = ++state.generation;
    let pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try {
        const page = await live.current.read(null);
        if (generation !== live.current.generation) return;
        const loaded = live.current.rows, key = live.current.idOf, last = page.items[page.items.length - 1];
        const anchor = page.nextCursor && last ? loaded.findIndex(row => key(row) === key(last)) : -1;
        const tail = anchor >= 0 ? loaded.slice(anchor + 1) : [];
        if (tail.length) apply([...page.items, ...tail], live.current.nextCursor, page.total);
        else apply(page.items, page.nextCursor, page.total);
        setError("");
      } catch {
        if (generation !== live.current.generation) return;
        apply([], null, 0); setMore("idle"); setError(unavailable);
      } finally { pending = false; if (generation === live.current.generation) setLoading(false); }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    apply([], null, 0); setLoading(true); setError(""); setMore("idle"); setAnnouncement(""); setFocusId(null); void refresh();
    const timer = setInterval(visible, 10000); window.addEventListener("focus", visible);
    return () => { state.generation++; clearInterval(timer); window.removeEventListener("focus", visible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the caller's request scope
  }, [...deps, retry]);
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(itemDomId(focusId))?.focus();
    setFocusId(null);
  }, [focusId, itemDomId]);
  const loadMore = async () => {
    const from = live.current.nextCursor, generation = live.current.generation;
    if (!from || live.current.loadingMore) return;
    live.current.loadingMore = true; setMore("loading");
    try {
      const page = await live.current.read(from);
      if (generation !== live.current.generation || live.current.nextCursor !== from) { setMore("idle"); return; }
      const key = live.current.idOf, seen = new Set(live.current.rows.map(key)), added = page.items.filter(row => !seen.has(key(row)));
      const next = [...live.current.rows, ...added];
      apply(next, page.nextCursor, page.total); setMore("idle");
      setAnnouncement(`${added.length} more loaded. Showing ${next.length} of ${page.total}.`);
      setFocusId(added.length ? key(added[0]) : null);
    } catch { if (generation === live.current.generation) setMore("error"); }
    finally { live.current.loadingMore = false; }
  };
  /** An opened item lost access: clear the list like a failed refresh. */
  const fail = (message: string) => { apply([], null, 0); setMore("idle"); setError(message); };
  return { rows, total, nextCursor, loading, error, more, announcement, loadMore, fail, retry: () => setRetry(value => value + 1) };
}
