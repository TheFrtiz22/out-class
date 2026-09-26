"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, CalendarDays, RefreshCw } from "lucide-react"
import { getStudentApplications } from "@/lib/workspace-api"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"
import { applicationInScope, relevantInterview } from "@/lib/application-presentation"
import "@/components/applications/application-tracker.css"
import { applicationNextStep, applicationStatusLabels } from "@/lib/student-applications"
import type { ViewId } from "@/lib/views"
import type { TrackerStatus } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ClubLogo } from "@/components/club-logo"
import { RecruitmentTimeline } from "@/components/clubs/recruitment-timeline"
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
export function ApplicationTrackerView({ onNavigate, scope = "all" }: { onNavigate?: (view: ViewId) => void; scope?: "all" | "interviews" | "decisions" }) {
  const demo = useDemoMode()
  useEffect(() => { setActiveId(null); setFilter("All"); setDirty(false) }, [scope])
  const demoDeadline = (clubId: string) => demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId)?.deadline : undefined
  const { user, loading, refreshUser } = useAuth()
  const { focusApplicationClubId, clearApplicationFocus, syncApplications } = useApplicationState()
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
    },
    [syncApplications],
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
    if (pending || !focusApplicationClubId) return
    const app = applications.find((item) => item.clubId === focusApplicationClubId)
    if (app) setActiveId(app.id)
    clearApplicationFocus()
  }, [applications, pending, focusApplicationClubId, clearApplicationFocus])
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
        <h2 className="font-display text-3xl">A little clarity for every next step.</h2>
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
        <h2 className="text-xl font-semibold">Your applications couldn’t load</h2>
        <p className="text-sm text-muted-foreground">
          Your saved responses haven’t changed. Please try again.
        </p>
        <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </Button>
      </div>
    )
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
          {scope === "all" ? "My Applications" : scope === "interviews" ? "Interviews" : "Decisions"}
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
            <h1 tabIndex={-1} className="break-words font-display text-3xl tracking-tight outline-none">{app.club.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{applicationStatusLabels[app.status]}</Badge>
              <p className="text-xs text-muted-foreground">
                {app.submittedAt
                  ? `Submitted ${date(app.submittedAt)}`
                  : demoDeadline(app.clubId) ? `Sample deadline ${date(demoDeadline(app.clubId)!)}` : "Deadline not provided on OutClass"}
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
            <section
              className={`border-y border-border py-7 ${app.status === "ACCEPTED" ? "border-success/25" : ""}`}
              aria-label="Application update"
            >
              {app.status === "ACCEPTED" && (
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-success">
                  <Check className="size-4" />
                  An invitation to your next chapter
                </p>
              )}
              <h2 className="text-xl font-semibold">
                {app.status === "ACCEPTED"
                  ? `You’ve been accepted to ${app.club.name}.`
                  : app.status === "REJECTED"
                    ? "An update on your application"
                    : app.status === "WAITLISTED"
                      ? "You’re on the waitlist"
                      : app.status === "SUBMITTED"
                        ? "Your application is in."
                        : "Your application is moving forward"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {applicationNextStep(app.status)}
              </p>
              {app.status === "ACCEPTED" && <p className="mt-2 text-sm leading-7 text-muted-foreground">Acceptance does not automatically add you as a club member. Follow the club’s instructions for joining.</p>}
              {app.status === "INTERVIEWING" && !app.bookings.length && <p className="mt-2 text-sm leading-7 text-muted-foreground">No interview booking is recorded on OutClass yet. Check the club’s instructions for scheduling.</p>}
              {app.status === "REJECTED" && (
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Thank you for the time and care you put into applying. You can continue exploring
                  other communities at UVA.
                </p>
              )}
              {app.status === "WAITLISTED" && (
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  No decision date has been provided on OutClass.
                </p>
              )}
              <div className="mt-6">
                <RecruitmentTimeline status={app.status} compact />
              </div>
              {app.round?.name && (
                <p className="mt-4 text-xs text-muted-foreground">Club stage: {app.round.name}</p>
              )}
            </section>
            {app.bookings.length > 0 && (
              <section aria-label="Interview details" className="space-y-4">
                <h2 className="text-base font-semibold">Your interviews</h2>
                <ul className="divide-y divide-border">
                  {app.bookings.map((booking) => (
                    <li key={booking.id} className="flex items-start gap-3 py-4">
                      <CalendarDays className="mt-1 size-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{date(booking.slot.startTime)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ends {date(booking.slot.endTime)} · {booking.slot.location}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" onClick={() => onNavigate?.("calendar")}>
                  Open calendar
                </Button>
              </section>
            )}
            <section className="space-y-6" aria-label="Submitted responses">
              <div>
                <h2 className="text-base font-semibold">Your submitted responses</h2>
                <p className="mt-2 text-xs text-muted-foreground">Read-only after submission.</p>
              </div>
              {app.club.questions.map((question, index) => {
                const response = app.answers.find(
                  (answer) => answer.questionId === question.id,
                )?.response
                return (
                  <div key={question.id} className="border-t border-border pt-5">
                    <p className="mb-2 text-xs text-muted-foreground">Question {index + 1}</p>
                    <h3 className="whitespace-pre-wrap text-sm font-medium leading-7">
                      {question.prompt}
                    </h3>
                    {question.type === "FILE_UPLOAD" &&
                    response &&
                    /^https?:\/\//i.test(response) ? (
                      <a
                        href={response}
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
                Refresh status
              </Button>
              <Button variant="ghost" onClick={() => onNavigate?.("discover")}>
                Explore clubs
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    )
  const visible = applications
    .filter(item => applicationInScope(item, scope))
    .filter(
      (item) =>
        filter === "All" ||
        (filter === "Drafts"
          ? item.status === "DRAFTING"
          : filter === "Decisions"
            ? ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(item.status)
            : !["DRAFTING", "ACCEPTED", "REJECTED", "WAITLISTED"].includes(item.status)),
    )
    .sort(
      (a, b) =>
        Number(b.status === "DRAFTING") - Number(a.status === "DRAFTING") ||
        a.club.name.localeCompare(b.club.name),
    )
  return (
    <div ref={content} className="oc-applications mx-auto max-w-5xl space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-3 text-xs tracking-widest uppercase text-muted-foreground">Your next chapter</p>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{scope === "all" ? "My Applications" : scope === "interviews" ? "Interviews" : "Decisions"}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
            {scope === "all" ? "Pick up a draft, follow your progress, or see what comes next." : scope === "interviews" ? "Your interview-stage applications and recorded bookings, in one place." : "Updates from your clubs. Open an application to read the details and next steps."}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setRetry((value) => value + 1)}>
          <RefreshCw className="size-3.5" />Refresh
        </Button>
      </header>
      {!applications.length ? (
        <div className="space-y-4 border-y border-border py-12">
          <h3 className="text-lg font-semibold">No applications yet</h3>
          <p className="max-w-lg text-sm leading-7 text-muted-foreground">
            Your drafts, submissions, and decisions will appear here when you start an application.
          </p>
          <Button onClick={() => onNavigate?.("discover")}>
            Discover clubs
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          {scope === "all" && <div
            role="group"
            aria-label="Filter applications"
            className="flex flex-wrap gap-2 border-b border-border pb-4"
          >
            {["All", "Drafts", "In progress", "Decisions"].map((label) => (
              <Button
                key={label}
                size="sm"
                variant={filter === label ? "secondary" : "ghost"}
                aria-pressed={filter === label}
                onClick={() => setFilter(label)}
              >
                {label}
              </Button>
            ))}
          </div>}
          <p role="status" className="sr-only">{visible.length} {visible.length === 1 ? "application" : "applications"} shown</p>
          <ul className="oc-application-list">
            {visible.map(item => {
              const interview = relevantInterview(item.bookings)
              const nextStep = item.status === "DRAFTING" ? "Continue your draft. Your application has not been submitted."
                : scope === "interviews" && interview ? `${interview.past ? "Last interview" : "Interview"} · ${date(interview.booking.slot.startTime)} · ${interview.booking.slot.location || "Location not provided"}`
                : item.status === "INTERVIEWING" ? interview && !interview.past ? `Interview · ${date(interview.booking.slot.startTime)}` : "No upcoming interview booking recorded. Check the club’s instructions."
                : applicationNextStep(item.status)
              return <li key={item.id}><article className="oc-application-row">
                <div className="oc-application-identity">
                  <ClubLogo clubId={item.clubId} logoUrl={item.club.logoUrl} color={item.club.color || "#142d4e"} text={item.club.name.slice(0, 2)} size="lg" />
                  <div className="min-w-0"><h2><button data-application-id={item.id} onClick={() => { lastOpened.current = item.id; setActiveId(item.id); setNotice("") }}>{item.club.name}<span className="sr-only"> · {item.status === "DRAFTING" ? "Continue draft" : "View application"}</span></button></h2>
                    <p className="oc-application-round">{item.status === "DRAFTING" ? "Draft · not yet applied" : item.round?.name ? `Club round: ${item.round.name}` : "Club round not provided"}</p>
                  </div>
                  <Badge variant="secondary" className="oc-application-status">{applicationStatusLabels[item.status]}</Badge>
                </div>
                <div className="oc-application-progress"><RecruitmentTimeline status={item.status} compact /></div>
                <div className="oc-application-next"><p>{nextStep}</p><span aria-hidden="true">{item.status === "DRAFTING" ? "Continue draft" : "View details"}<ArrowRight size={15} /></span></div>
              </article></li>
            })}
          </ul>
          {!visible.length && (
            <p role="status" className="py-8 text-sm text-muted-foreground">
              {scope === "interviews" ? "No interview-stage applications or bookings yet. Recorded interview information will appear here." : scope === "decisions" ? "No decisions yet. Acceptance, waitlist, and other outcomes will appear here when recorded." : "No applications match this filter."}
            </p>
          )}
        </>
      )}
    </div>
  )
}
