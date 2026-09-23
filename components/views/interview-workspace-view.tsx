"use client"

import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Check, Pause, Play } from "lucide-react"
import { getClubPipeline } from "@/actions/crm"
import { submitEvaluation } from "@/actions/evaluations"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { reviewerEvaluation, interviewProgress, elapsedInterviewTime } from "@/lib/interview-mode"
import { safeProfileUrl } from "@/lib/student-profile"
import { applicationStatusLabels } from "@/lib/student-applications"
import { useDemoMode } from "@/contexts/demo-context"
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
export function InterviewWorkspaceView({ onExit }: { onExit?: () => void }) {
  const { user, loading } = useAuth()
  const { isDemoEnabled } = useDemoMode()
  const memberships = user?.memberships || []
  const [clubId, setClubId] = useState("")
  const membership = memberships.find((item) => item.clubId === clubId) || memberships[0]
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
        {membership && (
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
  const { isDemoEnabled } = useDemoMode()
  const { user } = useAuth()
  const [data, setData] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [roundId, setRoundId] = useState("")
  const [activeId, setActiveId] = useState("")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState('["",""]')
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
  const dirty = !!active && JSON.stringify([score, notes]) !== baseline
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
    if (isDemoEnabled) {
      setTimeout(() => {
        if (!current) return
        import("@/lib/data").then((data) => {
          const result = {
            rounds: data.workspaceRounds.map((r: any) => ({
              id: r.id,
              clubId: membership.clubId,
              name: r.label,
              order: 0
            })) as any,
            applications: data.applicants.map((a: any) => ({
              id: a.id,
              clubId: membership.clubId,
              status: "INTERVIEWING",
              roundId: data.workspaceRounds[0]?.id,
              student: { 
                email: a.email,
                studentProfile: { firstName: a.name.split(" ")[0], lastName: a.name.split(" ")[1], experiences: [] } 
              },
              evaluations: [],
              answers: [],
              bookings: []
            })) as any
          }
          setData(result)
          setRoundId(data.workspaceRounds[0]?.id || "")
          setLoading(false)
        })
      }, 300)
      return
    }

    getClubPipeline(membership.clubId)
      .then((result) => {
        if (current) {
          setData(result)
          const first =
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
    setScore("")
    setNotes("")
    setBaseline('["",""]')
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
  function choose(id: string, discard = false) {
    if (busy || (!discard && dirty && !window.confirm("Discard your unsaved evaluation changes?")))
      return
    const app = queue.find((item) => item.id === id)
    const mine = app && reviewerEvaluation(app.evaluations, membership.id, round?.name || "")
    const value = mine ? String(mine.score) : ""
    setActiveId(id)
    setScore(value)
    setNotes(mine?.notes || "")
    setBaseline(JSON.stringify([value, mine?.notes || ""]))
    setMessage("")
    setFailed(false)
    setRunning(false)
    setSeconds(0)
    carried.current = 0
    requestAnimationFrame(() => heading.current?.focus())
  }
  async function save(next: boolean) {
    if (!active || !round || busy) return
    if (!score || !Number.isFinite(Number(score)) || Number(score) < 1 || Number(score) > 10) {
      setFailed(true)
      setMessage("Choose a score from 1 to 10 before saving.")
      document.getElementById("interview-score")?.focus()
      return
    }
    setBusy(true)
    setMessage("")
    setFailed(false)
    try {
      let result;
      if (isDemoEnabled) {
        // Mock successful evaluation response in demo mode
        result = {
          success: true,
          evaluation: {
            id: crypto.randomUUID(),
            applicationId: active.id,
            interviewerId: membership.id,
            round: round.name,
            score: Number(score),
            notes,
            createdAt: new Date(),
          }
        }
      } else {
        result = await submitEvaluation({
          clubId: membership.clubId,
          applicationId: active.id,
          roundName: round.name,
          score: Number(score),
          notes,
        })
      }
      setData((previous) =>
        previous
          ? {
              ...previous,
              applications: previous.applications.map((app) =>
                app.id === active.id
                  ? {
                      ...app,
                      evaluations: [
                        ...app.evaluations.filter((item) => item.id !== result.evaluation.id),
                        result.evaluation,
                      ],
                    }
                  : app,
              ),
            }
          : previous,
      )
      setBaseline(JSON.stringify([score, notes]))
      setRunning(false)
      carried.current = seconds
      if (next && queue[index + 1]) {
        const upcoming = queue[index + 1],
          mine = reviewerEvaluation(upcoming.evaluations, membership.id, round.name),
          value = mine ? String(mine.score) : ""
        setActiveId(upcoming.id)
        setScore(value)
        setNotes(mine?.notes || "")
        setBaseline(JSON.stringify([value, mine?.notes || ""]))
        setSeconds(0)
        carried.current = 0
        setMessage("Evaluation saved. The next candidate is ready.")
        requestAnimationFrame(() => heading.current?.focus())
      } else
        setMessage(
          next
            ? "Evaluation saved. You’ve reached the end of this round’s list."
            : "Evaluation saved to the recruitment workspace.",
        )
    } catch {
      setFailed(true)
      setMessage("Your evaluation could not be saved. Your notes are still here. Please try again.")
    } finally {
      setBusy(false)
    }
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
                {profile?.bio && (
                  <p className="whitespace-pre-wrap text-sm leading-7">{profile.bio}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {active.student.email}
                  {profile?.gpa != null && ` · GPA ${profile.gpa}`}
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
                    ["Résumé", profile?.resumeUrl],
                    ["LinkedIn", profile?.linkedinUrl],
                  ].map(
                    ([label, url]) =>
                      safeProfileUrl(url) && (
                        <a
                          key={label}
                          href={safeProfileUrl(url)}
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
            <form
              id="interview-evaluation"
              ref={form}
              onSubmit={(event) => {
                event.preventDefault()
                void save(false)
              }}
              className="min-w-0 space-y-5 border-t border-border pt-5 lg:sticky lg:top-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Your evaluation</h2>
                <Badge variant="secondary">
                  {busy
                    ? "Saving…"
                    : dirty
                      ? "Unsaved changes"
                      : savedReview
                        ? "Saved"
                        : "Not evaluated"}
                </Badge>
              </div>
              <p className="text-xs leading-6 text-muted-foreground">
                Record an overall score and supporting notes for {round?.name}. This workspace uses
                one overall score with supporting notes.
              </p>
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="interview-score">Overall score · 1–10</Label>
                  <Input
                    id="interview-score"
                    type="number"
                    required
                    min={1}
                    max={10}
                    step="any"
                    value={score}
                    onChange={(event) => setScore(event.target.value)}
                    className="w-28"
                  />
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Quick score selection"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
                      <Button
                        type="button"
                        key={value}
                        size="sm"
                        variant={Number(score) === value ? "secondary" : "outline"}
                        aria-pressed={Number(score) === value}
                        aria-label={`Score ${value} out of 10`}
                        onClick={() => setScore(String(value))}
                        className="size-9 p-0"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interview-notes">Interview notes</Label>
                  <Textarea
                    id="interview-notes"
                    rows={10}
                    className="min-h-52 text-base leading-7"
                    placeholder="Capture specific observations and evidence for your score."
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Shared with authorized club reviewers. Saved when you submit your evaluation.
                  </p>
                </div>
              </fieldset>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={busy}>
                  <Check className="size-4" />
                  Save evaluation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Save & {index < queue.length - 1 ? "next candidate" : "finish"}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⌘ / Ctrl + Enter saves without advancing. Saving does not change the candidate’s
                round or decision.
              </p>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  variant="ghost"
                  type="button"
                  size="sm"
                  disabled={busy || index <= 0}
                  onClick={() => choose(queue[index - 1].id)}
                >
                  <ArrowLeft className="size-3.5" />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Candidate {index + 1} of {queue.length}
                </span>
                <Button
                  variant="ghost"
                  type="button"
                  size="sm"
                  disabled={busy || index >= queue.length - 1}
                  onClick={() => choose(queue[index + 1].id)}
                >
                  Next
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
