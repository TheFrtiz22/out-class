"use client"
import { ArrowRight, Lock, ShieldCheck } from "@/components/icons"
import { DataTable, DataTableSecondary, type DataTableColumn } from "@/components/ui/data-table"
import { joinFacts } from "@/lib/join-facts"
import { StatusPill } from "@/components/ui/status-pill"
import { PreviouslyAppliedBadge } from "@/components/previously-applied-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { getClubPipeline } from "@/lib/workspace-api"
import type { ApplicantSort } from "@/lib/live-applicant-sorting"
import { stagedLabel, type StagedDecisionView } from "@/lib/staged-decisions"
import { formatAverage, scoredEvaluationsLabel } from "@/lib/interview-review-summary"
import { defaultProfileFieldVisibility, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
type Candidate = Pipeline["applications"][number]
type Props = { votingSelection?: {ids:string[];toggle:(id:string)=>void}; applicants: Candidate[]; rounds: Pipeline["rounds"]; open: (app: Candidate) => void; compact: boolean; name: (app: Candidate) => string; sort?: ApplicantSort; descending?: boolean; sortBy?: (key: ApplicantSort) => void; profileFields?: ProfileFieldVisibility; staged?: ReadonlyMap<string, StagedDecisionView> }
function ApplicantIdentity({ label, anonymous }: { label: string; anonymous: boolean }) {
  return <span className="oc-applicant-person"><Avatar aria-hidden="true"><AvatarFallback>{anonymous ? <ShieldCheck size={16} /> : label.split(/\s+/).map(part => part[0]).slice(0,2).join("")}</AvatarFallback></Avatar><span>{label}</span></span>
}
/** Status, plus the staged (unsent) decision when there is one. */
function Status({ app, rounds, staged }: { app: Candidate; rounds: Pipeline["rounds"]; staged?: Props["staged"] }) {
  const pending = staged?.get(app.id)
  return <span className="inline-flex flex-wrap items-center gap-1"><StatusPill status={app.status} />{pending && <span className="oc-staged-chip" title="Saved for Decide › Send. Not sent yet."><ArrowRight size={14} aria-hidden="true" />{stagedLabel(pending, rounds)}</span>}</span>
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
/** Applicants: email drops first, then SAT and ACT combine into one "Test scores" column (below 880px, never beside them), then Year drops. Cards below 640px. */
export function LiveApplicantList({ applicants, rounds, open, compact, name, sort = "name", descending = false, sortBy, votingSelection, profileFields = defaultProfileFieldVisibility(), staged }: Props) {
  const columns = ([
    { id: "name", header: "Applicant", sortKey: "name", primary: true, cell: app => <span className="oc-applicant-person-row"><ApplicantIdentity label={name(app)} anonymous={anonymous(app)} /><PreviouslyAppliedBadge priors={app.priorApplications} /></span>, secondary: app => <DataTableSecondary from="xl">{anonymous(app) ? "Anonymous review" : app.student.email}</DataTableSecondary> },
    { id: "year", header: "Year", sortKey: "year", showFrom: "md", cell: app => app.student.studentProfile?.academicYear || "—" },
    { id: "round", header: "Round", sortKey: "round", cell: app => roundName(rounds, app) || "Not available" },
    { id: "gpa", header: "GPA", sortKey: "gpa", align: "end", cell: app => app.student.studentProfile?.gpa?.toFixed(2) ?? "—" },
    { id: "test", header: "Test scores", hideFrom: "lg", cell: app => testScores(app, profileFields) || "—" },
    { id: "sat", header: "SAT", sortKey: "sat", align: "end", showFrom: "lg", cell: app => app.student.studentProfile?.satScore ?? "—" },
    { id: "act", header: "ACT", sortKey: "act", align: "end", showFrom: "lg", cell: app => app.student.studentProfile?.actScore ?? "—" },
    { id: "score", header: "Rating", sortKey: "score", cell: app => <Rating app={app} /> },
    { id: "status", header: "Status", sortKey: "status", cell: app => <Status app={app} rounds={rounds} staged={staged} /> },
  ] satisfies DataTableColumn<Candidate>[]).filter(column => columnVisible(column.id, profileFields))
  return <DataTable caption="Applicants" rows={applicants} rowKey={app => app.id} columns={columns} density={compact ? "compact" : "default"}
    onOpen={app => open(app)} openLabel={app => `Open ${name(app)}`} openAttributes={app => ({ "data-applicant-id": app.id })}
    sort={sortBy ? { key: sort, descending, toggle: key => sortBy(key as ApplicantSort) } : undefined}
    selection={votingSelection ? { label: "Select for voting", rowLabel: app => `Select ${name(app)} for voting`, isSelected: app => votingSelection.ids.includes(app.id), toggle: app => votingSelection.toggle(app.id), disabled: app => !votingEligible(app.status) } : undefined}
    card={{
      title: app => <span className="oc-dt-name">{name(app)} <PreviouslyAppliedBadge priors={app.priorApplications} /></span>,
      trailing: app => <Status app={app} rounds={rounds} staged={staged} />,
      meta: app => joinFacts(profileFields.academicYear && app.student.studentProfile?.academicYear, roundName(rounds, app), profileFields.gpa && app.student.studentProfile?.gpa != null && `GPA ${app.student.studentProfile.gpa.toFixed(2)}`, testScores(app, profileFields), app.roundScore?.average != null && `Rating ${formatAverage(app.roundScore.average)}`),
    }} />
}
const votingEligible = (status: string) => ["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "WAITLISTED"].includes(status)

export function LiveDecisionList({ applicants, rounds, open, compact, name, sort = "name", descending = false, sortBy, staged }: Props) {
  const columns: DataTableColumn<Candidate>[] = [
    { id: "name", header: "Applicant", sortKey: "name", primary: true, cell: app => <span className="oc-dt-name">{name(app)}</span>, secondary: app => <DataTableSecondary from="lg">{anonymous(app) ? "Anonymous review" : app.student.email}</DataTableSecondary> },
    { id: "round", header: "Round", sortKey: "round", cell: app => roundName(rounds, app) || "Round unavailable" },
    { id: "score", header: "Rating", sortKey: "score", cell: app => <Rating app={app} /> },
    { id: "status", header: "Decision", sortKey: "status", cell: app => <Status app={app} rounds={rounds} staged={staged} /> },
  ]
  return <DataTable caption="Applications awaiting a decision" rows={applicants} rowKey={app => app.id} columns={columns} density={compact ? "compact" : "default"}
    onOpen={app => open(app)} openLabel={app => `Review decision for ${name(app)}`} openAttributes={app => ({ "data-applicant-id": app.id })}
    sort={sortBy ? { key: sort, descending, toggle: key => sortBy(key as ApplicantSort) } : undefined}
    card={{ title: app => name(app), trailing: app => <Status app={app} rounds={rounds} staged={staged} />, meta: app => joinFacts(roundName(rounds, app) || "Round unavailable", app.roundScore?.average != null ? `Rating ${formatAverage(app.roundScore.average)}` : app.roundScore ? `${app.roundScore.submitted}/${app.roundScore.required} reviews` : "Rating hidden until you review") }} />
}

export function VotingSelection({app,name,selection}:{app:{id:string;status:string};name:string;selection:NonNullable<Props["votingSelection"]>}){
 return <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-2 text-xs"><input aria-label={`Select ${name} for voting`} type="checkbox" className="oc-checkbox" checked={selection.ids.includes(app.id)} disabled={!votingEligible(app.status)} onChange={()=>selection.toggle(app.id)}/></label>;
}
