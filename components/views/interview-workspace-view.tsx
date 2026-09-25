"use client"
import { RecruitmentAttendanceSummary } from "@/components/recruitment-attendance-summary"
import { InterviewKitSession } from "@/components/interview-kit-session"
import { InterviewKitEditor } from "@/components/interview-kit-editor"
import { TestScoreDetail } from "@/components/test-score-detail"
import { hasPermission } from "@/lib/permissions"

import { useApplicationState } from "@/lib/application-state"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Pause, Play } from "lucide-react"
import { getClubPipeline } from "@/lib/workspace-api"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { reviewerEvaluation, interviewProgress, elapsedInterviewTime } from "@/lib/interview-mode"
import { safeProfileUrl, resolveResumeUrl } from "@/lib/student-profile"
import { applicationStatusLabels } from "@/lib/student-applications"
import { DemoInterviewGuide } from "@/components/demo-workspace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import "./interview/interview-mode.css"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
const selectStyle =
  "h-10 max-w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
export function InterviewWorkspaceView({ onExit, scoped = false }: { onExit?: () => void; scoped?: boolean }) {
  const { user, loading, activeClubId, selectClub } = useAuth()
  const { leaderFocus } = useApplicationState()
  const memberships = (user?.memberships || []).filter(m => hasPermission(m, "applications.review"))
  const clubId = activeClubId
  const setClubId = selectClub
  useEffect(() => {
    if (leaderFocus?.clubId && (!scoped || leaderFocus.clubId === activeClubId)) setClubId(leaderFocus.clubId)
  }, [leaderFocus?.clubId])
  const membership = memberships.find((item) => item.clubId === clubId) || (!clubId ? memberships[0] : undefined)
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const handleLock = useCallback((value: boolean, pending = false) => {
    setLocked(value)
    setSaving(pending)
  }, [])
  function exit() {
    if (saving) return
    if (!locked || window.confirm("Leave interview mode? Unsaved evaluation changes will be lost."))
      onExit?.()
  }
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled={saving} onClick={exit}>
            <ArrowLeft className="size-4" />
            Recruitment workspace
          </Button>
          <span className="hidden h-5 border-l border-border sm:block" />
          <p className="text-sm font-semibold">Interview mode</p>
        </div>
        {membership && !scoped && (
          <select
            aria-label="Interview club"
            disabled={locked}
            className={selectStyle}
            value={membership.clubId}
            onChange={(event) => setClubId(event.target.value)}
          >
            {memberships.map((item) => (
              <option key={item.clubId} value={item.clubId}>
                {item.club.name}
              </option>
            ))}
          </select>
        )}
      </header>
      <DemoInterviewGuide />
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8">
        {loading ? (
          <p role="status">Loading interview workspace…</p>
        ) : !membership ? (
          <div className="max-w-xl space-y-4 py-16">
            <h1 className="font-display text-3xl">A focused space for a better conversation.</h1>
            <p className="text-sm leading-7 text-muted-foreground">
              {user
                ? "You need club membership to access interview applicants."
                : "Sign in with your club account to load candidates, application context, and saved evaluations. No sample interview is running."}
            </p>
            <Button variant="outline" disabled={saving} onClick={exit}>
              Return to workspace
            </Button>
          </div>
        ) : (
          <InterviewSession key={membership.clubId} membership={membership} onLock={handleLock} />
        )}
      </div>
    </main>
  )
}

function InterviewSession({
  membership,
  onLock,
}: {
  membership: ExtendedMembership
  onLock: (locked: boolean, saving?: boolean) => void
}) {
  const { leaderFocus, clearLeaderFocus } = useApplicationState()
  const [data, setData] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [roundId, setRoundId] = useState("")
  const [activeId, setActiveId] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [running, setRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const started = useRef(0)
  const carried = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const round = data?.rounds.find((item) => item.id === roundId)
  const queue = (data?.applications || [])
    .filter((app) => app.roundId === roundId)
    .sort((a, b) => {
      const label = (app: typeof a) =>
        app.student.studentProfile
          ? `${app.student.studentProfile.lastName} ${app.student.studentProfile.firstName}`
          : app.student.email
      return label(a).localeCompare(label(b)) || a.id.localeCompare(b.id)
    })
  const active = queue.find((app) => app.id === activeId)
  const index = queue.findIndex((app) => app.id === activeId)
  const [kitDirty, setKitDirty] = useState(false)
  const handleKitState = useCallback((changed: boolean, pending: boolean) => { setKitDirty(changed); setBusy(pending) }, [])
  const dirty = kitDirty
  const progress = interviewProgress(queue, membership.id, round?.name || "")
  useEffect(() => {
    onLock(dirty || busy, busy)
    return () => onLock(false)
  }, [dirty, busy, onLock])
  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError(false)
    
    // In demo mode, intercept the real API with the mock demo-store logic
    getClubPipeline(membership.clubId)
      .then((result) => {
        if (current) {
          setData(result)
          const focused = result.applications.find(a => a.id === leaderFocus?.applicantId)
          const first = result.rounds.find(r => r.id === focused?.roundId) ||
            result.rounds.find((item) =>
              result.applications.some(
                (app) => app.roundId === item.id && app.status === "INTERVIEWING",
              ),
            ) || result.rounds[0]
          setRoundId(first?.id || "")
          setLoading(false)
        }
      })
      .catch(() => {
        if (current) setLoadError(true)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [membership.clubId, retry])
  useEffect(() => {
    if (!data) return
    setActiveId("")
    setMessage("")
    setRunning(false)
    setSeconds(0)
    carried.current = 0
  }, [roundId])
  useEffect(() => {
    if (!running) return
    started.current = Date.now()
    const timer = window.setInterval(
      () => setSeconds(carried.current + Math.floor((Date.now() - started.current) / 1000)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [running])
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, busy])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && active && !busy) {
        event.preventDefault()
        form.current?.requestSubmit()
      }
    }
    window.addEventListener("keydown", shortcut)
    return () => window.removeEventListener("keydown", shortcut)
  }, [active?.id, busy])
  useEffect(() => {
    if (leaderFocus?.clubId === membership.clubId && leaderFocus.applicantId && queue.some(a => a.id === leaderFocus.applicantId)) {
      choose(leaderFocus.applicantId, true)
      clearLeaderFocus()
    }
  }, [data, roundId, leaderFocus, membership.clubId, clearLeaderFocus])
  function choose(id: string, discard = false) {
    if (busy || (!discard && dirty && !window.confirm("Discard your unsaved evaluation changes?")))
      return
    setActiveId(id)
    setMessage("")
    setFailed(false)
    setRunning(false)
    setSeconds(0)
    carried.current = 0
    requestAnimationFrame(() => heading.current?.focus())
  }
  if (loading) return <WorkspaceLoading label="Loading authorized candidates…" rows={3} />
  if (loadError || !data)
    return (
      <div role="alert" className="space-y-4 py-12">
        <p>We couldn’t load this club’s interview workspace.</p>
        <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>
          Try again
        </Button>
      </div>
    )
  const profile = active?.student.studentProfile
  const candidateName = profile ? `${profile.firstName} ${profile.lastName}` : active?.student.email
  const savedReview =
    active && reviewerEvaluation(active.evaluations, membership.id, round?.name || "")
  return (
    <div className="space-y-6">
      {hasPermission(membership, "interviews.manage") && <InterviewKitEditor clubId={membership.clubId} rounds={data.rounds} />}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="interview-round">Round</Label>
            <select
              id="interview-round"
              className={`${selectStyle} block`}
              disabled={busy}
              value={roundId}
              onChange={(event) => {
                if (!dirty || window.confirm("Discard your unsaved evaluation changes?"))
                  setRoundId(event.target.value)
              }}
            >
              {data.rounds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interview-candidate">Candidate</Label>
            <select
              id="interview-candidate"
              className={`${selectStyle} block w-full sm:w-64`}
              disabled={busy || !queue.length}
              value={activeId}
              onChange={(event) => choose(event.target.value)}
            >
              <option value="">Choose a candidate</option>
              {queue.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.student.studentProfile
                    ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`
                    : app.student.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {progress.completed} of {progress.total} evaluated by you in this round
        </p>
      </div>
      <p
        role={failed ? "alert" : "status"}
        className={
          message ? `text-sm ${failed ? "text-destructive" : "text-muted-foreground"}` : "sr-only"
        }
      >
        {message}
      </p>
      {!active ? (
        <div className="max-w-xl space-y-4 py-16">
          <h1 className="font-display text-3xl">Ready when you are.</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            {queue.length
              ? "Choose a candidate to bring their profile, application, and your evaluation into one focused view."
              : "No submitted applicants are in this round. The list will populate as applicants move through recruitment."}
          </p>
          {queue.length > 0 && (
            <Button onClick={() => choose(queue[0].id)}>
              Open first candidate
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <div key={active.id} className="oc-interview-candidate space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-14 shrink-0">
                <AvatarImage src={safeProfileUrl(profile?.headshotUrl)} alt="" />
                <AvatarFallback>
                  {profile ? `${profile.firstName[0]}${profile.lastName[0]}` : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="break-words font-display text-3xl focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {candidateName}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {profile
                    ? `${profile.major} · Class of ${profile.gradYear}`
                    : "Profile not provided"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {round?.name} · {applicationStatusLabels[active.status]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="font-mono text-lg tabular-nums"
                aria-label={`Elapsed interview time ${elapsedInterviewTime(seconds)}`}
              >
                {elapsedInterviewTime(seconds)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (running) carried.current = seconds
                  setRunning((value) => !value)
                }}
              >
                {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {running ? "Pause timer" : seconds ? "Resume timer" : "Start timer"}
              </Button>
            </div>
          </header>
          <div className="flex gap-4 text-sm lg:hidden">
            <a className="underline underline-offset-4" href="#interview-context">
              Candidate context
            </a>
            <a className="underline underline-offset-4" href="#interview-evaluation">
              Your evaluation
            </a>
          </div>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,.85fr)]">
            <div
              className="min-w-0 space-y-7 lg:max-h-[calc(100dvh-310px)] lg:overflow-y-auto lg:pr-5"
              role="region"
              id="interview-context"
              aria-label="Candidate context"
              tabIndex={0}
            >
              <section className="space-y-3 border-t border-border pt-5">
                <h2 className="text-sm font-semibold">Profile at a glance</h2>
                <RecruitmentAttendanceSummary clubId={membership.clubId} applicationId={active.id} />
                <TestScoreDetail profile={profile} />
              {profile?.bio && (
                  <p className="whitespace-pre-wrap text-sm leading-7">{profile.bio}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {active.student.email}
                  {profile?.gpa != null && ` · GPA ${profile.gpa}`}
                  {profile?.actScore != null && ` · ACT ${profile.actScore}`}
                  {profile?.satScore != null && ` · SAT ${profile.satScore}`}
                </p>
                {profile?.experiences.map((item) => (
                  <div key={item.id} className="text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-muted-foreground">
                      {item.subtitle} · {item.period}
                    </p>
                  </div>
                ))}
                <div className="flex gap-4">
                  {[
                    { label: "Résumé", url: profile?.resumeUrl, resolver: resolveResumeUrl },
                    { label: "LinkedIn", url: profile?.linkedinUrl, resolver: safeProfileUrl, resolveResumeUrl },
                  ].map(
                    ({ label, url, resolver }) =>
                      resolver(url) && (
                        <a
                          key={label}
                          href={resolver(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm underline underline-offset-4"
                        >
                          {label}
                          <span className="sr-only"> (new tab)</span>
                        </a>
                      ),
                  )}
                </div>
              </section>
              <section className="space-y-4 border-t border-border pt-5">
                <h2 className="text-sm font-semibold">Application context</h2>
                {active.answers.map((answer) => (
                  <div key={answer.id}>
                    <h3 className="text-sm font-medium leading-6">{answer.question.prompt}</h3>
                    {answer.question.type === "FILE_UPLOAD" && safeProfileUrl(answer.response) ? (
                      <a
                        href={safeProfileUrl(answer.response)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        Open document (new tab)
                      </a>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                        {answer.response || "No response provided."}
                      </p>
                    )}
                  </div>
                ))}
                {!active.answers.length && (
                  <p className="text-sm text-muted-foreground">No club-specific responses.</p>
                )}
              </section>
              <section className="space-y-4 border-t border-border pt-5">
                <h2 className="text-sm font-semibold">Other round evaluations</h2>
                {active.evaluations
                  .filter((item) => item.round !== round?.name)
                  .map((item) => (
                    <div key={item.id} className="border-l-2 border-border pl-3">
                      <p className="text-xs font-medium">
                        {item.round} · {item.score} / 10
                        {item.interviewerId === membership.id ? " · You" : " · Club reviewer"}
                      </p>
                      {item.notes && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                {!active.evaluations.some((item) => item.round !== round?.name) && (
                  <p className="text-sm text-muted-foreground">No evaluations from other rounds.</p>
                )}
              </section>
            </div>
            <div className="min-w-0 space-y-5">
              {round && <InterviewKitSession key={`${active.id}-${round.id}`} clubId={membership.clubId} applicationId={active.id} roundId={round.id} formRef={form} onState={handleKitState} onComplete={(evaluation, next) => {
                setData(previous => previous ? { ...previous, applications: previous.applications.map(app => app.id === active.id ? { ...app, evaluations: [...app.evaluations.filter(e => e.id !== evaluation.id), evaluation] } : app) } : previous)
                setRunning(false); setKitDirty(false)
                if(next && queue[index+1]) { setActiveId(queue[index+1].id); setSeconds(0); carried.current=0 }
              }} />}
              <div className="flex items-center justify-between border-t pt-4"><Button type="button" variant="ghost" disabled={busy || index<=0} onClick={()=>choose(queue[index-1].id)}>Previous candidate</Button><span className="text-xs">{index+1} of {queue.length}</span><Button type="button" variant="ghost" disabled={busy || index>=queue.length-1} onClick={()=>choose(queue[index+1].id)}>Next candidate</Button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
