"use client";
import { useAssignedInterviewRooms } from "./interview-read-scope";
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { getInterviewWorkspace, getInterviewRounds } from "@/lib/workspace-api";
import { interviewEntryHref, interviewEntryStatus, type InterviewRoomEntry } from "@/lib/interview-entry";
import { defaultInterviewDate, groupInterviewDates, readExpandedInterviewDates } from "@/lib/interview-room-dates";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "@/components/icons";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import "./interview-rooms-list.css";

export function InterviewRoomsList({ clubId }: { clubId: string }) {
  const demo = useDemoMode();
  const assignedRooms = useAssignedInterviewRooms(clubId);
  const [rows, setRows] = useState<InterviewRoomEntry[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [secondary, setSecondary] = useState(false);
  const [date, setDate] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("interviewDate") || "");
  const [expanded, setExpanded] = useState<string[] | null>(() => typeof window === "undefined" ? null : readExpandedInterviewDates(window.location.search));
  const [rounds, setRounds] = useState<{id:string;name:string}[]>([]), [roundId, setRoundId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("roundId") || "");
  const groups = groupInterviewDates(rows.filter(row => !roundId || row.roundId === roundId)), defaultDay = date || defaultInterviewDate(groups);
  const openDays = expanded ?? (defaultDay ? [defaultDay] : []);
  const rememberDays = useCallback((days: string[]) => {
    setExpanded(days);
    const url = new URL(window.location.href); url.searchParams.set("interviewDays", days.join(","));
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);
  useEffect(() => {
    if (expanded === null && !loading && !error && groups.length) rememberDays(defaultDay ? [defaultDay] : []);
  }, [expanded, loading, error, groups.length, defaultDay, rememberDays]);
  useEffect(() => {
    if (!demo.ready) return;
    setRows([]); setSecondary(false); setLoading(true);
    const reader = serializedWorkspaceRead(
      () => Promise.all([assignedRooms(), getInterviewWorkspace(clubId), getInterviewRounds(clubId)]),
      ([result, workspace, available]) => { setRows(result); setRounds(available.rounds); setSecondary(workspace.applications.some(a => a.assignedRoundIds.some(r => !result.some(row => row.applicationId === a.id && row.roundId === r)))); setError(""); setLoading(false); },
      () => { setRows([]); setSecondary(false); setError("Couldn’t load assigned interviews. Check your current interview access and retry."); setLoading(false); },
    );
    const visible = () => { if (!document.hidden) void reader.poll(); };
    const changed = () => { void reader.refresh(); };
    void reader.poll(); const timer = setInterval(visible, 15000);
    window.addEventListener("focus", visible);
    const changes = ["outclass:interview-rounds-changed", "outclass:panels-changed", "outclass:demo-change"];
    changes.forEach(name => window.addEventListener(name, changed));
    return () => { reader.dispose(); clearInterval(timer); window.removeEventListener("focus", visible); changes.forEach(name => window.removeEventListener(name, changed)); };
  }, [clubId, retry, demo.ready, assignedRooms]);
  const shown = groups.filter(group => !date || group.day === date);
  return <section aria-label="Interview rooms" className="space-y-4 pb-20 md:pb-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Your interview rooms</h2><label className="flex items-center gap-2 text-sm">Round<select className="ir-select" aria-label="Filter interview rooms by round" value={roundId} onChange={e => { setRoundId(e.target.value); const url = new URL(window.location.href); if(e.target.value)url.searchParams.set("roundId",e.target.value);else url.searchParams.delete("roundId");window.history.replaceState(null,"",url.pathname+url.search); }}><option value="">All rounds</option>{rounds.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label className="flex items-center gap-2 text-sm">Date<input aria-label="Filter assigned interview date" type="date" className="rounded-md border bg-card px-2 py-1.5" value={date} onChange={e => { const selected = e.target.value; setDate(selected); const url = new URL(window.location.href); if (selected) url.searchParams.set("interviewDate", selected); else url.searchParams.delete("interviewDate"); window.history.replaceState(null, "", url.pathname + url.search); if (selected) rememberDays([...new Set([...openDays, selected])]); }} /></label></header>
    {loading && <p role="status">Loading assigned interviews…</p>}
    {error && <div role="alert">{error} <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button></div>}
    {!loading && !error && !shown.length && <p role="status" className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{date && rows.length ? "No assigned interviews on this date." : "No assigned interviews."}</p>}
    {!error && shown.map(({ day, label, entries }) => <Collapsible key={day} open={openDays.includes(day)} onOpenChange={open => rememberDays(open ? [...openDays, day] : openDays.filter(value => value !== day))}>
      <h3><CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 transition-transform duration-150 group-data-[state=open]:rotate-0 motion-reduce:transition-none" /><span className="flex-1">{label}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">{entries.length} {entries.length === 1 ? "slot" : "slots"}</span>
      </CollapsibleTrigger></h3>
      <CollapsibleContent className="oc-interview-day-content" inert={!openDays.includes(day)} aria-hidden={!openDays.includes(day)}><ul className="divide-y rounded-lg border bg-card">{entries.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 space-y-1"><p className="text-sm font-medium">{row.candidate || row.roomName} <span className="ml-2 text-xs font-normal text-muted-foreground">{interviewEntryStatus(row)}</span></p><p className="text-sm">{new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(row.startTime))} · {Math.round((+new Date(row.endTime) - +new Date(row.startTime)) / 60000)} min · {row.timezone}</p><p className="break-words text-sm text-muted-foreground">{row.roundName} · {row.roomName} · {row.location}</p>{!!row.interviewers.length && <p className="text-xs text-muted-foreground">With {row.interviewers.join(", ")}</p>}</div>{row.canOpen && row.applicationId && <Link className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring" href={interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href)}>{row.completed ? "Open review" : row.started ? "Resume interview" : "Open interview"}</Link>}</li>)}</ul></CollapsibleContent>
    </Collapsible>)}
    {!error && secondary && <section className="border-t pt-3 text-sm"><h3 className="py-2 font-medium">Other assigned interviews</h3><p className="mb-2 text-muted-foreground">Your authorized assignments outside the scheduled rooms.</p><Link className="inline-flex min-h-10 items-center underline" href={`/club/${clubId}/workspace?section=recruitment&tool=interviews&interviewTab=rooms&interview=1`}>Open assigned candidate queue</Link></section>}
  </section>;
}
