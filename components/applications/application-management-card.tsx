"use client"
import { ArrowRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import { Progress } from "@/components/ui/progress"
import { applicationResponseProgress } from "@/lib/student-applications"
import { recruitmentDeadline, recruitmentDate } from "@/lib/recruitment-presentation"
import { ClubLogo } from "@/components/club-logo"
import type { StudentApplication } from "./application-form"
import { applicantDate } from "./application-status-card"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"

export function ApplicationManagementCard({ application: app, deadline, sample = false, onOpen }: { application: StudentApplication; deadline?: Date | string; sample?: boolean; onOpen: () => void }) {
  const draft = app.status === "DRAFTING"
  const progress = applicationResponseProgress(app.club.questions, app.answers)
  const due = recruitmentDeadline(deadline || app.club.applicationDeadline)
  const closed = app.club.applicationOpen === false || !!due && +due <= Date.now()
  return <article className="oc-application-management-row">
    <ClubLogo clubId={app.clubId} logoUrl={app.club.logoUrl} marketing={app.club.marketing} text={app.club.name.slice(0, 2)} color={app.club.color || DEFAULT_CLUB_COLOR} />
    <div className="min-w-0 flex-1"><h2>{app.club.name}</h2><p>{draft ? progress.total ? `${progress.completed} of ${progress.total} required responses ready` : "No required club questions" : app.submittedAt ? `Submitted ${applicantDate(app.submittedAt)}` : "Submitted application"}</p>
      {draft && <><p>{due ? `${sample ? "Sample deadline" : "Deadline"} · ${recruitmentDate(due)}` : "Deadline not published"}{closed && <strong className="font-medium"> · Applications closed</strong>}</p><Progress value={progress.percent} className="oc-draft-progress" aria-label={`Required responses ready for ${app.club.name}`} /><p>{closed ? "Applications are closed, so this draft can’t be submitted. You can still view or save it." : progress.ready ? "Required responses ready. Review your profile before submitting." : "Your draft is saved; nothing has been submitted."}</p></>}</div>
    <StatusPill status={app.status} className="oc-management-state" />
    {/* A closed club cannot take a submission, so continuing is not the primary action. */}
    <Button variant={draft && !closed ? "default" : "outline"} data-application-id={app.id} onClick={onOpen}>{draft ? closed ? "View draft" : "Continue draft" : "View responses"}<ArrowRight size={16} aria-hidden="true" /></Button>
  </article>
}
