"use client"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { Progress } from "@/components/ui/progress"
import { applicationResponseProgress } from "@/lib/student-applications"
import { recruitmentDeadline, recruitmentDate } from "@/lib/recruitment-presentation"
import { ClubLogo } from "@/components/club-logo"
import type { StudentApplication } from "./application-form"
import { applicantDate } from "./application-status-card"

export function ApplicationManagementCard({ application: app, deadline, sample = false, onOpen }: { application: StudentApplication; deadline?: Date | string; sample?: boolean; onOpen: () => void }) {
  const draft = app.status === "DRAFTING"
  const progress = applicationResponseProgress(app.club.questions, app.answers)
  const due = recruitmentDeadline(deadline || app.club.applicationDeadline)
  const closed = app.club.applicationOpen === false || !!due && +due <= Date.now()
  return <article className="oc-application-management-row">
    <ClubLogo clubId={app.clubId} logoUrl={app.club.logoUrl} text={app.club.name.slice(0, 2)} color={app.club.color || "#142d45"} />
    <div className="min-w-0 flex-1"><h2>{app.club.name}</h2><p>{draft ? progress.total ? `${progress.completed} of ${progress.total} required responses ready` : "No required club questions" : app.submittedAt ? `Submitted ${applicantDate(app.submittedAt)}` : "Submitted application"}</p>
      {draft && <><p>{due ? `${sample ? "Sample deadline" : "Deadline"} · ${recruitmentDate(due)}` : "Deadline not published"}{closed && " · Applications closed"}</p><Progress value={progress.percent} className="oc-draft-progress" aria-label={`Required responses ready for ${app.club.name}`} /><p>{closed ? "Your draft can still be saved." : progress.ready ? "Required responses ready. Review your profile before submitting." : "Your draft is saved; nothing has been submitted."}</p></>}</div>
    <StatusBadge status={app.status} className="oc-management-state" />
    <Button variant={draft ? "default" : "outline"} data-application-id={app.id} onClick={onOpen}>{draft ? "Continue draft" : "View responses"}<ArrowRight size={15} aria-hidden="true" /></Button>
  </article>
}
