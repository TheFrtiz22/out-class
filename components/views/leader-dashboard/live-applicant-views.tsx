"use client"
import type { getClubPipeline } from "@/lib/workspace-api"
import { applicantLane, applicantLanes } from "@/lib/applicant-board"
import { applicationStatusLabels } from "@/lib/student-applications"
import { relevantInterview } from "@/lib/application-presentation"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
type Candidate = Pipeline["applications"][number]
type Props = { applicants: Candidate[]; rounds: Pipeline["rounds"]; open: (app: Candidate) => void; compact: boolean; name: (app: Candidate) => string; average: (app: Candidate) => number | null }
export function ApplicantInterview({ app }: { app: Candidate }) {
  if (app.studentId.startsWith("anonymous-")) return <span>Withheld for anonymous review</span>
  const selected = relevantInterview(app.bookings)
  if (!selected) return <span>No booking recorded</span>
  return <span>{selected.past ? "Last: " : "Next: "}{new Date(selected.booking.slot.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
}
function Review({ app, average }: { app: Candidate; average: Props["average"] }) {
  return <span>{app.evaluations.length ? `${average(app)?.toFixed(1)} / 10 · ${app.evaluations.length} ${app.evaluations.length === 1 ? "evaluation" : "evaluations"}` : "Unreviewed"}</span>
}
export function LiveApplicantList({ applicants, rounds, open, compact, name, average }: Props) {
  return <>
    <div className="hidden overflow-x-auto rounded-lg border bg-card xl:block"><Table><TableHeader><TableRow>{["Applicant", "Round", "Interview", "Status / decision", "Review"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{applicants.map(app => <TableRow key={app.id} className="hover:bg-secondary/40">
      <TableCell className={compact ? "py-3" : "py-5"}><button data-applicant-id={app.id} onClick={() => open(app)} className="min-h-11 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><span className="block text-sm font-medium">{name(app)}</span><span className="text-xs text-muted-foreground">{app.studentId.startsWith("anonymous-") ? "Anonymous review" : app.student.email}</span><span className="sr-only"> · Open applicant</span></button></TableCell>
      <TableCell className="text-xs">{rounds.find(r => r.id === app.roundId)?.name || "Not available"}</TableCell>
      <TableCell className="max-w-44 whitespace-normal text-xs text-muted-foreground"><ApplicantInterview app={app} /></TableCell>
      <TableCell><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge></TableCell>
      <TableCell className="text-xs text-muted-foreground"><Review app={app} average={average} /></TableCell>
    </TableRow>)}</TableBody></Table></div>
    <ul className="divide-y border-y xl:hidden">{applicants.map(app => <li key={app.id}><button data-applicant-id={app.id} onClick={() => open(app)} className="w-full space-y-3 rounded py-5 text-left focus-visible:outline-2 focus-visible:outline-ring"><span className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{name(app)}</span><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge></span><span className="block text-xs text-muted-foreground">{rounds.find(r => r.id === app.roundId)?.name || "Round unavailable"} · <Review app={app} average={average} /></span><span className="block text-xs text-muted-foreground"><ApplicantInterview app={app} /></span><span className="block text-xs">Open applicant →</span></button></li>)}</ul>
  </>
}
export function LiveApplicantKanban({ applicants, rounds, open, name, average }: Props) {
  return <div className="oc-applicant-board grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">{applicantLanes.map(lane => {
    const cards = applicants.filter(app => applicantLane(app.status) === lane.id)
    return <section key={lane.id} aria-label={`${lane.title} applicants`} className="min-w-0 rounded-lg border bg-muted/30 p-3"><header className="mb-4"><h3 className="oc-card-heading flex items-center justify-between">{lane.title}<span className="text-xs font-normal text-muted-foreground">{cards.length}</span></h3><p className="mt-1 text-xs text-muted-foreground">{lane.description}</p></header>
      <ul className="space-y-3">{cards.map(app => <li key={app.id}><button data-applicant-id={app.id} onClick={() => open(app)} className="w-full space-y-3 rounded-md border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><span className="block break-words text-sm font-semibold">{name(app)}</span><span className="block text-xs text-muted-foreground">{app.studentId.startsWith("anonymous-") ? "Anonymous review · " : ""}{rounds.find(r => r.id === app.roundId)?.name || "Round unavailable"}</span><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge><span className="block text-xs text-muted-foreground"><Review app={app} average={average} /></span><span className="block text-xs text-muted-foreground"><ApplicantInterview app={app} /></span><span className="block border-t pt-3 text-xs">Review & actions →</span></button></li>)}</ul>
      {!cards.length && <p className="py-6 text-xs text-muted-foreground">No applicants in this lane with the current filters.</p>}
    </section>
  })}</div>
}

export function LiveDecisionList({ applicants, rounds, open, name, average }: Props) {
  return <ul className="divide-y border-y">{applicants.map(app => <li key={app.id}>
    <button type="button" data-applicant-id={app.id} onClick={() => open(app)} className="grid min-h-20 w-full gap-3 rounded py-5 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-3">
      <span className="min-w-0"><span className="block break-words font-medium">{name(app)}</span><span className="mt-1 block text-xs text-muted-foreground">{app.studentId.startsWith("anonymous-") ? "Anonymous review" : app.student.email}</span></span>
      <span className="space-y-1 text-xs text-muted-foreground"><span className="block">{rounds.find(r => r.id === app.roundId)?.name || "Round unavailable"}</span><span className="block"><Review app={app} average={average} /></span></span>
      <span className="flex items-center justify-between gap-4 sm:justify-end"><Badge data-application-status={app.status} variant="secondary">{applicationStatusLabels[app.status]}</Badge><span className="text-xs">Review decision →</span></span>
    </button>
  </li>)}</ul>
}
