"use client"
import { ApplicationManagementCard } from "@/components/applications/application-management-card"
import { ApplicationStatusCard } from "@/components/applications/application-status-card"
import { ApplicationStatusDetail } from "@/components/applications/application-status-detail"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/product/page-header"
import { MetricStrip } from "@/components/product/metric-strip"
import { SegmentedControl } from "@/components/product/segmented-control"
import { EmptyState } from "@/components/ui/empty-state"
import { applicationAttachmentUrl } from "@/lib/student-applications"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, RefreshCw, FilePenLine } from "lucide-react"
import { getStudentApplications } from "@/lib/workspace-api"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"
import { applicationMatchesStatusFilter, compareApplicationStatus, type StatusFilter } from "@/lib/application-presentation"
import "@/components/applications/application-tracker.css"
import type { ViewId } from "@/lib/views"
import type { TrackerStatus } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import { recruitmentDate } from "@/lib/recruitment-presentation"
import { Skeleton } from "@/components/ui/skeleton"
import { ClubLogo } from "@/components/club-logo"
import {
  ApplicationForm,
  type StudentApplication,
} from "@/components/applications/application-form"

const trackerLabels: Record<string, TrackerStatus> = {
  DRAFTING: "Drafting",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  INTERVIEWING: "Interviewing",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WAITLISTED: "Waitlisted",
}
const date = (value: Date | string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
export function ApplicationTrackerView({ onNavigate, scope = "all" }: { onNavigate?: (view: ViewId) => void; scope?: "all" | "status" }) {
  const statusView = scope === "status"
  const applicationId = useSearchParams().get("applicationId")
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  const demo = useDemoMode()
  useEffect(() => { setActiveId(null); setFilter("All"); setDirty(false) }, [scope])
  const demoDeadline = (clubId: string) => demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId)?.deadline : undefined
  const { user, loading, refreshUser } = useAuth()
  const { focusApplicationClubId, clearApplicationFocus, syncApplications, focusApplication, syncApplicationBookings } = useApplicationState()
  const [applications, setApplications] = useState<StudentApplication[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [working, setWorking] = useState(false)
  const [filter, setFilter] = useState("All")
  const [notice, setNotice] = useState("")
  const content = useRef<HTMLDivElement>(null)
  const lastOpened = useRef<string | null>(null)
  useEffect(() => {
    if (activeId) content.current?.querySelector<HTMLElement>("h1")?.focus()
    else if (lastOpened.current) content.current?.querySelector<HTMLButtonElement>(`[data-application-id="${CSS.escape(lastOpened.current)}"]`)?.focus({ preventScroll: true })
  }, [activeId, pending])

  const sync = useCallback(
    (apps: StudentApplication[]) => {
      syncApplications(
        apps.map((app) => ({
          id: app.id,
          clubId: app.clubId,
          clubName: app.club.name,
          logoText: app.club.name.slice(0, 2),
          logoUrl: app.club.logoUrl,
          color: app.club.color || "#142d4e",
          status: trackerLabels[app.status],
          questionsCompleted: app.answers.filter((answer) => answer.response.trim()).length,
          questionsTotal: app.club.questions.length,
          nextDeadline: app.status === "DRAFTING" ? "Finish draft" : "",
          dueInHours: 0,
        })),
      )
      syncApplicationBookings(apps)
    },
    [syncApplications, syncApplicationBookings],
  )
  useEffect(() => {
    let active = true
    if (loading) return
    if (!user) {
      setPending(false)
      setApplications([])
      return
    }
    setPending(true)
    setError(false)
    getStudentApplications()
      .then((apps) => {
        if (active) {
          setApplications(apps)
          sync(apps)
        }
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setPending(false)
      })
    return () => {
      active = false
    }
  }, [user?.id, loading, retry, sync])
  useEffect(() => {
    if (pending || !focusApplicationClubId && !applicationId) return
    const app = applications.find((item) => applicationId ? item.id === applicationId : item.clubId === focusApplicationClubId)
    if (app && (scope === "all" || app.status !== "DRAFTING")) { setActiveId(app.id); lastOpened.current = app.id }
    clearApplicationFocus()
  }, [applications, pending, focusApplicationClubId, applicationId, clearApplicationFocus, scope])
  const app = applications.find((item) => item.id === activeId)
  function leave(action: () => void) {
    if (working) return
    if (dirty && !window.confirm("Leave this application? Your unsaved changes will be lost."))
      return
    setDirty(false)
    action()
  }
  function saved(submitted: boolean, answers: StudentApplication["answers"]) {
    const updated = applications.map((item) =>
      item.id === activeId
        ? {
            ...item,
            answers,
            status: submitted ? ("SUBMITTED" as const) : item.status,
            submittedAt: submitted ? new Date() : item.submittedAt,
          }
        : item,
    )
    setApplications(updated)
    sync(updated)
    setWorking(false)
    setDirty(false)
    setNotice(submitted ? "Your application was submitted successfully." : "Your draft is saved.")
    void refreshUser()
  }
  if (pending || loading)
    return (
      <div aria-busy="true" className="space-y-5">
        <p role="status" className="text-sm text-muted-foreground">
          Loading your applications…
        </p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  if (!user)
    return (
      <div className="max-w-xl space-y-4 py-10">
        <h2 className="oc-section-heading ">A little clarity for every next step.</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sign in to view your applications and save responses to your account. Preview activity
          does not submit an application to a club.
        </p>
        <Button onClick={() => onNavigate?.("auth")}>Go to sign in</Button>
      </div>
    )
  if (error)
    return (
      <div className="space-y-4 py-8" role="alert">
        <h2 className="oc-section-heading ">Your applications couldn’t load</h2>
        <p className="text-sm text-muted-foreground">
          Your saved responses haven’t changed. Please try again.
        </p>
        <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </Button>
      </div>
    )
  function openRelated(view: "tracker" | "status") {
    if (app) focusApplication(app.clubId)
    leave(() => onNavigate?.(view))
  }
  function bookingChanged() {
    void getStudentApplications().then(apps => { setApplications(apps); sync(apps) }).catch(() => setNotice("Booking saved. Refresh status to update the application summary."))
  }
  if (app && statusView) return <div ref={content} className="oc-application-detail mx-auto max-w-3xl space-y-5 pb-6"><ApplicationStatusDetail application={app} notice={notice} onBack={() => { setActiveId(null); setNotice("") }} onResponses={() => openRelated("tracker")} onCalendar={() => onNavigate?.("calendar")} onRefresh={() => setRetry(value => value + 1)} onBookingChanged={bookingChanged} /></div>
  if (app)
    return (
      <div ref={content} className="oc-application-detail mx-auto max-w-3xl space-y-7 pb-8">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          disabled={working}
          onClick={() =>
            leave(() => {
              setActiveId(null)
              setNotice("")
            })
          }
        >
          <ArrowLeft className="size-4" />
          Applications
        </Button>
        <header className="flex items-start gap-4">
          <ClubLogo
            clubId={app.clubId}
            logoUrl={app.club.logoUrl}
            color={app.club.color || "#142d4e"}
            text={app.club.name.slice(0, 2)}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Your application
            </p>
            <h1 tabIndex={-1} className="oc-page-title break-words outline-none">{app.club.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={app.status} />
              <p className="text-xs text-muted-foreground">
                {app.submittedAt
                  ? `Submitted ${date(app.submittedAt)}`
                  : app.club.applicationDeadline || demoDeadline(app.clubId) ? `${demo.isDemoEnabled ? "Sample deadline" : "Deadline"} ${recruitmentDate((app.club.applicationDeadline || demoDeadline(app.clubId))!)}` : "Deadline not published"}
              </p>
            </div>
          </div>
        </header>
        <p role="status" className={notice ? "text-sm text-muted-foreground" : "sr-only"}>
          {notice}
        </p>
        {app.status === "DRAFTING" ? (
          <ApplicationForm
            key={app.id}
            application={app}
            onSaved={saved}
            onDirty={setDirty}
            onBusy={setWorking}
            onProfile={() => leave(() => onNavigate?.("student-profile"))}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4"><p className="text-sm text-muted-foreground">Your responses are saved and read-only after submission.</p><Button variant="outline" onClick={() => openRelated("status")}>View status<ArrowRight size={15} /></Button></div>
            <section className="space-y-6" aria-label="Submitted responses">
              <div>
                <h2 className="oc-section-heading ">Your submitted responses</h2>
                <p className="mt-2 text-xs text-muted-foreground">Read-only after submission.</p>
              </div>
              {app.club.questions.map((question, index) => {
                const response = app.answers.find(
                  (answer) => answer.questionId === question.id,
                )?.response
                return (
                  <div key={question.id} className="border-t border-border pt-5">
                    <p className="mb-2 text-xs text-muted-foreground">Question {index + 1}</p>
                    <h3 className="oc-card-heading whitespace-pre-wrap">
                      {question.prompt}
                    </h3>
                    {question.type === "FILE_UPLOAD" &&
                    response &&
                    applicationAttachmentUrl(response, app.id, question.id) ? (
                      <a
                        href={applicationAttachmentUrl(response, app.id, question.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm underline underline-offset-4"
                      >
                        Open submitted document<span className="sr-only"> (new tab)</span>
                      </a>
                    ) : (
                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                        {response || "No response provided."}
                      </p>
                    )}
                  </div>
                )
              })}
              {!app.club.questions.length && (
                <p className="text-sm text-muted-foreground">No club-specific questions.</p>
              )}
            </section>
            <div className="flex flex-wrap gap-3 border-t border-border pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveId(null)
                  setRetry((value) => value + 1)
                }}
              >
                <RefreshCw className="size-4" />
                Refresh application
              </Button>
              <Button variant="ghost" onClick={() => onNavigate?.("explore")}>
                Explore clubs
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    )
  const statusFilters: StatusFilter[] = ["All", "Needs attention", "Upcoming interviews", "In progress", "Decisions"]
  const submitted = applications.filter(item => item.status !== "DRAFTING")
  const visible = statusView ? submitted.filter(item => applicationMatchesStatusFilter(item, filter as StatusFilter, now)).sort((a, b) => compareApplicationStatus(a, b, now) || a.club.name.localeCompare(b.club.name))
    : applications.filter(item => filter === "All" || (filter === "Drafts" ? item.status === "DRAFTING" : item.status !== "DRAFTING")).sort((a, b) => Number(b.status === "DRAFTING") - Number(a.status === "DRAFTING") || a.club.name.localeCompare(b.club.name))
  function open(item: StudentApplication) { lastOpened.current = item.id; setActiveId(item.id); setNotice("") }
  return (
    <div ref={content} className="oc-applications mx-auto max-w-5xl space-y-5" data-application-scope={scope}>
      <PageHeader eyebrow="Your campus" title={statusView ? "Status" : "Applications"} description={statusView ? "Where things stand, and what to do next." : "Work on your drafts, check requirements, and review submitted responses."} action={<Button variant="ghost" size="sm" onClick={() => setRetry(value => value + 1)}><RefreshCw className="size-3.5" />Refresh</Button>} />
      {applications.length > 0 && !statusView && <MetricStrip label="Application management" items={[
        { label: "drafts", value: applications.filter(item => item.status === "DRAFTING").length },
        { label: "submitted", value: submitted.length },
      ]} />}
      {!applications.length || statusView && !submitted.length ? (
        <EmptyState icon={<FilePenLine />} title={statusView ? "Your next step starts with an application." : "Your next chapter is waiting."} description={statusView ? "Submitted applications will appear here with their review progress, interview details, and decisions." : "Explore clubs and start an application. Manage your drafts and submissions here."} action={<Button onClick={() => onNavigate?.(statusView && applications.length ? "tracker" : "explore")}>{statusView && applications.length ? "Continue applications" : "Discover clubs"}<ArrowRight className="size-4" /></Button>} />
      ) : (
        <>
          <SegmentedControl label={statusView ? "Filter application status" : "Filter applications"} value={filter} onChange={setFilter} options={statusView ? statusFilters.map(value => ({ value, label: `${value} (${submitted.filter(item => applicationMatchesStatusFilter(item, value, now)).length})` })) : ["All", "Drafts", "Submitted"].map(label => ({ label, value: label }))} />
          {statusView && <p className="text-xs text-muted-foreground">Current rounds are recorded by each club. Later rounds are shown as context, not confirmed invitations.</p>}
          <p role="status" className="sr-only">{visible.length} {visible.length === 1 ? "application" : "applications"} shown</p>
          <ul className={statusView ? "oc-status-list" : "oc-application-management-list"}>
            {visible.map(item => <li key={item.id}>{statusView ? <ApplicationStatusCard application={item} now={now} onOpen={() => open(item)} /> : <ApplicationManagementCard application={item} deadline={demoDeadline(item.clubId)} sample={demo.isDemoEnabled} onOpen={() => open(item)} />}</li>)}
          </ul>
          {!visible.length && <p role="status" className="py-6 text-sm text-muted-foreground">No applications match this filter.</p>}
        </>
      )}
    </div>
  )
}
