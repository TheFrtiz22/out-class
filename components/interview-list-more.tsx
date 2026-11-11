"use client";
import { Button } from "@/components/ui/button";
import type { InterviewListMoreState } from "@/hooks/use-interview-list-pages";

/** Compact list footer: count, one Load more / Retry button (kept as one element so focus survives
 * state changes) and a polite live region that announces only results the viewer asked for. */
export function InterviewListMore({ shown, total, hasMore, state, announcement, label, onMore }: { shown: number; total: number; hasMore: boolean; state: InterviewListMoreState; announcement: string; label: string; onMore: () => void }) {
  const busy = state === "loading";
  return <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    {shown > 0 && <p className="mr-auto">Showing {shown} of {Math.max(total, shown)}</p>}
    {state === "error" && <p role="alert" className="text-destructive">Couldn’t load more {label}.</p>}
    {hasMore && <Button type="button" size="sm" variant="outline" aria-disabled={busy || undefined} aria-busy={busy || undefined} onClick={() => { if (!busy) onMore(); }}>{busy ? "Loading more…" : state === "error" ? "Retry" : "Load more"}</Button>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>;
}
