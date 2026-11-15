"use client"
import { flushEditors } from "@/lib/autosave-navigation"
import { ApplicationManagementCard } from "@/components/applications/application-management-card"
import { ApplicationStatusCard } from "@/components/applications/application-status-card"
import { ApplicationStatusDetail } from "@/components/applications/application-status-detail"
import { useSearchParams } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { MetricStrip } from "@/components/product/metric-strip"
import { UnderlineTabs } from "@/components/ui/underline-tabs"
import { EmptyState } from "@/components/ui/empty-state"
import { applicationAttachmentUrl } from "@/lib/student-applications"

import { useCallback, useEffect, useRef, useState } from "react"
import { useServerAnchoredNow } from "@/hooks/use-server-now"
import { ArrowLeft, ArrowRight, FilePenLine } from "@/components/icons"
import { useRevalidate } from "@/hooks/use-revalidate"
import { getStudentApplications } from "@/lib/workspace-api"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { useApplicationState } from "@/lib/application-state"
import { compareApplicationStatus } from "@/lib/application-presentation"
import { applicationStage, applicationStages, initialApplicationStage, isApplicationStage, stageCounts } from "@/lib/application-stages"
import { pluralize } from "@/lib/copy/terms"
import "@/components/applications/application-tracker.css"
import type { ViewId } from "@/lib/views"
import type { TrackerStatus } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/ui/status-pill"
import { recruitmentDate } from "@/lib/recruitment-presentation"
import { LoadingState } from "@/components/ui/loading-state"
import { ClubLogo } from "@/components/club-logo"
import {
  ApplicationForm,
  type StudentApplication,
} from "@/components/applications/application-form"
import { DEFAULT_CLUB_COLOR } from "@/lib/club-colors"

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
export function ApplicationTrackerView({ onNavigate, scope = "all", serverNow }: { onNavigate?: (view: ViewId) => void; scope?: "all" | "status"; serverNow?: number }) {
  const statusView = scope === "status"
  const applicationId = useSearchParams().get("applicationId")
  const now = useServerAnchoredNow(serverNow)
  const demo = useDemoMode()
  useEffect(() => { setActiveId(null); setStatusId(null); setFilter("All"); setDirty(false) }, [scope])
  const demoDeadline = (clubId: string) => demo.isDemoEnabled ? demo.state?.clubs.find(c => c.id === clubId)?.deadline : undefined
  const { user, loading, refreshUser } = useAuth()
  const { focusApplicationClubId, clearApplicationFocus, syncApplications, focusApplication, syncApplicationBookings } = useApplicationState()
  const [applications, setApplications] = useState<StudentApplication[]>([])
  const [pending, setPending] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  // A stage card ("Review offer", "Review interview", "View details") opens that application's status, where
  // booking and offer responses live; every other way of opening an application keeps its existing view.
  const [statusId, setStatusId] = useState<string | null>(null)
  const [, setDirty] = useState(false)
  const [working, setWorking] = useState(false)
  const [filter, setFilter] = useState("")
  const requestedTab = useSearchParams().get("tab")
  const [notice, setNotice] = useState("")
  const content = useRef<HTMLDivElement>(null)
  const lastOpened = useRef<string | null>(null)
  // statusId: switching between an application's status and its answers keeps activeId, so focus follows the new heading.
  useEffect(() => {
    if (activeId) content.current?.querySelector<HTMLElement>("h1")?.focus()
    else if (lastOpened.current) content.current?.querySelector<HTMLButtonElement>(`[data-application-id="${CSS.escape(lastOpened.current)}"]`)?.focus({ preventScroll: true })
  }, [activeId, statusId, pending])

  const sync = useCallback(
    (apps: StudentApplication[]) => {
      syncApplications(
        apps.map((app) => ({
          id: app.id,
          clubId: app.clubId,
          clubName: app.club.name,
          logoText: app.club.name.slice(0, 2),
          logoUrl: app.club.logoUrl,
          marketing: app.club.marketing,
          color: app.club.color || DEFAULT_CLUB_COLOR,
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
  // No Refresh button: reload quietly (keeping the current view) when the person returns or after a change elsewhere.
  // Conditions are re-checked when the response lands (refs), not only when the read starts:
  // a save in flight drops it, and an open draft always keeps its own object and revision.
  const latest = useRef({ applications, activeId, working }); latest.current = { applications, activeId, working }
  const revalidateTicket = useRef(0)
  const [syncNote, setSyncNote] = useState("")
  const revalidate = useCallback(async (explicit = false) => {
    const ticket = ++revalidateTicket.current
    try {
      const apps = await getStudentApplications()
      const now = latest.current
      if (ticket !== revalidateTicket.current || now.working) return
      const draft = now.applications.find(item => item.id === now.activeId && item.status === "DRAFTING")
      const next = draft ? apps.map(item => item.id === draft.id ? draft : item) : apps
      setApplications(next)
      sync(next)
      setSyncNote("")
    } catch {
      if (ticket !== revalidateTicket.current) return
      setSyncNote("Couldn’t update your applications. Showing what was last loaded.")
      if (explicit) setNotice("Couldn’t refresh just now. Please try again in a moment.")
    }
  }, [sync])
  useRevalidate(revalidate, { enabled: !!user && !pending && !error && !working && app?.status !== "DRAFTING", scopes: ["applications"] })
  function leave(action: () => void) {
    if (working) return
    void flushEditors().then(() => { setDirty(false); action() }).catch(() => {})
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
    if (submitted) {
      setWorking(false); setDirty(false)
      setNotice("Your application was submitted successfully.")
      void refreshUser()
    }
  }
  if (pending || loading)
    return (
      <LoadingState label="Preparing your applications…" layout="applications" rows={3} />
    )
  if (!user)
    return (
      <div className="max-w-xl space-y-4 py-10">
        <h2 className="oc-section-heading ">Sign in to manage your applications</h2>
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
    void getStudentApplications().then(apps => { setApplications(apps); sync(apps) }).catch(() => setNotice("Interview saved. Your application will update shortly."))
  }
  if (app && (statusView || statusId === app.id)) return <div ref={content} className="oc-application-detail max-w-[var(--oc-reading-width)] space-y-5 pb-6"><ApplicationStatusDetail application={app} notice={notice} onBack={() => { setActiveId(null); setStatusId(null); setNotice("") }} onResponses={() => statusView ? openRelated("tracker") : setStatusId(null)} onCalendar={() => onNavigate?.("calendar")} onRefresh={() => void revalidate(true)} onBookingChanged={bookingChanged} onMyClubs={() => onNavigate?.("my-clubs")} /></div>
  if (app)
    return (
      <div ref={content} className={`oc-application-detail pb-8 ${app.status === "DRAFTING" ? "oc-writing-workspace" : "max-w-[var(--oc-reading-width)] space-y-7"}`}>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          disabled={working}
          onClick={() =>
            leave(() => {
              setActiveId(null)
              setStatusId(null)
              setNotice("")
            })
          }
        >
          <ArrowLeft className="size-4" />
          Applications
        </Button>
        <header className="oc-writing-identity flex items-start gap-3">
          <ClubLogo
            clubId={app.clubId}
            logoUrl={app.club.logoUrl} marketing={app.club.marketing}
            color={app.club.color || DEFAULT_CLUB_COLOR}
            text={app.club.name.slice(0, 2)}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Your application
            </p>
            <PageHeader title={app.club.name} focusable />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusPill status={app.status} />
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-y py-4"><p className="text-sm text-muted-foreground">Your responses are saved and read-only after submission.</p><Button variant="outline" onClick={() => openRelated("status")}>View status<ArrowRight size={16} /></Button></div>
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
              <Button variant="ghost" onClick={() => onNavigate?.("explore")}>
                Explore clubs
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    )
  // One page, four stages: the same tabs and counts as the Home "Your applications" card.
  const counts = stageCounts(applications.map(item => item.status))
  // The old Status view (scope "status") opens on the first submitted stage with applications.
  const stage = isApplicationStage(filter) ? filter : initialApplicationStage(requestedTab, counts, { submittedOnly: scope === "status" })
  const choose = (next: string) => {
    setFilter(next)
    if (typeof window === "undefined" || !window.location?.href || !window.history) return
    const url = new URL(window.location.href); url.searchParams.set("tab", next); window.history.replaceState(window.history.state, "", url)
  }
  const visible = applications.filter(item => applicationStage(item.status) === stage)
    .sort((a, b) => stage === "drafts" ? a.club.name.localeCompare(b.club.name) : compareApplicationStatus(a, b, now) || a.club.name.localeCompare(b.club.name))
  function open(item: StudentApplication) { lastOpened.current = item.id; setActiveId(item.id); setNotice("") }
  return (
    <div ref={content} className="oc-applications max-w-[var(--oc-content-width)] space-y-5" data-application-scope={scope}>
      <PageHeader density="expressive" title="Applications" description="Your drafts, applications in review, interviews and decisions." />
      {!applications.length ? (
        <EmptyState icon={<FilePenLine />} title="No applications yet." description="Explore clubs and start an application. Your drafts and submissions appear here." action={<Button onClick={() => onNavigate?.("explore")}>Explore clubs</Button>} />
      ) : (
        <>
          <UnderlineTabs label="Application stage" value={stage} onChange={choose} items={applicationStages.map(item => ({ id: item.id, label: item.label, count: counts[item.id] }))} />
          {stage !== "drafts" && <p className="text-xs text-muted-foreground">Current rounds are recorded by each club. Later rounds are shown as context, not confirmed invitations.</p>}
          <p role="status" className="sr-only">{pluralize(visible.length, "application")} shown</p>
          {syncNote && <p role="status" className="text-xs text-muted-foreground">{syncNote}</p>}
          <ul className={stage === "drafts" ? "oc-application-management-list" : "oc-status-list"}>
            {visible.map(item => <li key={item.id}>{stage === "drafts" ? <ApplicationManagementCard application={item} deadline={demoDeadline(item.clubId)} sample={demo.isDemoEnabled} onOpen={() => open(item)} /> : <ApplicationStatusCard application={item} now={now} onOpen={() => { open(item); setStatusId(item.id) }} />}</li>)}
          </ul>
          {!visible.length && <EmptyState role="status" density="compact" tone="outlined" title={`No applications in ${applicationStages.find(item => item.id === stage)!.label}.`} description={stage === "drafts" ? "You have no drafts in progress." : "None of your applications are at this stage right now."} />}
        </>
      )}
    </div>
  )
}
