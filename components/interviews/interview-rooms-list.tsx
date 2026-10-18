"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { getAssignedInterviewRooms, getInterviewWorkspace } from "@/lib/workspace-api";
import { interviewEntryHref, interviewEntryStatus, sortInterviewEntries, type InterviewRoomEntry } from "@/lib/interview-entry";
import { Button } from "@/components/ui/button";

export function InterviewRoomsList({ clubId }: { clubId: string }) {
  const demo = useDemoMode();
  const [rows, setRows] = useState<InterviewRoomEntry[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [secondary, setSecondary] = useState(false);
  const [date, setDate] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("interviewDate") || "");
  useEffect(() => {
    if (!demo.ready) return;
    let current = true, pending = false;
    setRows([]); setSecondary(false); setLoading(true);
    const refresh = async () => {
      if (pending) return; pending = true;
      try {
        const [result, workspace] = await Promise.all([getAssignedInterviewRooms(clubId), getInterviewWorkspace(clubId)]);
        if (current) { setRows(result); setSecondary(workspace.applications.some(a => a.assignedRoundIds.some(r => !result.some(row => row.applicationId === a.id && row.roundId === r)))); setError(""); }
      } catch { if (current) { setRows([]); setSecondary(false); setError("Couldn’t load assigned interviews. Check your current interview access and retry."); } }
      finally { pending = false; if (current) setLoading(false); }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    void refresh(); const timer = setInterval(visible, 15000);
    window.addEventListener("focus", visible); window.addEventListener("outclass:panels-changed", visible); window.addEventListener("outclass:demo-change", visible);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", visible); window.removeEventListener("outclass:panels-changed", visible); window.removeEventListener("outclass:demo-change", visible); };
  }, [clubId, retry, demo.ready]);
  const ordered = sortInterviewEntries(rows), shown = ordered.filter(r => !date || r.startTime && new Intl.DateTimeFormat("en-CA", { timeZone: r.timezone }).format(new Date(r.startTime)) === date);
  const groups = new Map<string, InterviewRoomEntry[]>();
  for (const row of shown) { const key = new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(row.startTime)); groups.set(key, [...groups.get(key) || [], row]); }
  return <section aria-label="Interview rooms" className="space-y-4 pb-20 md:pb-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Your interview rooms</h2><label className="flex items-center gap-2 text-sm">Date<input aria-label="Filter assigned interview date" type="date" className="rounded-md border bg-card px-2 py-1.5" value={date} onChange={e => { setDate(e.target.value); const url = new URL(window.location.href); if (e.target.value) url.searchParams.set("interviewDate", e.target.value); else url.searchParams.delete("interviewDate"); window.history.replaceState(null, "", url.pathname + url.search); }} /></label></header>
    {loading && <p role="status">Loading assigned interviews…</p>}
    {error && <div role="alert">{error} <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button></div>}
    {!loading && !error && !shown.length && <p role="status" className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{date && rows.length ? "No assigned interviews on this date." : "No assigned interviews."}</p>}
    {!error && [...groups].map(([day, entries]) => <section key={day} aria-label={day} className="space-y-2"><h3 className="text-sm font-medium text-muted-foreground">{day}</h3><ul className="divide-y rounded-lg border bg-card">{entries.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 space-y-1"><p className="text-sm font-medium">{row.candidate || row.roomName} <span className="ml-2 text-xs font-normal text-muted-foreground">{interviewEntryStatus(row)}</span></p><p className="text-sm">{new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(row.startTime))} · {Math.round((+new Date(row.endTime) - +new Date(row.startTime)) / 60000)} min · {row.timezone}</p><p className="break-words text-sm text-muted-foreground">{row.roundName} · {row.roomName} · {row.location}</p>{!!row.interviewers.length && <p className="text-xs text-muted-foreground">With {row.interviewers.join(", ")}</p>}</div>{row.canOpen && row.applicationId && <Link className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring" href={interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href)}>{row.completed ? "Open review" : row.started ? "Resume interview" : "Open interview"}</Link>}</li>)}</ul></section>)}
    {!error && secondary && <details className="border-t pt-3 text-sm"><summary className="cursor-pointer py-2">Other assigned interviews</summary><p className="mb-2 text-muted-foreground">Your authorized assignments outside the scheduled rooms.</p><Link className="inline-flex min-h-10 items-center underline" href={`/club/${clubId}/workspace?section=recruitment&tool=interviews&interviewTab=rooms&interview=1`}>Open assigned candidate queue</Link></details>}
  </section>;
}
