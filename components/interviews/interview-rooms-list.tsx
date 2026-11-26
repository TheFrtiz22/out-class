"use client";
import { useAssignedInterviewRooms } from "./interview-read-scope";
import { serializedWorkspaceRead } from "@/lib/serialized-workspace-read";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useDemoMode } from "@/contexts/demo-context";
import { getInterviewWorkspace, getInterviewRounds } from "@/lib/workspace-api";
import { clubInterviewHref, interviewEntryCandidate, interviewEntryHref, interviewEntryLabel, interviewRoomRoundOptions, interviewTimeRange, interviewTimingShort, myInterviewSections, type InterviewRoomEntry } from "@/lib/interview-entry";
import { groupInterviewDates } from "@/lib/interview-room-dates";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/loading-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ChevronDown } from "@/components/icons";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import "./interview-rooms-list.css";
import { RoundSelect } from "@/components/ui/round-select"
import { joinFacts } from "@/lib/join-facts";
import { pluralize } from "@/lib/copy/terms";
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config";

const openable = (row: InterviewRoomEntry) => !!(row.canOpen && row.applicationId);
const entryHref = (row: InterviewRoomEntry) => interviewEntryHref(row, typeof window === "undefined" ? undefined : window.location.href);
const shortDay = (row: InterviewRoomEntry) => new Intl.DateTimeFormat("en-US", { timeZone: row.timezone, weekday: "short", month: "short", day: "numeric" }).format(new Date(row.startTime));
const today = (timezone: string, now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
function setParam(key: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
  window.history.replaceState(null, "", url.pathname + url.search);
}

/** One interview, one row, one button. `withDay` adds the date where the section is not grouped by day. */
function InterviewRow({ row, withDay, primary }: { row: InterviewRoomEntry; withDay?: boolean; primary?: boolean }) {
  const applicant = interviewEntryCandidate(row);
  return <li className="oc-my-interview">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{applicant ?? <span className="font-normal text-muted-foreground">Open time slot</span>}</p>
      <p className="text-xs text-muted-foreground">{joinFacts(row.roundName, withDay ? shortDay(row) : "", interviewTimingShort(row), row.location || row.roomName)}</p>
      {row.interviewers.length > 0 && <p className="text-xs text-muted-foreground">With {row.interviewers.join(", ")}</p>}
    </div>
    {openable(row) && <Button asChild size="sm" variant={primary ? "default" : "outline"}><Link data-entry-link="" href={entryHref(row)} aria-label={`${interviewEntryLabel(row)} · ${applicant ?? row.roomName}`}>{interviewEntryLabel(row)}</Link></Button>}
  </li>;
}

/** My interviews: what is coming up, what still needs notes, and what is done. Nothing appears twice. */
/** `tabbed`: shown under a "My interviews" tab, so the heading is kept for screen readers but not drawn twice. */
export function InterviewRoomsList({ clubId, onSchedule, tabbed = false }: { clubId: string; onSchedule?: () => void; tabbed?: boolean }) {
  const demo = useDemoMode();
  const assignedRooms = useAssignedInterviewRooms(clubId);
  const [rows, setRows] = useState<InterviewRoomEntry[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0), [unbooked, setUnbooked] = useState(false);
  const [date, setDate] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("interviewDate") || "");
  // This filter belongs to My interviews alone. Schedule keeps its own round in `roundId`.
  const [rounds, setRounds] = useState<{id:string;name:string}[]>([]), [roundId, setRoundId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("interviewRound") || "");
  const [doneOpen, setDoneOpen] = useState(false);
  useEffect(() => {
    if (!demo.ready) return;
    setRows([]); setUnbooked(false); setLoading(true);
    const reader = serializedWorkspaceRead(
      () => Promise.all([assignedRooms(), getInterviewWorkspace(clubId), getInterviewRounds(clubId)]),
      ([result, workspace, available]) => { setRows(result); setRounds(interviewRoomRoundOptions(available.rounds, result)); setUnbooked(workspace.applications.some(a => a.assignedRoundIds.some(r => !result.some(row => row.applicationId === a.id && row.roundId === r)))); setError(""); setLoading(false); },
      () => { setRows([]); setUnbooked(false); setError("Couldn’t load your interviews. Check your current interview access and retry."); setLoading(false); },
    );
    const visible = () => { if (!document.hidden) void reader.poll(); };
    const changed = () => { void reader.refresh(); };
    void reader.poll(); const timer = setInterval(visible, 15000);
    window.addEventListener("focus", visible);
    const changes = ["outclass:interview-rounds-changed", "outclass:panels-changed", "outclass:demo-change"];
    changes.forEach(name => window.addEventListener(name, changed));
    return () => { reader.dispose(); clearInterval(timer); window.removeEventListener("focus", visible); changes.forEach(name => window.removeEventListener(name, changed)); };
  }, [clubId, retry, demo.ready, assignedRooms]);
  const usedRounds = rounds.filter(round => rows.some(row => row.roundId === round.id));
  // A filter left over from an earlier visit never hides everything without saying so.
  const activeRound = usedRounds.some(round => round.id === roundId) ? roundId : "";
  const { upNext, needsNotes, done } = myInterviewSections(rows.filter(row => !activeRound || row.roundId === activeRound));
  const days = groupInterviewDates(upNext), activeDate = days.some(group => group.day === date) ? date : "";
  const shownDays = days.filter(group => !activeDate || group.day === activeDate);
  const firstAction = shownDays.flatMap(group => group.entries).find(openable)?.id;
  const zones = [...new Set(rows.map(row => row.timezone))];
  const empty = !upNext.length && !needsNotes.length && !done.length;
  return <section aria-label="My interviews" className="space-y-6 pb-20 md:pb-6">
    <header className={tabbed && usedRounds.length < 2 ? "sr-only" : "flex flex-wrap items-center justify-between gap-3"}><h2 className={tabbed ? "sr-only" : "oc-section-heading"}>My interviews</h2>{usedRounds.length > 1 && <RoundSelect label="Filter my interviews by round" value={activeRound} onChange={value => { setRoundId(value); setParam("interviewRound", value); }} rounds={usedRounds} />}</header>
    {loading && <LoadingState label="Loading your interviews…" layout="schedule" rows={3} />}
    {error && <div role="alert">{error} <Button variant="outline" onClick={() => setRetry(v => v + 1)}>Retry</Button></div>}
    {!loading && !error && empty && <div role="status" className="space-y-2 rounded-lg border border-dashed p-5 text-sm text-muted-foreground"><p>{rows.length ? onSchedule ? "No upcoming interviews. Past times nobody booked are hidden; set new times on Schedule." : "No upcoming interviews. Past times nobody booked are hidden." : onSchedule ? "You aren’t assigned to any interviews yet. Set interview times and interviewers on Schedule." : "You aren’t assigned to any interviews yet. Club leaders add you when they schedule interviews."}</p>{onSchedule && <Button onClick={onSchedule}>Open schedule</Button>}{!rows.length && !onSchedule && <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/club/${encodeURIComponent(clubId)}/workspace?section=recruitment&tool=overview`}>Back to recruiting overview</Link>}</div>}
    {!loading && !error && upNext.length > 0 && <section aria-labelledby="my-interviews-up-next" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="my-interviews-up-next" className="text-sm font-medium">Up next</h3>
        {days.length > 1 && <SegmentedControl label="Show one day" value={activeDate} onChange={day => { setDate(day); setParam("interviewDate", day); }} options={[{ value: "", label: "All days" }, ...days.map(group => ({ value: group.day, label: group.day === today(group.timezone) ? "Today" : shortDay(group.entries[0]) }))]} />}
      </div>
      {shownDays.map(group => { const first = group.entries[0], last = group.entries.reduce((latest, row) => +new Date(row.endTime) > +new Date(latest.endTime) ? row : latest, first), booked = group.entries.filter(row => row.bookingId).length; return <section key={group.day} aria-label={group.label} className="space-y-1.5">
        <h4 className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{group.day === today(group.timezone) ? "Today" : group.label}</span><span className="tabular-nums">{interviewTimeRange({ startTime: first.startTime, endTime: last.endTime, timezone: group.timezone })}{booked ? ` · ${pluralize(booked, "interview")}` : ""}</span></h4>
        {(() => { const interviews = group.entries.filter(row => row.bookingId), open = group.entries.length - interviews.length; return <ul className="oc-my-interviews">
          {interviews.map(row => <InterviewRow key={row.id} row={row} primary={row.id === firstAction} />)}
          {/* Unbooked times are one quiet line, so the booked interviews are what stands out. */}
          {open > 0 && <li className="oc-my-interview text-sm text-muted-foreground" data-open-times="">{interviews.length ? `${pluralize(open, "more open time")} nobody has booked yet` : `${pluralize(open, "open time")}, none booked yet`}</li>}
        </ul>; })()}
      </section>; })}
    </section>}
    {!loading && !error && needsNotes.length > 0 && <section aria-labelledby="my-interviews-needs-notes" className="space-y-2">
      <h3 id="my-interviews-needs-notes" className="text-sm font-medium">Needs notes · {needsNotes.length}</h3>
      <ul className="oc-my-interviews">{needsNotes.map(row => <InterviewRow key={row.id} row={row} withDay primary={!firstAction} />)}</ul>
    </section>}
    {!loading && !error && done.length > 0 && <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
      <h3><CollapsibleTrigger className="group flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><ChevronDown aria-hidden="true" className="size-4 shrink-0 -rotate-90 transition-transform duration-150 group-data-[state=open]:rotate-0 motion-reduce:transition-none" /><span className="flex-1">Done</span><span className="text-xs font-normal text-muted-foreground">{done.length}</span></CollapsibleTrigger></h3>
      <CollapsibleContent className="oc-interview-day-content" inert={!doneOpen} aria-hidden={!doneOpen}><ul className="oc-my-interviews">{done.map(row => <InterviewRow key={row.id} row={row} withDay />)}</ul></CollapsibleContent>
    </Collapsible>}
    {!loading && !error && !empty && <p className="text-xs text-muted-foreground">{zones.length === 1 && zones[0] === SCHEDULING_TIMEZONE ? `Times are in ${SCHEDULING_TIMEZONE_LABEL}.` : "Times are in each room’s time zone."}</p>}
    {!error && unbooked && <p className="border-t pt-3 text-sm text-muted-foreground">Some applicants assigned to you haven’t booked a time slot yet. <Link className="py-2.5 underline underline-offset-4" href={clubInterviewHref(clubId, "interviewTab=rooms")}>Open the interview room</Link></p>}
  </section>;
}
