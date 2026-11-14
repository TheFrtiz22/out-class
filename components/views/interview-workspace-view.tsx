"use client"
import { isAccessRevoked, UserFacingError } from "@/lib/action-result"
import { PillSelect } from "@/components/ui/pill-select"
import { PillGroup } from "@/components/ui/segmented-control"
import { InterviewApplicantPanel } from "@/components/interview-applicant-panel"
import "@/components/shell/responsive-workspace.css"
import { PageHeader } from "@/components/ui/page-header"
import { useFocusFrame } from "@/components/shell/focus-frame-context"
import { InterviewKitSession } from "@/components/interview-kit-session"
import { hasPermission } from "@/lib/permissions"

import { useApplicationState } from "@/lib/application-state"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "@/components/icons"
import { getInterviewWorkspace, resolveInterviewRoomEntry, openInterviewSession, getInterviewApplicantPanel, prepareInterviewAdvance, confirmInterviewAdvance } from "@/lib/workspace-api"
import { captureInterviewCandidate, animateInterviewCandidate } from "@/lib/interview-candidate-motion"
import { interviewQueue } from "@/lib/interview-queue"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { DemoInterviewGuide } from "@/components/demo-workspace"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { Label } from "@/components/ui/label"
import "./interview/interview-mode.css"

type Pipeline = Awaited<ReturnType<typeof getInterviewWorkspace>>
export function InterviewWorkspaceView({ onExit, scoped = false }: { onExit?: () => void; scoped?: boolean }) {
  const { user, loading, activeClubId, selectClub } = useAuth()
  const confirm = useConfirm()
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
  async function exit() {
    if (saving) return
    if (!locked || await confirm({ title: "Leave interview mode?", description: "Unsaved evaluation changes will be lost.", confirmLabel: "Leave interview mode", cancelLabel: "Stay", tone: "danger" }))
      onExit?.()
  }
  // The focus frame's Exit goes through the same unsaved-work check.
  useFocusFrame({ onExit: onExit ? exit : undefined, club: membership ? { name: membership.club.name, color: membership.club.color } : null })
  return (
    <div className="oc-interview-room">
      <DemoInterviewGuide />
      <div className="oc-interview-container mx-auto max-w-[1800px]">
        {loading ? (
          <WorkspaceLoading label="Preparing the interview workspace…" layout="interview" rows={3} />
        ) : !membership ? (
          <div className="max-w-[var(--oc-content-width)] space-y-3 px-5 py-8">
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
          <InterviewSession key={`${membership.clubId}-${membership.id}-${user?.id}`} membership={membership} onLock={handleLock} onExit={exit} clubSelector={!scoped && <PillSelect label="Interview club" disabled={locked} active={false} value={membership.clubId} onChange={value => setClubId(value)} options={memberships.map(item => ({ value: item.clubId, label: item.club.name }))} />} />
        )}
      </div>
    </div>
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
  const confirm = useConfirm()
  const [data, setData] = useState<Pipeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [revokedNotes, setRevokedNotes] = useState(false)
  // A résumé comment the server refused with ACCESS_REVOKED. It cannot be kept, so it is shown once.
  const [revokedComment, setRevokedComment] = useState<string | null>(null)
  // The résumé comment open in the viewer, so a refusal reported by any room part can still show it.
  const openComment = useRef<string | undefined>(undefined)
  const trackComment = useCallback((comment: string | undefined) => { openComment.current = comment }, [])
  const [retry, setRetry] = useState(0)
  const [roundId, setRoundId] = useState("")
  const [activeId, setActiveId] = useState("")
  const [kitSaving, setBusy] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const busy = kitSaving || advancing
  const advancingRef = useRef(false)
  const navigation = useRef(0)
  const candidateRoom = useRef<HTMLDivElement>(null)
  const outgoing = useRef<ReturnType<typeof captureInterviewCandidate> | null>(null)
  const [prepared, setPrepared] = useState<{ applicationId: string; session: Awaited<ReturnType<typeof openInterviewSession>>; panel: Awaited<ReturnType<typeof getInterviewApplicantPanel>> } | null>(null)
  const [candidateAnnouncement, setCandidateAnnouncement] = useState("")
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [arrival, setArrival] = useState<{ moveId: string; clientId: string; applicationId: string } | null>(null)
  const [arrivalRetry, setArrivalRetry] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  // The server refused a room call with ACCESS_REVOKED (e.g. removed from the panel mid-interview).
  // Unmounting the room stops its polling and autosave; unsaved notes stay on this device.
  // Several room parts can report it; what each knows about unsaved work is combined until Try again.
  const accessRevoked = useCallback((unsavedNotes: boolean, unsavedComment?: string) => { setData(null); setActiveId(""); setPrepared(null); setArrival(null); setRevokedNotes(value => value || unsavedNotes); const comment = unsavedComment ?? openComment.current; if (comment !== undefined) setRevokedComment(comment); setLoadError(true) }, [])
  const recoveryKey = `outclass-interview:${membership.clubId}:${membership.id}`
  const recoveredApplicant = useCallback(() => {
    try { return JSON.parse(sessionStorage.getItem(recoveryKey) || "null") as { roundId: string; applicationId: string; moveId?: string; clientId?: string } | null }
    catch { return null }
  }, [recoveryKey])
  const rememberApplicant = useCallback((applicationId: string, receipt?: { moveId: string; clientId: string }) => {
    try { sessionStorage.setItem(recoveryKey, JSON.stringify({ roundId, applicationId, ...receipt })) }
    catch { /* Server drafts remain available if browser storage is unavailable. */ }
  }, [recoveryKey, roundId])
  useEffect(() => {
    if (!arrival || arrival.applicationId !== activeId) return
    let current = true
    confirmInterviewAdvance({ moveId: arrival.moveId, clientId: arrival.clientId }).then(() => { if (current) { setArrival(null); rememberApplicant(activeId); setMessage("") } }).catch((error) => {
      if (!current) return
      // Refused: the receipt is dropped (Try again reopens this applicant without re-confirming) and no arrival is reported.
      if (isAccessRevoked(error)) { rememberApplicant(activeId); accessRevoked(dirtyRef.current); return }
      setFailed(true); setMessage("Your destination is open, but the panel invitation could not be confirmed. Retry confirmation.")
    })
    return () => { current = false }
  }, [arrival, activeId, arrivalRetry, rememberApplicant, accessRevoked])
  const round = data?.rounds.find((item) => item.id === roundId)
  useFocusFrame({ task: round ? `Interview · ${round.name}` : undefined })
  const queue = interviewQueue(data?.applications || [], roundId)
  const active = queue.find((app) => app.id === activeId)
  const [kitDirty, setKitDirty] = useState(false)
  const handleKitState = useCallback((changed: boolean, pending: boolean) => { setKitDirty(changed); setBusy(pending) }, [])
  const dirty = kitDirty
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty
  // The applicant panel and résumé viewer do not see the notes; this view does.
  const panelAccessRevoked = useCallback((unsavedComment?: string) => accessRevoked(dirtyRef.current, unsavedComment), [accessRevoked])
  const progress = { total: queue.length, completed: queue.filter(app => app.completedRoundIds.includes(roundId)).length }
  useEffect(() => () => { navigation.current++ }, [])
  useEffect(() => { navigation.current++ }, [roundId])
  useLayoutEffect(() => {
    const stage = candidateRoom.current?.querySelector<HTMLElement>(".oc-interview-columns")
    if (!prepared || prepared.applicationId !== activeId || !outgoing.current || !stage) return
    const old = outgoing.current
    outgoing.current = null
    const epoch = navigation.current
    const motion = animateInterviewCandidate(stage, old)
    void motion.finished.then(() => {
      if (epoch !== navigation.current) return
      setCandidateAnnouncement(`${active?.name || "Candidate"} · Interview ready`)
      candidateRoom.current?.querySelector<HTMLElement>("[data-candidate-focus]")?.focus({ preventScroll: true })
      advancingRef.current = false
      setAdvancing(false)
    })
    return () => { motion.cancel() }
  }, [prepared, activeId, active?.name])
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
      .then(async (result) => {
        const query = new URLSearchParams(window.location?.search || "");
        if (query.has("applicationId") || query.has("bookingId")) { const entry = await resolveInterviewRoomEntry({ clubId: membership.clubId, applicationId: query.get("applicationId") || "", roundId: query.get("roundId") || "", ...(query.get("bookingId") ? { bookingId: query.get("bookingId")! } : {}), ...(query.get("slotId") ? { slotId: query.get("slotId")! } : {}), ...(query.get("roomId") ? { roomId: query.get("roomId")! } : {}) }); if ("unavailable" in entry) throw Error(entry.unavailable) }
        if (current) {
          setData(result)
          const recovery = recoveredApplicant()
          const linked = result.applications.find(a => a.id === query.get("applicationId") && a.assignedRoundIds.includes(query.get("roundId") || "") && (a.roundId === query.get("roundId") || a.completedRoundIds.includes(query.get("roundId") || "")));
          if (query.has("applicationId") && !linked) throw new UserFacingError("Requested interview unavailable.");
          if (linked) setActiveId(linked.id);
          if (linked) try { sessionStorage.setItem(recoveryKey, JSON.stringify({ roundId: query.get("roundId"), applicationId: linked.id })); } catch { /* Authorized queue still opens if browser storage is unavailable. */ }
          const focused = linked || result.applications.find(a => a.id === leaderFocus?.applicantId)
          const first = result.rounds.find(r => linked ? r.id === query.get("roundId") : r.id === focused?.roundId) ||
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
    const recovered = recovery?.roundId === roundId && interviewQueue(data.applications, roundId).some(a => a.id === recovery.applicationId)
    setActiveId(recovered ? recovery.applicationId : "")
    if (recovered && recovery.moveId && recovery.clientId) setArrival({ applicationId: recovery.applicationId, moveId: recovery.moveId, clientId: recovery.clientId })
    setMessage("")
  }, [roundId, data, recoveredApplicant])
  useEffect(() => {
    // Nothing to keep validating while the access-removed state shows; Try again restarts it.
    if (loadError) return;
    let current = true, pending = false;
    const validate = async () => {
      const q = new URLSearchParams(window.location.search);
      if (!q.get("applicationId") || document.hidden || pending) return;
      pending = true;
      try { const entry = await resolveInterviewRoomEntry({ clubId: membership.clubId, applicationId: q.get("applicationId")!, roundId: q.get("roundId") || "", ...(q.get("bookingId") ? { bookingId: q.get("bookingId")! } : {}), ...(q.get("slotId") ? { slotId: q.get("slotId")! } : {}), ...(q.get("roomId") ? { roomId: q.get("roomId")! } : {}) }); if ("unavailable" in entry) throw Error(entry.unavailable); }
      catch { if (current) { setData(null); setActiveId(""); setLoadError(true); } }
      finally { pending = false; }
    };
    const timer = setInterval(validate, 15000); window.addEventListener("focus", validate);
    return () => { current = false; clearInterval(timer); window.removeEventListener("focus", validate); };
  }, [membership.clubId, loadError]);
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
    if (!new URLSearchParams(window.location.search).has("applicationId") && leaderFocus?.clubId === membership.clubId && leaderFocus.applicantId && queue.some(a => a.id === leaderFocus.applicantId)) {
      void choose(leaderFocus.applicantId, true)
      clearLeaderFocus()
    }
  }, [data, roundId, leaderFocus, membership.clubId, clearLeaderFocus])
  async function choose(id: string, discard = false) {
    if (busy || (!discard && dirty && !(await confirm({ title: "Discard evaluation changes?", description: "Your unsaved evaluation changes will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" }))))
      return
    const url = new URL(window.location.href); url.searchParams.set("applicationId", id); url.searchParams.set("roundId", roundId);
    for (const key of ["bookingId", "slotId", "roomId"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
    setActiveId(id)
    setArrival(null)
    navigation.current++
    setPrepared(null)
    rememberApplicant(id)
    setMessage("")
    setFailed(false)
    requestAnimationFrame(() => heading.current?.focus())
  }
  async function returnToList() {
    if (busy || (dirty && !(await confirm({ title: "Return to interviews?", description: "Unsaved changes will be lost.", confirmLabel: "Return to interviews", cancelLabel: "Stay", tone: "danger" })))) return
    try { sessionStorage.removeItem(recoveryKey) } catch { /* Selection stays local if storage is unavailable. */ }
    onExit()
  }
  async function nextApplicant(clientId: string, invitationId?: string) {
    // Recheck membership, assignments, round and own completion at navigation time.
    // Never navigate using the queue cached before this review was submitted.
    if (advancingRef.current) return false
    advancingRef.current = true
    setAdvancing(true)
    const epoch = navigation.current
    let started = false
    try {
      const destination = await prepareInterviewAdvance({ clubId: membership.clubId, applicationId: activeId, roundId, clientId, invitationId })
      if (!destination) return false
      const fresh = await getInterviewWorkspace(membership.clubId)
      if (epoch !== navigation.current) return false
      const next = fresh.applications.find(app => app.id === destination.scope.applicationId && app.roundId === roundId && app.assignedRoundIds.includes(roundId) && !app.completedRoundIds.includes(roundId))
      if (!next || !fresh.rounds.some(r => r.id === roundId && !r.archived)) throw new UserFacingError("That round is no longer available.")
      const scope = destination.scope
      // Both actions enforce current access. Keep the submitted candidate visible
      // until the destination's own draft, snapshot and identity are all ready.
      const [session, panel] = await Promise.all([openInterviewSession(scope), getInterviewApplicantPanel(scope)])
      if (epoch !== navigation.current) return false
      if (session.completedAt) throw new UserFacingError("That interview was completed elsewhere. Retry the queue.")
      const stage = candidateRoom.current?.querySelector<HTMLElement>(".oc-interview-columns")
      if (stage) outgoing.current = captureInterviewCandidate(stage)
      setPrepared({ applicationId: next.id, session, panel })
      setArrival({ moveId: destination.moveId, clientId, applicationId: next.id })
      setData(fresh)
      const destinationUrl = new URL(window.location.href);
      destinationUrl.searchParams.set("applicationId", next.id); destinationUrl.searchParams.set("roundId", roundId);
      for (const key of ["bookingId", "slotId", "roomId"]) destinationUrl.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", destinationUrl.pathname + destinationUrl.search);
      setActiveId(next.id) // The keyed subtree resets panel, document, questions and history together.
      rememberApplicant(next.id, { moveId: destination.moveId, clientId })
      setMessage("")
      setFailed(false)
      started = !!stage
      return true
    } finally {
      if (!started && epoch === navigation.current) { advancingRef.current = false; setAdvancing(false) }
    }
  }
  if (loading) return <WorkspaceLoading label="Loading interview workspace…" layout="interview" rows={3} />
  if (loadError || !data)
    return (
      <div role="alert" className="space-y-4 py-12">
        <p>We couldn’t open this interview. It may have changed, or you may no longer have access. Use Exit to return to your interviews.</p>
        {revokedNotes && <p className="text-sm text-muted-foreground">Notes you hadn’t saved stay in this browser and return if you reopen this interview. Re-enter any unsaved score.</p>}
        {revokedComment !== null && <div className="space-y-2"><p className="text-sm text-muted-foreground">{revokedComment.trim() ? "Your résumé comment wasn’t saved. Copy it if you need it:" : "Your résumé highlight wasn’t saved."}</p>{revokedComment.trim() && <blockquote className="whitespace-pre-wrap break-words rounded-md border p-3 text-sm">{revokedComment}</blockquote>}</div>}
        <Button variant="outline" onClick={() => { setRevokedNotes(false); setRevokedComment(null); setRetry((value) => value + 1) }}>
          Try again
        </Button>
      </div>
    )
  return (
    <div className="oc-interview-session">

      {!active && <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4 sm:px-8">
        <div className="flex flex-wrap items-end gap-3">
          {clubSelector}
          <div className="space-y-2">
            <span className="text-sm font-medium">Round</span>
            <PillGroup id="interview-round" label="Round" size="compact" value={roundId} onChange={async (value) => {
                if (busy) return
                if (!dirty || await confirm({ title: "Discard evaluation changes?", description: "Your unsaved evaluation changes will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", tone: "danger" })) setRoundId(value)
              }} options={data.rounds.map((item) => ({ value: item.id, label: item.name, disabled: busy }))} />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Candidate</span>
            <PillSelect id="interview-candidate" label="Candidate" className="w-full sm:w-64" disabled={busy || !queue.length} active={false} value={activeId} placeholder="Choose a candidate"
              onChange={(value) => void choose(value)} options={queue.map((app) => ({ value: app.id, label: app.name }))} />
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
        {arrival && failed && <Button type="button" variant="ghost" onClick={() => setArrivalRetry(v => v + 1)}>Retry confirmation</Button>}
      </p>
      <p className="sr-only" role="status" aria-live="polite">{candidateAnnouncement}</p>
      {!active ? (
        <div className="max-w-[var(--oc-content-width)] space-y-3 px-5 py-8">
          <PageHeader title="Choose an interview" titleRef={heading} focusable />
          <p className="text-sm leading-7 text-muted-foreground">
            {queue.length
              ? "Choose an assigned candidate to open their interview and your private question notes."
              : "No current panel assignments are available in this round. Ask your club owner to confirm your assignment."}
          </p>
          {queue.length > 0 && (
            <Button onClick={() => void choose(queue[0].id)}>
              Open first candidate
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <div key={active.id} ref={candidateRoom} className="oc-interview-candidate">
          {round && <InterviewKitSession key={`${active.id}-${round.id}`} clubId={membership.clubId} applicationId={active.id} roundId={round.id} initialSession={prepared?.applicationId === active.id ? prepared.session : undefined} advancing={advancing} formRef={form} onState={handleKitState} onNextApplicant={nextApplicant} onReturnToList={returnToList} onAccessRevoked={accessRevoked}

toolbar={() => <><Button type="button" variant="ghost" disabled={busy} onClick={() => void returnToList()}><ArrowLeft className="size-4" />Interviews</Button></>}
context={<InterviewApplicantPanel clubId={membership.clubId} applicationId={active.id} roundId={round.id} initialPanel={prepared?.applicationId === active.id ? prepared.panel : undefined} onAccessRevoked={panelAccessRevoked} onDraftComment={trackComment} />}
            onComplete={() => {
              setData(previous => previous ? { ...previous, applications: previous.applications.map(app => app.id === active.id ? { ...app, completedRoundIds: [...new Set([...app.completedRoundIds, round.id])] } : app) } : previous)
              setKitDirty(false)
            }} />}
        </div>
      )}
    </div>
  )
}
