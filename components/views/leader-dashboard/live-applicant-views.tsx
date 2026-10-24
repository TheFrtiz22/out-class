"use client"
import { useRef, useState } from "react"
import { schedulingDateTime } from "@/lib/scheduling-config"
import { ShieldCheck } from "@/components/icons"
import { SortLabel } from "@/components/product/sort-label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { getClubPipelineList } from "@/lib/workspace-api"
import type { ApplicantSort } from "@/lib/live-applicant-sorting"
import { applicantLane, applicantLanes } from "@/lib/applicant-board"
import { applicationStatusLabels } from "@/lib/student-applications"
import { relevantInterview } from "@/lib/application-presentation"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { formatAverage } from "@/lib/interview-review-summary"

type Pipeline = Awaited<ReturnType<typeof getClubPipelineList>>
type Candidate = Pipeline["applications"][number]
export type ApplicantLane = (typeof applicantLanes)[number]["id"]
type Props = { applicants: Candidate[]; allApplicants?: Candidate[]; rounds: Pipeline["rounds"]; open: (app: Candidate) => void; compact: boolean; name: (app: Candidate) => string; average: (app: Candidate) => number | null; sort?: ApplicantSort; descending?: boolean; sortBy?: (key: ApplicantSort) => void; canMove?: (app: Candidate, lane: ApplicantLane) => boolean; move?: (app: Candidate, lane: ApplicantLane) => void; busy?: boolean }
export function ApplicantInterview({ app }: { app: Awaited<ReturnType<typeof import("@/lib/workspace-api").getClubPipeline>>["applications"][number] }) {
  if (app.studentId.startsWith("anonymous-")) return <span>Withheld for anonymous review</span>
  const selected = relevantInterview(app.bookings)
  if (!selected) return <span>No booking recorded</span>
  return <span>{selected.past ? "Last: " : "Next: "}{schedulingDateTime(selected.booking.slot.startTime)}</span>
}
function ApplicantIdentity({ label, anonymous }: { label: string; anonymous: boolean }) {
  return <span className="oc-applicant-person"><Avatar aria-hidden="true"><AvatarFallback>{anonymous ? <ShieldCheck size={16} /> : label.split(/\s+/).map(part => part[0]).slice(0,2).join("")}</AvatarFallback></Avatar><span>{label}</span></span>
}
function Review({ app }: { app: Candidate; average?: Props["average"] }) {
  const summary = app.roundScore
  return <span className="oc-applicant-review" data-reviewed={!!summary?.submitted}>{summary ? <><strong>{formatAverage(summary.average)}{summary.average !== null && <span> / 10</span>}</strong><span>{summary.submitted} of {summary.required} reviews submitted{summary.provisional && " · Provisional"}</span></> : "Submit your own review to see round scores"}</span>
}
const columns: { key: ApplicantSort; label: string }[] = [{ key: "name", label: "Applicant" }, { key: "round", label: "Round" }, { key: "gpa", label: "GPA" }, { key: "sat", label: "SAT" }, { key: "act", label: "ACT" }, { key: "score", label: "Rating" }, { key: "status", label: "Status / decision" }]
export function LiveApplicantList({ applicants, rounds, open, compact, name, sort = "name", descending = false, sortBy }: Props) {
  return <>
    <div className="hidden overflow-x-auto rounded-lg border bg-card xl:block"><Table><TableHeader><TableRow>{columns.map(column => <TableHead key={column.key} scope="col" aria-sort={sort === column.key ? descending ? "descending" : "ascending" : "none"}>{sortBy ? <SortLabel label={column.label} active={sort === column.key} descending={descending} onClick={() => sortBy(column.key)} /> : column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{applicants.map(app => <TableRow key={app.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => open(app)}>
      <TableCell className={compact ? "py-3" : "py-5"}><button type="button" data-applicant-id={app.id} onClick={event => { event.stopPropagation(); open(app) }} className="min-h-11 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><ApplicantIdentity label={name(app)} anonymous={app.studentId.startsWith("anonymous-")} /><span className="text-xs text-muted-foreground">{app.studentId.startsWith("anonymous-") ? "Anonymous review" : app.student.email}</span><span className="sr-only"> · Open applicant</span></button></TableCell>
      <TableCell className="text-xs">{rounds.find(round => round.id === app.roundId)?.name || "Not available"}</TableCell>
      <TableCell>{app.student.studentProfile?.gpa?.toFixed(2) ?? "—"}</TableCell>
      <TableCell>{app.student.studentProfile?.satScore ?? "—"}</TableCell>
      <TableCell>{app.student.studentProfile?.actScore ?? "—"}</TableCell>
      <TableCell className="text-xs text-muted-foreground"><Review app={app} /></TableCell>
      <TableCell><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge></TableCell>
    </TableRow>)}</TableBody></Table></div>
    <ul className="divide-y border-y xl:hidden">{applicants.map(app => <li key={app.id}><button type="button" data-applicant-id={app.id} onClick={() => open(app)} className="w-full space-y-3 rounded py-5 text-left focus-visible:outline-2 focus-visible:outline-ring"><span className="flex flex-wrap items-center justify-between gap-2"><ApplicantIdentity label={name(app)} anonymous={app.studentId.startsWith("anonymous-")} /><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge></span><span className="block text-xs text-muted-foreground">{rounds.find(round => round.id === app.roundId)?.name || "Round unavailable"} · GPA {app.student.studentProfile?.gpa?.toFixed(2) ?? "—"} · SAT {app.student.studentProfile?.satScore ?? "—"} · ACT {app.student.studentProfile?.actScore ?? "—"}</span><Review app={app} /><span className="block text-xs">Open applicant →</span></button></li>)}</ul>
  </>
}
export function LiveApplicantKanban({ applicants, allApplicants = applicants, rounds, open, name, canMove, move, busy }: Props) {
  const dragging = useRef<string | null>(null)
  const [over, setOver] = useState<ApplicantLane | null>(null)
  return <div className="oc-applicant-board grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{applicantLanes.map(lane => {
    const cards = applicants.filter(app => applicantLane(app.status) === lane.id)
    const total = allApplicants.filter(app => applicantLane(app.status) === lane.id).length
    return <section key={lane.id} aria-label={`${lane.title} applicants`} data-drop-active={over === lane.id} className="min-w-0 rounded-lg border bg-muted/30 p-3 data-[drop-active=true]:border-primary data-[drop-active=true]:bg-secondary" onDragOver={event => { const app = applicants.find(candidate => candidate.id === dragging.current); if (!busy && app && canMove?.(app, lane.id)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(lane.id) } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null) }} onDrop={event => { event.preventDefault(); const app = applicants.find(candidate => candidate.id === dragging.current); dragging.current = null; setOver(null); if (!busy && app && canMove?.(app, lane.id)) move?.(app, lane.id) }}><header className="mb-4"><h3 className="oc-card-heading flex items-center justify-between">{lane.title}<span className="text-xs font-normal text-muted-foreground">{total}</span></h3><p className="mt-1 text-xs text-muted-foreground">{lane.description}</p></header>
      <ul className="space-y-3">{cards.map(app => <li key={app.id} draggable={!busy && applicantLanes.some(target => canMove?.(app, target.id))} onDragStart={event => { dragging.current = app.id; event.dataTransfer.setData("text/plain", app.id); event.dataTransfer.effectAllowed = "move" }} onDragEnd={() => { dragging.current = null; setOver(null) }} className="rounded-md border bg-card hover:border-primary">
        <button type="button" data-applicant-id={app.id} onClick={() => { if (!dragging.current) open(app) }} className="w-full space-y-3 rounded-md p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ApplicantIdentity label={name(app)} anonymous={app.studentId.startsWith("anonymous-")} /><span className="block text-xs text-muted-foreground">{rounds.find(round => round.id === app.roundId)?.name || "Round unavailable"}</span><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge><span className="block text-xs text-muted-foreground"><Review app={app} /></span><span className="block border-t pt-3 text-xs">Review & actions →</span></button>
        {applicantLanes.some(target => canMove?.(app, target.id)) && <label className="flex items-center gap-2 border-t p-3 text-xs">Move to<select aria-label={`Move ${name(app)} to lane`} disabled={busy} value="" className="min-h-11 min-w-0 flex-1 rounded border bg-background px-2" onChange={event => move?.(app, event.target.value as ApplicantLane)}><option value="">Choose lane</option>{applicantLanes.filter(target => canMove?.(app, target.id)).map(target => <option key={target.id} value={target.id}>{target.title}</option>)}</select></label>}
      </li>)}</ul>
      {!cards.length && <p className="py-6 text-xs text-muted-foreground">{total ? "No applicants from this lane on this page." : "No applicants in this lane with the current filters."}</p>}
    </section>
  })}</div>
}

export function LiveDecisionList({ applicants, rounds, open, name, average }: Props) {
  return <ul className="divide-y border-y">{applicants.map(app => <li key={app.id}>
    <button type="button" data-applicant-id={app.id} onClick={() => open(app)} className="grid min-h-20 w-full gap-3 rounded py-5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-3">
      <span className="min-w-0"><span className="block break-words font-medium">{name(app)}</span><span className="mt-1 block text-xs text-muted-foreground">{app.studentId.startsWith("anonymous-") ? "Anonymous review" : app.student.email}</span></span>
      <span className="space-y-1 text-xs text-muted-foreground"><span className="block">{rounds.find(round => round.id === app.roundId)?.name || "Round unavailable"}</span><span className="block"><Review app={app} average={average} /></span></span>
      <span className="flex items-center justify-between gap-4 sm:justify-end"><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge><span className="text-xs">Review decision →</span></span>
    </button>
  </li>)}</ul>
}
