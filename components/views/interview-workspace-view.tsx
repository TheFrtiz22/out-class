"use client"
import { InterviewApplicantPanel } from "@/components/interview-applicant-panel"
import "@/components/shell/responsive-workspace.css"
import { PageHeader } from "@/components/product/page-header"
import { InterviewKitSession } from "@/components/interview-kit-session"
import { hasPermission } from "@/lib/permissions"

import { useApplicationState } from "@/lib/application-state"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { getInterviewWorkspace } from "@/lib/workspace-api"
import { interviewQueue, nextInterviewApplicant } from "@/lib/interview-queue"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { DemoInterviewGuide } from "@/components/demo-workspace"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import "./interview/interview-mode.css"

type Pipeline = Awaited<ReturnType<typeof getInterviewWorkspace>>
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
    <main data-workspace-detail className="oc-interview-room min-h-dvh bg-background text-foreground">
      {!membership && <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" disabled={saving} onClick={exit}>
            <ArrowLeft className="size-4" />
            Back to interviews
          </Button>
          <span className="hidden h-5 border-l border-border sm:block" />
          <p className="text-sm font-semibold">Interview mode</p>
        </div>
      </header>}
      <DemoInterviewGuide />
      <div className="mx-auto max-w-[1800px]">
        {loading ? (
          <p role="status">Loading interview workspace…</p>
        ) : !membership ? (
          <div className="max-w-4xl space-y-3 px-5 py-8">
            <PageHeader title="A focused space for a better conversation." />
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
          <InterviewSession key={`${membership.clubId}-${membership.id}-${user?.id}`} membership={membership} onLock={handleLock} onExit={exit} clubSelector={!scoped && <select aria-label="Interview club" disabled={locked} className={selectStyle} value={membership.clubId} onChange={event => setClubId(event.target.value)}>{memberships.map(item => <option key={item.clubId} value={item.clubId}>{item.club.name}</option>)}</select>} />
        )}
      </div>
    </main>
  )
}

function InterviewSession({
  membership,
  onLock,
  onExit,
  clubSelector,
}: {
  onExit: () => void
  membership: ExtendedMembership
  onLock: (locked: boolean, saving?: boolean) => void
  clubSelector?: ReactNode
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
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const recoveryKey = `outclass-interview:${membership.clubId}:${membership.id}`
  const recoveredApplicant = useCallback(() => {
    try { return JSON.parse(sessionStorage.getItem(recoveryKey) || "null") as { roundId: string; applicationId: string } | null }
    catch { return null }
  }, [recoveryKey])
  function rememberApplicant(applicationId: string) {
    try { sessionStorage.setItem(recoveryKey, JSON.stringify({ roundId, applicationId })) }
    catch { /* Server drafts remain available if browser storage is unavailable. */ }
  }
  const round = data?.rounds.find((item) => item.id === roundId)
  const queue = interviewQueue(data?.applications || [], roundId)
  const active = queue.find((app) => app.id === activeId)
  const [kitDirty, setKitDirty] = useState(false)
  const handleKitState = useCallback((changed: boolean, pending: boolean) => { setKitDirty(changed); setBusy(pending) }, [])
  const dirty = kitDirty
  const progress = { total: queue.length, completed: queue.filter(app => app.completedRoundIds.includes(roundId)).length }
  useEffect(() => {
    onLock(dirty || busy, busy)
    return () => onLock(false)
  }, [dirty, busy, onLock])
  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError(false)
    
    // In demo mode, intercept the real API with the mock demo-store logic
    getInterviewWorkspace(membership.clubId)
      .then((result) => {
        if (current) {
          setData(result)
          const recovery = recoveredApplicant()
          const focused = result.applications.find(a => a.id === leaderFocus?.applicantId)
          const first = result.rounds.find(r => r.id === focused?.roundId) ||
            result.rounds.find(r => r.id === recovery?.roundId && interviewQueue(result.applications, r.id).some(a => a.id === recovery.applicationId)) ||
            result.rounds.find((item) =>
              result.applications.some(
                (app) => app.roundId === item.id && app.assignedRoundIds.includes(item.id),
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
  }, [membership.clubId, retry, recoveredApplicant])
  useEffect(() => {
    if (!data) return
    const recovery = recoveredApplicant()
    setActiveId(recovery?.roundId === roundId && interviewQueue(data.applications, roundId).some(a => a.id === recovery.applicationId) ? recovery.applicationId : "")
    setMessage("")
  }, [roundId, data, recoveredApplicant])
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
    rememberApplicant(id)
    setMessage("")
    setFailed(false)
    requestAnimationFrame(() => heading.current?.focus())
  }
  function returnToList() {
    if (busy || (dirty && !window.confirm("Return to interviews? Unsaved changes will be lost."))) return
    try { sessionStorage.removeItem(recoveryKey) } catch { /* Selection stays local if storage is unavailable. */ }
    setActiveId("")
    setMessage("")
  }
  async function nextApplicant() {
    // Recheck membership, assignments, round and own completion at navigation time.
    // Never navigate using the queue cached before this review was submitted.
    setBusy(true)
    try {
      const fresh = await getInterviewWorkspace(membership.clubId)
      const next = fresh.rounds.some(r => r.id === roundId && !r.archived)
        ? nextInterviewApplicant(fresh.applications, roundId, activeId) : null
      if (!next) return false
      setData(fresh)
      setActiveId(next.id) // The keyed subtree resets panel, document, questions and history together.
      rememberApplicant(next.id)
      setMessage("")
      setFailed(false)
      return true
    } finally { setBusy(false) }
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
  return (
    <div>

      {!active && <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-end gap-3">
          {!active && <Button variant="ghost" disabled={busy} onClick={onExit}><ArrowLeft className="size-4" />Back to interviews</Button>}
          {clubSelector}
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
                  {app.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {progress.completed} of {progress.total} evaluated by you in this round
        </p>
      </div>}
      <p
        role={failed ? "alert" : "status"}
        className={
          message ? `text-sm ${failed ? "text-destructive" : "text-muted-foreground"}` : "sr-only"
        }
      >
        {message}
      </p>
      {!active ? (
        <div className="max-w-4xl space-y-3 px-5 py-8">
          <h1 ref={heading} tabIndex={-1} className="text-xl font-medium">Choose an interview</h1>
          <p className="text-sm leading-7 text-muted-foreground">
            {queue.length
              ? "Choose an assigned candidate to open their interview and your private question notes."
              : "No current panel assignments are available in this round. Ask your club owner to confirm your assignment."}
          </p>
          {queue.length > 0 && (
            <Button onClick={() => choose(queue[0].id)}>
              Open first candidate
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <div key={active.id} className="oc-interview-candidate">
          {round && <InterviewKitSession key={`${active.id}-${round.id}`} clubId={membership.clubId} applicationId={active.id} roundId={round.id} formRef={form} onState={handleKitState} onNextApplicant={nextApplicant} onReturnToList={returnToList}

toolbar={() => <><span className="oc-room-brand">OutClass</span><Button type="button" variant="ghost" disabled={busy} onClick={returnToList}><ArrowLeft className="size-4" />Interviews</Button><p className="oc-room-context"><span>{membership.club.name}</span><span aria-hidden="true"> / </span><span>{round.name}</span></p></>}
context={<InterviewApplicantPanel clubId={membership.clubId} applicationId={active.id} roundId={round.id} />}
            onComplete={() => {
              setData(previous => previous ? { ...previous, applications: previous.applications.map(app => app.id === active.id ? { ...app, completedRoundIds: [...new Set([...app.completedRoundIds, round.id])] } : app) } : previous)
              setKitDirty(false)
            }} />}
        </div>
      )}
    </div>
  )
}
