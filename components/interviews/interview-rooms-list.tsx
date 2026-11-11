"use client";
import { useAssignedInterviewRooms } from "./interview-read-scope";
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { getInterviewWorkspace, getInterviewRounds } from "@/lib/workspace-api";
import { clubInterviewHref, interviewEntryAction, interviewEntryHref, interviewEntryStatus, interviewRoomRoundOptions, interviewTimingContext, unfinishedInterviewEntries, type InterviewRoomEntry } from "@/lib/interview-entry";
import { defaultInterviewDate, groupInterviewDates, readExpandedInterviewDates } from "@/lib/interview-room-dates";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-picker";
import { LoadingState } from "@/components/ui/loading-state";
import { ChevronDown } from "@/components/icons";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import "./interview-rooms-list.css";
import { RoundSelect } from "@/components/ui/round-select"
import { DataTable, DataTableSecondary } from "@/components/ui/data-table";
import { joinFacts } from "@/lib/join-facts";
import { SortControl } from "@/components/ui/sort-control";
import { useListSort } from "@/hooks/use-list-sort";

const sortKeys = ["time", "candidate", "round"] as const;
type RoomSort = (typeof sortKeys)[number];
const sortOptions: { key: RoomSort; label: string }[] = [{ key: "time", label: "Time" }, { key: "candidate", label: "Candidate" }, { key: "round", label: "Round" }];
const entryHref = (row: InterviewRoomEntry) => interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href);
const openable = (row: InterviewRoomEntry) => !!(row.canOpen && row.applicationId);

export function InterviewRoomsList({ clubId }: { clubId: string }) {
  const demo = useDemoMode();
  const listSort = useListSort(sortKeys, "time");
  const sortEntries = (entries: InterviewRoomEntry[]) => [...entries].sort((a, b) => { const compared = listSort.key === "candidate" ? (a.candidate || a.roomName).localeCompare(b.candidate || b.roomName) : listSort.key === "round" ? a.roundName.localeCompare(b.roundName) : new Date(a.startTime).getTime() - new Date(b.startTime).getTime(); return (listSort.descending ? -compared : compared) || new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.id.localeCompare(b.id); });
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
      ([result, workspace, available]) => { setRows(result); setRounds(interviewRoomRoundOptions(available.rounds, result)); setSecondary(workspace.applications.some(a => a.assignedRoundIds.some(r => !result.some(row => row.applicationId === a.id && row.roundId === r)))); setError(""); setLoading(false); },
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
  // Unfinished work whose scheduled time has passed stays one tap away, without an old notification.
  const unfinished = unfinishedInterviewEntries(rows.filter(row => !roundId || row.roundId === roundId));
  return <section aria-label="Interview rooms" className="space-y-4 pb-20 md:pb-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="oc-section-heading">Your interview rooms</h2><div className="oc-list-toolbar min-w-0 flex-1 justify-end"><div className="oc-filter-bar"><RoundSelect label="Filter interview rooms by round" value={roundId} onChange={value => { setRoundId(value); const url = new URL(window.location.href); if(value)url.searchParams.set("roundId",value);else url.searchParams.delete("roundId");window.history.replaceState(null,"",url.pathname+url.search); }} rounds={rounds} /><DateField label="Filter assigned interview date" value={date} marked={groups.map(group => group.day)} markedLabel="has interviews" placeholder="All dates" clearLabel="All dates" onChange={selected => {  setDate(selected); const url = new URL(window.location.href); if (selected) url.searchParams.set("interviewDate", selected); else url.searchParams.delete("interviewDate"); window.history.replaceState(null, "", url.pathname + url.search); if (selected) rememberDays([...new Set([...openDays, selected])]); }} /></div><SortControl label="Sort interviews" options={sortOptions} value={listSort.key} descending={listSort.descending} onChange={listSort.set} /></div></header>
    {loading && <LoadingState label="Loading assigned interviews…" layout="schedule" rows={3} />}
    {error && <div role="alert">{error} <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button></div>}
    {!loading && !error && unfinished.length > 0 && <section aria-labelledby="unfinished-interviews" className="space-y-2"><h3 id="unfinished-interviews" className="text-sm font-medium">Unfinished interviews · {unfinished.length}</h3><ul className="divide-y rounded-lg border bg-card">{unfinished.map(row => <li key={`unfinished-${row.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="text-sm font-medium">{row.candidate || row.roomName}</p><p className="text-xs text-muted-foreground">{row.roundName} · {new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, weekday: "short", month: "short", day: "numeric" }).format(new Date(row.startTime))} · {interviewTimingContext(row)}</p></div><Link className="inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring" href={interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href)}>{interviewEntryAction(row)}</Link></li>)}</ul></section>}
    {!loading && !error && !shown.length && <div role="status" className="space-y-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground"><p>{date && rows.length ? "You have no assigned interviews on this date." : roundId && rows.length ? "You have no assigned interviews in this round." : "You aren’t assigned to any interview rooms yet. Club leaders add you to a panel when they schedule interviews."}</p>{date && rows.length ? <Button variant="outline" size="sm" onClick={() => { setDate(""); const url = new URL(window.location.href); url.searchParams.delete("interviewDate"); window.history.replaceState(null, "", url.pathname + url.search); }}>Show all dates</Button> : roundId && rows.length ? <Button variant="outline" size="sm" onClick={() => { setRoundId(""); const url = new URL(window.location.href); url.searchParams.delete("roundId"); window.history.replaceState(null, "", url.pathname + url.search); }}>Show all rounds</Button> : <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=overview`}>Back to recruiting overview</Link>}</div>}
    {!error && shown.map(({ day, label, entries, span }) => <Collapsible key={day} open={openDays.includes(day)} onOpenChange={open => rememberDays(open ? [...openDays, day] : openDays.filter(value => value !== day))}>
      <h3><CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 transition-transform duration-150 group-data-[state=open]:rotate-0 motion-reduce:transition-none" /><span className="flex-1">{label}</span><span className="shrink-0 text-right text-xs font-normal text-muted-foreground">{span && <span className="oc-interview-day-span">{span}</span>}{entries.length} {entries.length === 1 ? "slot" : "slots"}</span>
      </CollapsibleTrigger></h3>
      <CollapsibleContent className="oc-interview-day-content" inert={!openDays.includes(day)} aria-hidden={!openDays.includes(day)}><DataTable caption={`Interviews on ${label}`} rows={sortEntries(entries)} rowKey={row => row.id}
        sort={{ key: listSort.key, descending: listSort.descending, toggle: key => listSort.toggle(key as RoomSort) }}
        isOpenable={openable} openLabel={row => `${interviewEntryAction(row)} · ${row.candidate || row.roomName}`} onOpen={(_row, origin) => origin?.closest("tr, li")?.querySelector<HTMLAnchorElement>("a[data-entry-link]")?.click()}
        columns={[
          { id: "candidate", header: "Candidate", sortKey: "candidate", primary: true, cell: row => <span className="oc-dt-name" title={row.interviewers.length ? `With ${row.interviewers.join(", ")}` : undefined}>{row.candidate || row.roomName}</span>, secondary: row => <DataTableSecondary>{interviewEntryStatus(row)}</DataTableSecondary> },
          { id: "time", header: "Time", sortKey: "time", cell: row => interviewTimingContext(row) },
          { id: "round", header: "Round", sortKey: "round", showFrom: "md", cell: row => row.roundName },
          { id: "room", header: "Room", showFrom: "xl", cell: row => <span className="oc-dt-muted" title={row.interviewers.length ? `With ${row.interviewers.join(", ")}` : undefined}>{joinFacts(row.roomName, row.location)}</span> },
          { id: "action", header: <span className="sr-only">Action</span>, align: "end", cell: row => openable(row) ? <Link className="oc-dt-action" data-entry-link="" href={entryHref(row)}>{interviewEntryAction(row)}</Link> : null },
        ]}
        card={{ title: row => row.candidate || row.roomName, meta: row => joinFacts(interviewEntryStatus(row), interviewTimingContext(row), row.roundName, row.location), actions: row => openable(row) ? <Link className="oc-dt-action" data-entry-link="" href={entryHref(row)}>{interviewEntryAction(row)}</Link> : null }} /></CollapsibleContent>
    </Collapsible>)}
    {!error && secondary && <section className="border-t pt-3 text-sm"><h3 className="py-2 font-medium">Other assigned interviews</h3><p className="mb-2 text-muted-foreground">Your authorized assignments outside the scheduled rooms.</p><Link className="inline-flex min-h-10 items-center underline" href={clubInterviewHref(clubId, "interviewTab=rooms")}>Open assigned candidate queue</Link></section>}
  </section>;
}
