"use client"
import { RecruitmentOffer } from "./recruitment-offer"
import { ArrowLeft, ArrowRight, CalendarDays, RefreshCw } from "lucide-react"
import { ApplicantBooking } from "@/components/interviews/applicant-booking"
import { ClubLogo } from "@/components/club-logo"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { applicationStatusLabels, applicationNextStep } from "@/lib/student-applications"
import { isApplicationDecision } from "@/lib/application-presentation"
import { ApplicationStatusProgress, applicantDate } from "./application-status-card"
import type { StudentApplication } from "./application-form"

export function ApplicationStatusDetail({ application: app, notice, onBack, onResponses, onCalendar, onRefresh, onBookingChanged, onMyClubs }: {
  application: StudentApplication; notice: string; onBack: () => void; onResponses: () => void; onCalendar: () => void; onRefresh: () => void; onBookingChanged: () => void; onMyClubs: () => void;
}) {
  const decision = isApplicationDecision(app.status)
  const history = app.status === "INTERVIEWING" ? app.bookings.filter(booking => booking.roundId && booking.roundId !== app.round?.id) : app.bookings
  return <>
    <Button variant="ghost" size="sm" className="-ml-3" onClick={onBack}><ArrowLeft size={16} />Status</Button>
    <header className="flex items-start gap-4">
      <ClubLogo clubId={app.clubId} logoUrl={app.club.logoUrl} text={app.club.name.slice(0, 2)} color={app.club.color || "#142d45"} />
      <div className="min-w-0"><p className="oc-eyebrow">{decision ? "Decision received" : "Application progress"}</p><h1 tabIndex={-1} className="oc-page-title break-words outline-none">{app.club.name}</h1>
        {app.submittedAt && <p className="mt-2 text-xs text-muted-foreground">Submitted {applicantDate(app.submittedAt)}</p>}</div>
    </header>
    <p role="status" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>{notice}</p>
    <section className="oc-status-detail-update" data-status={app.status} aria-label="Current application status">
      <div className="flex flex-wrap items-center gap-3"><h2 className="oc-section-heading">{applicationStatusLabels[app.status]}</h2><StatusBadge status={app.status} /></div>
      {!decision && app.round?.name && <p className="mt-2 text-sm text-muted-foreground">Current club round · {app.round.name}</p>}
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{applicationNextStep(app.status)}</p>
      {(app.status === "ACCEPTED" || app.recruitmentOffer) && <RecruitmentOffer application={app} onChanged={onRefresh} onMyClubs={onMyClubs} />}
      {app.status === "WAITLISTED" && <p className="mt-2 text-sm text-muted-foreground">No decision date has been provided on OutClass.</p>}
      <div className="mt-5"><ApplicationStatusProgress application={app} /></div>
    </section>
    {app.status === "INTERVIEWING" && <section aria-label="Interview scheduling"><h2 className="oc-section-heading">Your interview</h2><p className="mt-2 text-sm text-muted-foreground">Review the club’s instructions and available times. Manage your recorded booking here.</p><ApplicantBooking key={app.id} applicationId={app.id} onChanged={onBookingChanged} /></section>}
    {history.length > 0 && <details className="rounded-lg border px-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Recorded interviews · {history.length}</summary><ul className="divide-y pb-3">{history.map(booking => <li key={booking.id} className="flex gap-3 py-3 text-sm"><CalendarDays size={16} className="mt-1 shrink-0" aria-hidden="true" /><div><p>{applicantDate(booking.slot.startTime)}</p><p className="mt-1 text-xs text-muted-foreground">Ends {applicantDate(booking.slot.endTime)} · {booking.slot.location || "Location not provided"}</p></div></li>)}</ul></details>}
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button variant="outline" onClick={onResponses}>View submitted responses<ArrowRight size={15} /></Button>
      <Button variant="ghost" onClick={onCalendar}><CalendarDays size={15} />Open calendar</Button>
      <Button variant="ghost" onClick={onRefresh}><RefreshCw size={15} />Refresh status</Button>
    </div>
  </>
}
