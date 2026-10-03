"use client"
import { ArrowRight, CalendarDays } from "lucide-react"
import { ClubLogo } from "@/components/club-logo"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { applicationStatusLabels, applicationNextStep } from "@/lib/student-applications"
import { applicationStatusProgress, currentApplicationInterview, applicationNeedsAttention, isApplicationDecision } from "@/lib/application-presentation"
import type { StudentApplication } from "./application-form"

export const applicantDate = (value: Date | string) => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
export function ApplicationStatusProgress({ application }: { application: StudentApplication }) {
  const { stages, current } = applicationStatusProgress(application)
  return <ol className="oc-status-stages" aria-label={`Recruitment stages for ${application.club.name}`}>
    {stages.map(stage => <li key={stage.id} aria-current={stage.id === current ? "step" : undefined}><span aria-hidden="true" />{stage.name}</li>)}
  </ol>
}
export function ApplicationStatusCard({ application: app, now, onOpen }: { application: StudentApplication; now: number; onOpen: () => void }) {
  const interview = currentApplicationInterview(app, now)
  const attention = applicationNeedsAttention(app, now)
  const decision = isApplicationDecision(app.status)
  return <article className="oc-status-card" data-status={app.status} data-attention={attention}>
    <div className="oc-status-card-heading">
      <ClubLogo clubId={app.clubId} logoUrl={app.club.logoUrl} color={app.club.color || "#142d45"} text={app.club.name.split(/\s+/).map(word => word[0]).slice(0, 2).join("")} />
      <div><h2>{app.club.name}</h2><p>{decision ? "Decision received" : attention ? "Review interview options" : app.round?.name || applicationStatusLabels[app.status]}</p></div>
      <StatusBadge status={app.status} />
    </div>
    <ApplicationStatusProgress application={app} />
    <div className="oc-status-next">
      <div>{!decision && interview && !interview.past ? <><p className="oc-status-interview"><CalendarDays size={16} aria-hidden="true" />Interview · {applicantDate(interview.booking.slot.startTime)}</p><p>{interview.booking.slot.location || "Location not provided"}</p></>
        : <><p className="oc-status-next-label">{applicationStatusLabels[app.status]}</p><p>{attention ? "No booking recorded for this round. Check available times and the club’s instructions." : !decision && interview?.past ? `Recorded interview · ${applicantDate(interview.booking.slot.startTime)}. Check the club’s instructions for next steps.` : applicationNextStep(app.status)}</p></>}</div>
      <Button variant={attention ? "default" : "outline"} data-application-id={app.id} onClick={onOpen}>{attention ? "Review interview" : "View details"}<ArrowRight size={15} aria-hidden="true" /></Button>
    </div>
  </article>
}
