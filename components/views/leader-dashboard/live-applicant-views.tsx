"use client"
import { useRef, useState } from "react"
import { schedulingDateTime } from "@/lib/scheduling-config"
import { ArrowRight, Lock, ShieldCheck } from "@/components/icons"
import { DataTable, DataTableSecondary, type DataTableColumn } from "@/components/ui/data-table"
import { joinFacts } from "@/lib/join-facts"
import { StatusPill } from "@/components/ui/status-pill"
import { PreviouslyAppliedBadge } from "@/components/previously-applied-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { getClubPipeline } from "@/lib/workspace-api"
import type { ApplicantSort } from "@/lib/live-applicant-sorting"
import { applicantLane, applicantLanes } from "@/lib/applicant-board"
import { relevantInterview } from "@/lib/application-presentation"
import { formatAverage, scoredEvaluationsLabel } from "@/lib/interview-review-summary"
import { NativeSelect } from "@/components/ui/native-select"
import { defaultProfileFieldVisibility, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
type Candidate = Pipeline["applications"][number]
export type ApplicantLane = (typeof applicantLanes)[number]["id"]
type Props = { votingSelection?: {ids:string[];toggle:(id:string)=>void}; applicants: Candidate[]; allApplicants?: Candidate[]; laneCounts?: Record<string, number>; rounds: Pipeline["rounds"]; open: (app: Candidate) => void; compact: boolean; name: (app: Candidate) => string; average: (app: Candidate) => number | null; sort?: ApplicantSort; descending?: boolean; sortBy?: (key: ApplicantSort) => void; canMove?: (app: Candidate, lane: ApplicantLane) => boolean; move?: (app: Candidate, lane: ApplicantLane) => void; busy?: boolean; profileFields?: ProfileFieldVisibility }
export function ApplicantInterview({ app }: { app: Awaited<ReturnType<typeof import("@/lib/workspace-api").getClubPipeline>>["applications"][number] }) {
  if (app.studentId.startsWith("anonymous-")) return <span>Withheld for anonymous review</span>
  const selected = relevantInterview(app.bookings)
  if (!selected) return <span>No interview scheduled</span>
  return <span>{selected.past ? "Last: " : "Next: "}{schedulingDateTime(selected.booking.slot.startTime)}</span>
}
function ApplicantIdentity({ label, anonymous }: { label: string; anonymous: boolean }) {
  return <span className="oc-applicant-person"><Avatar aria-hidden="true"><AvatarFallback>{anonymous ? <ShieldCheck size={16} /> : label.split(/\s+/).map(part => part[0]).slice(0,2).join("")}</AvatarFallback></Avatar><span>{label}</span></span>
}
function Review({ app }: { app: Candidate; average?: Props["average"] }) {
  const summary = app.roundScore
  return <span className="oc-applicant-review" data-reviewed={!!summary?.submitted}>{summary ? <><strong>{formatAverage(summary.average)}{summary.average !== null && <span> / 10</span>}</strong><span>{summary.average === null ? `${summary.submitted} of ${summary.required} reviews submitted` : `Average of ${scoredEvaluationsLabel(summary.submitted)}`}{summary.provisional && " · Provisional"}</span></> : <span className="oc-applicant-review-hidden"><Lock aria-hidden="true" size={14} />Hidden until you review</span>}</span>
}
/** The rating on one line: the average (or the submitted count) with the detail in a tooltip and for screen readers. */
function Rating({ app }: { app: Candidate }) {
  const summary = app.roundScore
  if (!summary) return <span className="oc-applicant-review-hidden oc-dt-muted" title="Hidden until you review"><Lock aria-hidden="true" size={14} />Hidden<span className="sr-only"> until you review</span></span>
  const detail = `${summary.average === null ? `${summary.submitted} of ${summary.required} reviews submitted` : `Average of ${scoredEvaluationsLabel(summary.submitted)}`}${summary.provisional ? " · Provisional" : ""}`
  return <span title={detail}>{summary.average === null ? <span className="oc-dt-muted">{summary.submitted}/{summary.required} reviews</span> : <><strong className="font-semibold">{formatAverage(summary.average)}</strong><span className="oc-dt-muted"> /10{summary.provisional ? "*" : ""}</span></>}<span className="sr-only"> · {detail}</span></span>
}
export const applicantSortOptions: { key: ApplicantSort; label: string }[] = [{ key: "name", label: "Name" }, { key: "year", label: "Class year" }, { key: "round", label: "Round" }, { key: "gpa", label: "GPA" }, { key: "sat", label: "SAT" }, { key: "act", label: "ACT" }, { key: "score", label: "Rating" }, { key: "status", label: "Status" }]
const anonymous = (app: Candidate) => app.studentId.startsWith("anonymous-")
const roundName = (rounds: Pipeline["rounds"], app: Candidate) => rounds.find(round => round.id === app.roundId)?.name
const testScores = (app: Candidate, fields: ProfileFieldVisibility) => joinFacts(fields.sat && app.student.studentProfile?.satScore != null && `SAT ${app.student.studentProfile.satScore}`, fields.act && app.student.studentProfile?.actScore != null && `ACT ${app.student.studentProfile.actScore}`)
/** Profile columns the club has hidden are not rendered (their values are already withheld by the server). */
const columnVisible = (id: string, fields: ProfileFieldVisibility) => id === "gpa" ? fields.gpa : id === "sat" ? fields.sat : id === "act" ? fields.act : id === "test" ? fields.sat || fields.act : id === "year" ? fields.academicYear : true
/** Applicants: email drops first, then SAT and ACT combine into Test, then Year drops. Cards below 640px. */
export function LiveApplicantList({ applicants, rounds, open, compact, name, sort = "name", descending = false, sortBy, votingSelection, profileFields = defaultProfileFieldVisibility() }: Props) {
  const columns = ([
    { id: "name", header: "Applicant", sortKey: "name", primary: true, cell: app => <span className="oc-applicant-person-row"><ApplicantIdentity label={name(app)} anonymous={anonymous(app)} /><PreviouslyAppliedBadge priors={app.priorApplications} /></span>, secondary: app => <DataTableSecondary from="xl">{anonymous(app) ? "Anonymous review" : app.student.email}</DataTableSecondary> },
    { id: "year", header: "Year", sortKey: "year", showFrom: "md", cell: app => app.student.studentProfile?.academicYear || "—" },
    { id: "round", header: "Round", sortKey: "round", cell: app => roundName(rounds, app) || "Not available" },
    { id: "gpa", header: "GPA", sortKey: "gpa", align: "end", cell: app => app.student.studentProfile?.gpa?.toFixed(2) ?? "—" },
    { id: "test", header: "Test", hideFrom: "lg", cell: app => testScores(app, profileFields) || "—" },
    { id: "sat", header: "SAT", sortKey: "sat", align: "end", showFrom: "lg", cell: app => app.student.studentProfile?.satScore ?? "—" },
    { id: "act", header: "ACT", sortKey: "act", align: "end", showFrom: "lg", cell: app => app.student.studentProfile?.actScore ?? "—" },
    { id: "score", header: "Rating", sortKey: "score", cell: app => <Rating app={app} /> },
    { id: "status", header: "Status", sortKey: "status", cell: app => <StatusPill status={app.status} /> },
  ] satisfies DataTableColumn<Candidate>[]).filter(column => columnVisible(column.id, profileFields))
  return <DataTable caption="Applicants" rows={applicants} rowKey={app => app.id} columns={columns} density={compact ? "compact" : "default"}
    onOpen={app => open(app)} openLabel={app => `Open ${name(app)}`} openAttributes={app => ({ "data-applicant-id": app.id })}
    sort={sortBy ? { key: sort, descending, toggle: key => sortBy(key as ApplicantSort) } : undefined}
    selection={votingSelection ? { label: "Select for voting", rowLabel: app => `Select ${name(app)} for voting`, isSelected: app => votingSelection.ids.includes(app.id), toggle: app => votingSelection.toggle(app.id), disabled: app => !votingEligible(app.status) } : undefined}
    card={{
      title: app => <span className="oc-dt-name">{name(app)} <PreviouslyAppliedBadge priors={app.priorApplications} /></span>,
      trailing: app => <StatusPill status={app.status} />,
      meta: app => joinFacts(profileFields.academicYear && app.student.studentProfile?.academicYear, roundName(rounds, app), profileFields.gpa && app.student.studentProfile?.gpa != null && `GPA ${app.student.studentProfile.gpa.toFixed(2)}`, testScores(app, profileFields), app.roundScore?.average != null && `Rating ${formatAverage(app.roundScore.average)}`),
    }} />
}
const votingEligible = (status: string) => ["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "WAITLISTED"].includes(status)
export function LiveApplicantKanban({ applicants, allApplicants = applicants, laneCounts, rounds, open, name, canMove, move, busy, votingSelection }: Props) {
  const dragging = useRef<string | null>(null)
  const [over, setOver] = useState<ApplicantLane | null>(null)
  return <div className="oc-applicant-board grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{applicantLanes.map(lane => {
    const cards = applicants.filter(app => applicantLane(app.status) === lane.id)
    const total = laneCounts?.[lane.id] ?? allApplicants.filter(app => applicantLane(app.status) === lane.id).length
    return <section key={lane.id} aria-label={`${lane.title} applicants`} data-drop-active={over === lane.id} className="min-w-0 rounded-lg border bg-muted/30 p-3 data-[drop-active=true]:border-primary data-[drop-active=true]:bg-secondary" onDragOver={event => { const app = applicants.find(candidate => candidate.id === dragging.current); if (!busy && app && canMove?.(app, lane.id)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setOver(lane.id) } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null) }} onDrop={event => { event.preventDefault(); const app = applicants.find(candidate => candidate.id === dragging.current); dragging.current = null; setOver(null); if (!busy && app && canMove?.(app, lane.id)) move?.(app, lane.id) }}><header className="mb-4"><h3 className="oc-card-heading flex items-center justify-between">{lane.title}<span className="text-xs font-normal text-muted-foreground">{total}</span></h3><p className="mt-1 text-xs text-muted-foreground">{lane.description}</p></header>
      <ul className="space-y-3">{cards.map(app => <li key={app.id} draggable={!busy && applicantLanes.some(target => canMove?.(app, target.id))} onDragStart={event => { dragging.current = app.id; event.dataTransfer.setData("text/plain", app.id); event.dataTransfer.effectAllowed = "move" }} onDragEnd={() => { dragging.current = null; setOver(null) }} className="rounded-md border bg-card hover:border-primary">
        {votingSelection&&<VotingSelection app={app} name={name(app)} selection={votingSelection}/>}<button type="button" data-applicant-id={app.id} onClick={() => { if (!dragging.current) open(app) }} className="w-full space-y-3 rounded-md p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ApplicantIdentity label={name(app)} anonymous={app.studentId.startsWith("anonymous-")} /><span className="block text-xs text-muted-foreground">{rounds.find(round => round.id === app.roundId)?.name || "Round unavailable"}</span><StatusPill status={app.status} /><span className="block text-xs text-muted-foreground"><Review app={app} /></span><span className="flex items-center gap-1 border-t pt-3 text-xs">Review & actions<ArrowRight size={14} aria-hidden="true" /></span></button>
        {applicantLanes.some(target => canMove?.(app, target.id)) && <label className="flex items-center gap-2 border-t p-3 text-xs">Move to<NativeSelect aria-label={`Move ${name(app)} to lane`} disabled={busy} value="" className="min-h-11 min-w-0 flex-1" onChange={event => move?.(app, event.target.value as ApplicantLane)}><option value="">Choose lane</option>{applicantLanes.filter(target => canMove?.(app, target.id)).map(target => <option key={target.id} value={target.id}>{target.title}</option>)}</NativeSelect></label>}
      </li>)}</ul>
      {!cards.length && <p className="py-6 text-xs text-muted-foreground">{total ? "No applicants from this lane on this page." : "No applicants in this lane with the current filters."}</p>}
    </section>
  })}</div>
}

export function LiveDecisionList({ applicants, rounds, open, compact, name, sort = "name", descending = false, sortBy }: Props) {
  const columns: DataTableColumn<Candidate>[] = [
    { id: "name", header: "Applicant", sortKey: "name", primary: true, cell: app => <span className="oc-dt-name">{name(app)}</span>, secondary: app => <DataTableSecondary from="lg">{anonymous(app) ? "Anonymous review" : app.student.email}</DataTableSecondary> },
    { id: "round", header: "Round", sortKey: "round", cell: app => roundName(rounds, app) || "Round unavailable" },
    { id: "score", header: "Rating", sortKey: "score", cell: app => <Rating app={app} /> },
    { id: "status", header: "Decision", sortKey: "status", cell: app => <StatusPill status={app.status} /> },
  ]
  return <DataTable caption="Applications awaiting a decision" rows={applicants} rowKey={app => app.id} columns={columns} density={compact ? "compact" : "default"}
    onOpen={app => open(app)} openLabel={app => `Review decision for ${name(app)}`} openAttributes={app => ({ "data-applicant-id": app.id })}
    sort={sortBy ? { key: sort, descending, toggle: key => sortBy(key as ApplicantSort) } : undefined}
    card={{ title: app => name(app), trailing: app => <StatusPill status={app.status} />, meta: app => joinFacts(roundName(rounds, app) || "Round unavailable", app.roundScore?.average != null ? `Rating ${formatAverage(app.roundScore.average)}` : app.roundScore ? `${app.roundScore.submitted}/${app.roundScore.required} reviews` : "Rating hidden until you review") }} />
}

export function VotingSelection({app,name,selection}:{app:{id:string;status:string};name:string;selection:NonNullable<Props["votingSelection"]>}){
 return <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs"><input aria-label={`Select ${name} for voting`} type="checkbox" className="oc-checkbox" checked={selection.ids.includes(app.id)} disabled={!votingEligible(app.status)} onChange={()=>selection.toggle(app.id)}/></label>;
}
