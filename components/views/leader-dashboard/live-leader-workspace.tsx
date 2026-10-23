"use client"
import { useEditorDraft } from "@/hooks/use-editor-draft"
import { AutosaveStatus } from "@/components/ui/autosave-status"
import { ApplicationCycleAssignment } from "@/components/recruitment-cycles";
import { ScheduleDecision } from "@/components/decision-schedules";
import { slotTime } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE, schedulingDateTime } from "@/lib/scheduling-config"
import { isInterviewRecruitmentRound } from "@/lib/recruitment-lifecycle"
import { findReviewerEvaluation } from "@/lib/reviewer-evaluation"
import { profilePhotoSource } from "@/lib/profile-photo"
import { genderValues } from "@/lib/student-profile"
import { compareAcademicYears } from "@/lib/recruitment-profile"
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"
import { applicationAttachmentUrl } from "@/lib/student-applications"
import { applicationDecisionGroup, decisionGroups, type DecisionGroup } from "@/lib/application-decisions"
import { compareApplicants, type ApplicantSort } from "@/lib/live-applicant-sorting"
import { applicantLane } from "@/lib/applicant-board"
import { LiveApplicantList, LiveApplicantKanban, LiveDecisionList, type ApplicantLane } from "./live-applicant-views"
import { useDemoMode } from "@/contexts/demo-context"
import { RecruitmentAttendanceSummary } from "@/components/recruitment-attendance-summary"
import { RevealApplicant } from "@/components/reveal-applicant"
import { hasPermission } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import { applicantInterviewHref } from "@/lib/applicant-interview-navigation"
import Link from "next/link"
import { canLeaveWorkspace } from "@/lib/product-navigation"

import { WorkspaceLoading } from "@/components/workspace-loading"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "@/components/icons"
import { BoardDecisionMode } from "@/components/live-voting/board-decision-mode"
import { getClubPipeline, moveApplicantRound, setApplicationStatus, reconsiderRejectedApplication, revokeRecruitmentOffer } from "@/lib/workspace-api"
import { submitEvaluation } from "@/lib/workspace-api"
import { useApplicationState } from "@/lib/application-state"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { DemoRoundTarget } from "@/components/demo-workspace"
import { safeProfileUrl, resolveRecruitingResumeUrl } from "@/lib/student-profile"
import { applicationStatusLabels } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

type Pipeline = Awaited<ReturnType<typeof getClubPipeline>>
type Candidate = Pipeline["applications"][number]
const selectStyle =
  "h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
const name = (app: Candidate) =>
  app.student.studentProfile
    ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`
    : app.student.email
const average = (app: Candidate) =>
  app.roundScore?.average ?? null

export function LiveLeaderWorkspace({ scoped = false, decisionsOnly = false, rejectedOnly = false, initialData, onData }: { scoped?: boolean; decisionsOnly?: boolean; rejectedOnly?: boolean; initialData?: { clubId: string; pipeline: Pipeline }; onData?: (clubId: string, data: Pipeline | null) => void }) {
  const { user, activeClubId, selectClub } = useAuth()
  const demo = useDemoMode()
  const { leaderFocus } = useApplicationState()
  const clubs = (user?.memberships || []).filter(
    (item) => (hasPermission(item, "applicants.identify") || hasPermission(item, "applications.review")),
  )
  const clubId = activeClubId
  const setClubId = selectClub
  useEffect(() => {
    if (leaderFocus && !scoped && leaderFocus.clubId !== activeClubId) setClubId(leaderFocus.clubId)
  }, [leaderFocus, activeClubId, scoped, setClubId])
  const club = clubs.find((item) => item.clubId === clubId) || (!clubId ? clubs[0] : undefined)
  if (!club)
    return (
      <div className="space-y-3 py-10">
        <h2 className="oc-section-heading ">No recruitment workspace assigned</h2>
        <p className="text-sm text-muted-foreground">
          Your club manager can grant applicant access. Use Settings for your other workspace capabilities.
        </p>
      </div>
    )
  return (
    <div className="space-y-6">
      {!scoped && <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recruitment workspace
          </p>
          <h2 className="oc-section-heading mt-2">{club.club.name}</h2>
        </div>
        {!scoped && clubs.length > 1 && (
          <select
            aria-label="Recruiting club"
            className={selectStyle}
            value={club.clubId}
            onChange={(event) => setClubId(event.target.value)}
          >
            {clubs.map((item) => (
              <option key={item.clubId} value={item.clubId}>
                {item.club.name}
              </option>
            ))}
          </select>
        )}
      </div>}
      <ClubWorkspace key={club.clubId} membership={club} decisionsOnly={decisionsOnly} rejectedOnly={rejectedOnly} initialData={initialData?.clubId === club.clubId ? initialData.pipeline : null} onData={data => onData?.(club.clubId, data)} />
      {demo.isDemoEnabled && !decisionsOnly && <details className="text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3">Sample recruiting target</summary><DemoRoundTarget /></details>}
    </div>
  )
}

/** Dashboard entry loads one applicant through the same masked CRM projection and review form. */
export function ApplicantReviewPreview({ clubId, applicationId, onClose, onChanged, onNext }: { clubId: string; applicationId: string; onClose: () => void; onChanged: () => void; onNext?: () => void }) {
  const { user } = useAuth()
  const membership = user?.memberships.find(m => m.clubId === clubId)
  if (!membership) return <p role="alert">Applicant access unavailable.</p>
  return <ClubWorkspace key={applicationId} membership={membership} preview={{ applicationId, onClose, onChanged, onNext }} />
}

function ClubWorkspace({ membership, decisionsOnly = false, rejectedOnly = false, initialData = null, onData, preview }: { preview?: { applicationId: string; onClose: () => void; onChanged: () => void; onNext?: () => void }; membership: ExtendedMembership; decisionsOnly?: boolean; rejectedOnly?: boolean; initialData?: Pipeline | null; onData?: (data: Pipeline | null) => void }) {
  const previewId = preview?.applicationId
  const demo = useDemoMode()
  const { leaderFocus, clearLeaderFocus } = useApplicationState()
  const [data, setData] = useState<Pipeline | null>(initialData)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(!initialData)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [round, setRound] = useState("")
  const [decisionGroup, setDecisionGroup] = useState<DecisionGroup>("pending")
  const [status, setStatus] = useState("")
  const [review, setReview] = useState("")
  const [major, setMajor] = useState("")
  const [year, setYear] = useState("")
  const [gpa, setGpa] = useState("")
  const [sat, setSat] = useState("")
  const [act, setAct] = useState("")
  const [rating, setRating] = useState("")
  const [compact, setCompact] = useState(true)
  const [view, setView] = useState<"list" | "kanban">("list")
  const [gender, setGender] = useState("")
  const [showGenderCounts, setShowGenderCounts] = useState(false)
  const [sort, setSort] = useState<ApplicantSort>("name")
  const [descending, setDescending] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [reconsiderReason, setReconsiderReason] = useState("")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState("")
  const [decision, setDecision] = useState("")
  const [targetRound, setTargetRound] = useState("")
  const [quickQueue, setQuickQueue] = useState<string[] | null>(null)
  const [boardMove, setBoardMove] = useState<{ id: string; lane: ApplicantLane } | null>(null)
  const [boardError, setBoardError] = useState("")
  const mutating = useRef(false)
  const retained = useRef(data), publish = useRef(onData)
  retained.current = data
  publish.current = onData
  useEffect(() => { publish.current?.(data) }, [data])
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let current = true
    setLoading(!retained.current)
    setError("")
    
    getClubPipeline(membership.clubId, { ...(previewId ? { applicationId: previewId } : {}), ...(round ? { roundId: round } : {}), ...(gender ? { gender: gender as (typeof genderValues)[number] } : {}), genderCounts: showGenderCounts })
      .then((result) => {
        if (current) setData(result)
      })
      .catch(() => {
        if (current) { setData(null); setError("Couldn’t load this club’s applicants. Please try again.") }
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [membership.clubId, revision, round, gender, showGenderCounts, previewId])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement
      if (
        event.key === "/" &&
        !activeId &&
        !element.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [activeId])
  const applicants = useMemo(() => (data?.applications || []).filter(a=>rejectedOnly?a.status==="REJECTED":decisionsOnly||a.status!=="REJECTED"), [data,rejectedOnly,decisionsOnly])
  const filtered = useMemo(
    () =>
      applicants
        .filter((app) => {
          const profile = app.student.studentProfile
          return (
            `${name(app)} ${app.student.email} ${profile?.major || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()) &&
            (rejectedOnly ? app.status === "REJECTED" : decisionsOnly || app.status !== "REJECTED") &&
            (!round || app.roundId === round) &&
            (!status || app.status === status) &&
            (!decisionsOnly || applicationDecisionGroup(app.status) === decisionGroup) &&
            (!major || profile?.major === major) &&
            (!year || String(profile?.academicYear) === year) &&
            (!gpa || (profile?.gpa != null && profile.gpa > Number(gpa))) &&
            (!rating || (average(app) != null && average(app)! >= Number(rating))) &&
            (!act || (profile?.actScore != null && profile.actScore > Number(act))) &&
            (!sat || (profile?.satScore != null && profile.satScore > Number(sat))) &&
            (!review ||
              (review === "unreviewed"
                ? app.evaluations.length === 0
                : app.evaluations.some((item) => item.interviewerId === membership.id)))
          )
        })
        .sort((a, b) => compareApplicants(a, b, sort, descending, data?.rounds)),
    [
      applicants,
      data?.rounds,
      rejectedOnly,
      decisionsOnly,
      decisionGroup,
      query,
      round,
      status,
      major,
      year,
      gpa,
      sat,
      act,
      rating,
      review,
      sort,
      descending,
      membership.id,
    ],
  )
  const previewOpened = useRef(false), previewOpen = useRef<(app: Candidate) => void>(() => {})
  useEffect(() => {
    if (!previewId || !data || loading || previewOpened.current) return
    const target = data.applications.find(app => app.id === previewId)
    if (target) { previewOpened.current = true; previewOpen.current(target) }
  }, [previewId, data, loading])
  const active = applicants.find((app) => app.id === activeId)
  const canEvaluate = active?.canEvaluate === true
  const dirty = canEvaluate && JSON.stringify([score, notes]) !== baseline
  const draftSave = useEditorDraft({
    scope: { kind: "review", clubId: membership.clubId, resourceId: `${active?.id ?? "none"}:${active?.roundId ?? "none"}` },
    value: { score, notes }, restore: value=>{setScore(value.score);setNotes(value.notes)},
    enabled: canEvaluate, base: baseline,
  })
  const activeIndex = filtered.findIndex((app) => app.id === activeId)
  useEffect(() => {
    if (!data || loading || !leaderFocus || leaderFocus.clubId !== membership.clubId) return
    if (leaderFocus.roundId) setRound(leaderFocus.roundId)
    if (leaderFocus.applicantId) {
      const target = data.applications.find((app) => app.id === leaderFocus.applicantId)
      if (target) { if (decisionsOnly) setDecisionGroup(applicationDecisionGroup(target.status) || "pending"); open(target) }
    }
    clearLeaderFocus()
  }, [data, loading, leaderFocus, membership.clubId, clearLeaderFocus])
  function open(app?: Candidate) {
    if (busy) return
    const apply = () => {
    setActiveId(app?.id || null)
    if (!app) { setQuickQueue(null); preview?.onClose() }
    setMessage("")
    setDecision("")
    if (app) {
      const mine = findReviewerEvaluation(app.evaluations, membership.id, data?.rounds.find(item => item.id === app.roundId))
      const value = mine ? String(mine.score) : ""
      setScore(value)
      setNotes(mine?.notes || "")
      setBaseline(JSON.stringify([value, mine?.notes || ""]))
      setTargetRound(app.roundId)
      requestAnimationFrame(() => heading.current?.focus())
    } else
      requestAnimationFrame(() => {
        Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            `[data-applicant-id="${CSS.escape(activeId || "")}"]`,
          ),
        )
          .find((button) => button.getClientRects().length > 0)
          ?.focus()
      })
    }
    if (active?.canEvaluate && (draftSave.dirty || draftSave.saving)) void draftSave.flush().then(apply).catch(() => {})
    else apply()
  }
  previewOpen.current = open
  async function mutate(kind: "review" | "round" | "decision") {
    if (!active || mutating.current) return
    if (kind === "review" && (!score || Number(score) < 1 || Number(score) > 10)) {
      setMessage("Enter a score from 1 to 10 before saving your evaluation.")
      return
    }
    mutating.current = true
    setBusy(true)
    setMessage("")
    try {
      if (kind === "review") {
        if (!canEvaluate) throw new Error("A current panel assignment is required to submit this identified review.")
        await draftSave.flush()
        const roundName = data?.rounds.find((item) => item.id === active.roundId)?.name
        if (!roundName) throw new Error()
        const result = await submitEvaluation({
          clubId: membership.clubId,
          applicationId: active.id,
          roundName,
          score: Number(score),
          notes,
        })
        setData((previous) =>
          previous
            ? {
                ...previous,
                applications: previous.applications.map((app) =>
                  app.id === active.id
                    ? {
                        ...app,
                        canEvaluate: false,
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
        await draftSave.clear()
        setBaseline(JSON.stringify([score, notes]))
        setMessage("Evaluation saved.")
      } else if (kind === "round") {
        await moveApplicantRound({
          clubId: membership.clubId,
          applicationId: active.id,
          newRoundId: targetRound,
          expectedRoundId: active.roundId,
        })
        setData(null)
        setActiveId(null)
        setRevision(v => v + 1)
        const mine = findReviewerEvaluation(active.evaluations, membership.id, data?.rounds.find(item => item.id === targetRound))
        setScore(mine ? String(mine.score) : "")
        setNotes(mine?.notes || "")
        setBaseline(JSON.stringify([mine ? String(mine.score) : "", mine?.notes || ""]))
        setMessage("Round updated. Moving out of an interview round returns interview applicants to review.")
        preview?.onClose()
      } else {
        await setApplicationStatus({
          clubId: membership.clubId,
          applicationId: active.id,
          status: decision as "ACCEPTED",
          expectedStatus: active.status === "DRAFTING" ? undefined : active.status,
        })
        // Apply the acknowledged status only after the server confirms publication.
        setData(current => current ? { ...current, applications: current.applications.map(app => app.id === active.id ? { ...app, status: decision as "ACCEPTED" } : app) } : current)
        // The following read refreshes canonical offer and privacy state.
        setDecision("")
        setRevision(v => v + 1)
        setMessage("Application status updated.")
      }
      preview?.onChanged()
    } catch {
      setMessage(
        "This change could not be saved. The applicant may have changed or your access may have changed. Your entries are still here; save or copy your review, then reload before retrying.",
      )
    } finally {
      mutating.current = false
      setBusy(false)
    }
  }
  const canDecide = hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify")
  const pendingCandidate = (app: Candidate) => !["ACCEPTED", "REJECTED", "WAITLISTED", "DRAFTING"].includes(app.status) && !app.studentId.startsWith("anonymous-") && app.studentId !== membership.userId
  function canMove(app: Candidate, lane: ApplicantLane) {
    if (!canDecide || busy || !pendingCandidate(app) || applicantLane(app.status) === lane) return false
    return lane !== "interview" || isInterviewRecruitmentRound(data?.rounds.find(item => item.id === app.roundId)?.type || "")
  }
  async function writeStatus(app: Candidate, status: "IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED") {
    await setApplicationStatus({ clubId: membership.clubId, applicationId: app.id, status, expectedStatus: app.status === "DRAFTING" ? undefined : app.status })
    try {
      const refreshed = await getClubPipeline(membership.clubId, { ...(previewId ? { applicationId: previewId } : {}), ...(round ? { roundId: round } : {}), ...(gender ? { gender: gender as (typeof genderValues)[number] } : {}), genderCounts: showGenderCounts })
      setData(refreshed)
      return refreshed
    } catch (error) {
      setData(null); setActiveId(null); setQuickQueue(null)
      setError("The status was saved, but applicants could not be refreshed. Reload to check current data and access.")
      throw error
    }
  }
  async function confirmBoardMove(status: "IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED") {
    const app = applicants.find(candidate => candidate.id === boardMove?.id)
    if (!app || !boardMove || !canMove(app, boardMove.lane) || mutating.current) return
    mutating.current = true; setBusy(true); setBoardError("")
    try { await writeStatus(app, status); setBoardMove(null) }
    catch { setBoardError("This move could not be saved. Refresh applicants and check your current access before retrying.") }
    finally { mutating.current = false; setBusy(false) }
  }
  async function quickDecision(status: "ACCEPTED" | "REJECTED") {
    if (!active || !canDecide || !pendingCandidate(active) || mutating.current || !quickQueue) return
    mutating.current = true; setBusy(true); setMessage("")
    try {
      await draftSave.flush()
      const refreshed = await writeStatus(active, status)
      const remaining = quickQueue.filter(id => id !== active.id)
      const next = remaining.map(id => refreshed.applications.find(app => app.id === id)).find(app => app && pendingCandidate(app))
      setQuickQueue(remaining)
      // Release the guard before opening the next profile; identity comes from the refreshed projection.
      mutating.current = false; setBusy(false)
      if (next) open(next)
      else { setActiveId(null); setQuickQueue(null); setMessage("Quick review complete.") }
    } catch { setMessage("This decision could not be saved. The candidate stays open. Refresh and check your access before retrying.") }
    finally { mutating.current = false; setBusy(false) }
  }
  function startQuickReview() {
    const queue = filtered.filter(pendingCandidate)
    if (!canDecide || !queue.length) return
    setQuickQueue(queue.map(app => app.id)); open(queue[0])
  }
  function sortBy(key: ApplicantSort) {
    if (sort === key) setDescending((value) => !value)
    else {
      setSort(key)
      setDescending(["score", "gpa", "sat", "act", "year"].includes(key))
    }
  }
  if (loading) return <WorkspaceLoading label="Loading applicants…" />
  if (!data || error)
    return (
      <div role="alert" className="space-y-3">
        <p>{error || "No data available."}</p>
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)}>
          Try again
        </Button>
      </div>
    )
  return (
    <div className="oc-live-pipeline space-y-6" data-unsaved={draftSave.dirty} data-saving={busy}>
      <div hidden={!!preview}>
      {!active && message && <p role="status" className="text-sm">{message}</p>}
      {decisionsOnly && <>
        <div role="group" aria-label="Decision groups" className="flex flex-wrap gap-1 border-b pb-3">{decisionGroups.map(group => <Button key={group.id} variant={decisionGroup === group.id ? "secondary" : "ghost"} aria-pressed={decisionGroup === group.id} onClick={() => setDecisionGroup(group.id)}>{group.label}<span className="ml-2 text-xs font-normal text-muted-foreground">{applicants.filter(app => applicationDecisionGroup(app.status) === group.id).length}</span></Button>)}</div>
        <p className="text-sm text-muted-foreground">{decisionGroup === "pending" ? "Submitted, in-review, and interviewing applications without a recorded decision. Round and status remain separate." : "Recorded application outcomes, visible to the applicant."} Acceptance does not automatically create club membership.</p>
      </>}
{!decisionsOnly && !rejectedOnly && <>
      <section aria-label="Recruitment review" className="flex flex-wrap items-center justify-between gap-4 border-y py-4">
        <div><h2 className="oc-card-heading">Recruitment review</h2><p className="mt-1 text-xs text-muted-foreground">Review together or work through candidates one at a time.</p></div>
        <div className="flex flex-wrap gap-2">
          {canDecide && <Button variant="outline" disabled={busy || !filtered.some(pendingCandidate)} onClick={startQuickReview}>Quick review</Button>}
      {hasPermission(membership, "applications.review") && (["decisions.view", "decisions.manage", "decisions.vote"] as const).some(permission => hasPermission(membership, permission)) && <BoardDecisionMode
        applicants={filtered}
        rounds={data.rounds}
        clubId={membership.clubId}
        clubName={membership.club.name}
        canDecide={hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify")}
        onDecision={(id, status) =>
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  applications: previous.applications.map((app) =>
                    app.id === id ? { ...app, status } : app,
                  ),
                }
              : previous,
          )
        }
      />}

          <Button variant="outline" asChild><Link href={`/club/${membership.clubId}/workspace?section=recruitment&tool=${decisionsOnly ? "applicants" : "decisions"}`} onClick={event => { if (!canLeaveWorkspace()) event.preventDefault() }}>{decisionsOnly ? "Review applicants" : "Review decisions"}</Link></Button>
        </div>
      </section>
      </>}
      <div className="flex flex-wrap items-center gap-2">
        {!decisionsOnly && <div role="group" aria-label="Applicant view" className="flex rounded-md border bg-card p-1">{(["list", "kanban"] as const).map(mode => <Button key={mode} size="sm" variant={view === mode ? "secondary" : "ghost"} aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === "list" ? "List" : "Kanban"}</Button>)}</div>}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            ref={search}
            aria-label="Search applicants"
            placeholder="Name, anonymous ID, or major · /"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <details className="oc-pipeline-filters"><summary>Filters</summary><div className="oc-pipeline-filter-fields">
        <select
          aria-label="Filter round"
          className={selectStyle}
          value={round}
          onChange={(event) => { setRound(event.target.value); setGender(""); setShowGenderCounts(false) }}
        >
          <option value="">All rounds</option>
          {data.rounds.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {!decisionsOnly && <>
        <select
          aria-label="Filter status"
          className={selectStyle}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {Object.entries(applicationStatusLabels)
            .filter(([key]) => key !== "DRAFTING")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        <select
          aria-label="Filter review state"
          className={selectStyle}
          value={review}
          onChange={(event) => setReview(event.target.value)}
        >
          <option value="">All review states</option>
          <option value="unreviewed">No evaluations</option>
          <option value="mine">Reviewed by me</option>
        </select>
        <Button
          size="sm"
          variant="ghost"
          className="hidden xl:inline-flex"
          aria-pressed={compact}
          onClick={() => setCompact((value) => !value)}
        >
          {compact ? "Compact rows" : "Comfortable rows"}
        </Button>
        </>}
      {round && data?.rounds.find(r => r.id === round)?.genderVisible && <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>Gender <select aria-label="Filter gender" className={selectStyle} value={gender} onChange={e => setGender(e.target.value)}><option value="">All</option>{genderValues.map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="flex gap-2"><input type="checkbox" checked={showGenderCounts} onChange={e => setShowGenderCounts(e.target.checked)} />Show round gender composition</label>
        {showGenderCounts && data?.genderCounts && <dl className="flex flex-wrap gap-3">{data.genderCounts.map(c => <div key={c.gender ?? "unset"}><dt className="inline">{c.gender ?? "Not provided"}: </dt><dd className="inline">{c.count}</dd></div>)}</dl>}
      </div>}
      {!decisionsOnly && <section className="w-full text-sm"><h3 className="font-medium">Academic & review filters</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <select
            aria-label="Filter major"
            className={selectStyle}
            value={major}
            onChange={(event) => setMajor(event.target.value)}
          >
            <option value="">All majors</option>
            {[
              ...new Set(
                applicants.map((app) => app.student.studentProfile?.major).filter(Boolean),
              ),
            ]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
          <select
            aria-label="Filter academic year"
            className={selectStyle}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All years</option>
            {[
              ...new Set(
                applicants.flatMap((app) =>
                  app.student.studentProfile ? [app.student.studentProfile.academicYear] : [],
                ),
              ),
            ]
              .sort(compareAcademicYears)
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
          <div>
            <Label htmlFor="leader-gpa">GPA greater than</Label>
            <Input
              id="leader-gpa"
              className="mt-2 w-36"
              type="number"
              min={0}
              max={4}
              step="0.01"
              value={gpa}
              onChange={(event) => setGpa(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="leader-sat">SAT greater than</Label>
            <Input
              id="leader-sat"
              className="mt-2 w-36"
              type="number"
              min={0}
              max={1600}
              value={sat}
              onChange={(event) => setSat(event.target.value)}
            />
          </div>
        </div>
          <div className="mt-3"><Label htmlFor="leader-act">ACT greater than</Label><Input id="leader-act" type="number" min={1} max={36} className="mt-2 w-36" value={act} onChange={e => setAct(e.target.value)} /></div>
          <div className="mt-3"><Label htmlFor="leader-rating">Minimum rating (out of 10)</Label><Input id="leader-rating" type="number" min={0} max={10} step="0.1" className="mt-2 w-36" value={rating} onChange={event => setRating(event.target.value)} /></div>
      </section>}
        </div></details>
        <Button size="sm" variant="ghost" onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground" role="status">
          {filtered.length} {decisionsOnly ? "applications in this selection" : `of ${applicants.length} applicants · scores out of 10`}
        </p>
        {(query || round || status || review || major || year || gpa || sat || act || rating) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("")
              setRound("")
              setStatus("")
              setReview("")
              setMajor("")
              setYear("")
              setGpa("")
              setSat(""); setAct(""); setRating("")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Sort applicants <select aria-label="Sort applicants" className={selectStyle} value={sort} onChange={event => sortBy(event.target.value as ApplicantSort)}><option value="name">Name / anonymous ID</option><option value="year">Class year</option><option value="status">Status</option><option value="gpa">GPA</option><option value="sat">SAT</option><option value="act">ACT</option><option value="round">Round</option><option value="score">Rating</option></select></label><Button variant="ghost" size="sm" onClick={() => setDescending(value => !value)}>{descending ? "Descending ↓" : "Ascending ↑"}</Button></div>
      {view === "kanban" && <p className="text-xs leading-6 text-muted-foreground">Drag a candidate to another column or use Move to. Review the change before it is saved. Interview moves require an interview round.</p>}
      {rejectedOnly&&<p>Rejected applications are retained here with their reviews and decision history. Reconsideration returns an application to review; it does not change the student’s account or membership.</p>}
      {!filtered.length ? <p role="status" className="border-y py-10 text-sm text-muted-foreground">{applicants.length ? (decisionsOnly ? "No applications in this decision group match your filters." : "No applicants match these filters.") : rejectedOnly ? "No rejected applications. Published rejections appear here with their history preserved." : "Submitted applications will appear here. Student drafts stay private."}</p> : decisionsOnly ? <LiveDecisionList applicants={filtered} rounds={data.rounds} open={open} compact={compact} name={name} average={average} /> : view === "kanban" ? <LiveApplicantKanban canMove={canMove} move={(app, lane) => { setBoardError(""); setBoardMove({ id: app.id, lane }) }} busy={busy} applicants={filtered} rounds={data.rounds} open={open} compact={compact} name={name} average={average} /> : <LiveApplicantList sort={sort} descending={descending} sortBy={sortBy} applicants={filtered} rounds={data.rounds} open={open} compact={compact} name={name} average={average} />}
      </div>
      {preview && !active && !data.applications.length && <p role="alert">This applicant is no longer available. <Button onClick={preview.onClose}>Close preview</Button></p>}
      <Sheet
        open={!!active}
        onOpenChange={(value) => {
          if (!value) open()
        }}
      >
        <SheetContent
          className="oc-workspace-drawer oc-applicant-drawer w-full overflow-y-auto p-6 sm:max-w-[96vw]"
          onCloseAutoFocus={event => { if (previewId) { event.preventDefault(); requestAnimationFrame(() => (document.querySelector<HTMLElement>(`[data-applicant-id="${CSS.escape(previewId)}"]`) ?? document.getElementById("dashboard-reviews"))?.focus({ preventScroll: true })) } }}
          onInteractOutside={(event) => {
            if (dirty || busy) event.preventDefault()
          }}
        >
          {active && (
            <>
              {preview?.onNext && <Button variant="outline" disabled={busy} onClick={() => void (canEvaluate ? draftSave.flush() : Promise.resolve()).then(() => preview.onNext?.()).catch(() => {})}>Next assigned review</Button>}
              <div className="oc-applicant-drawer-scroll">
              <SheetHeader className="px-0 pr-10">
                <Avatar className="size-12">
                  <AvatarImage
                    src={profilePhotoSource(active.student.studentProfile?.headshotUrl)}
                    alt=""
                  />
                  <AvatarFallback>
                    {name(active)
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <SheetTitle
                  ref={heading}
                  tabIndex={-1}
                  className="oc-modal-title focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {name(active)}
                </SheetTitle>
                {active.studentId.startsWith("anonymous-") && hasPermission(membership, "applicants.identify") && <RevealApplicant canPrepare={hasPermission(membership, "recruitment.manage")} key={active.id} clubId={membership.clubId} applicationId={active.id} />}
                <SheetDescription>
                  {active.studentId.startsWith("anonymous-") ? "Anonymous review · identity and appointments withheld" : [active.student.studentProfile?.major || "Academic profile not provided", active.student.email].filter(Boolean).join(" · ")}
                </SheetDescription>
              </SheetHeader>
              {quickQueue && <div className="rounded-lg bg-secondary p-3 text-sm"><strong>Quick review · {quickQueue.length} remaining</strong><p className="mt-1 text-muted-foreground">Accept & next and Deny & next publish the decision immediately. Skip leaves the candidate unchanged.</p></div>}
              <div className="oc-applicant-profile-layout"><div className="min-w-0 space-y-6">
              {(interviewCapabilities(membership).readClosing || interviewCapabilities(membership).moderateResume) && <nav aria-label="Applicant interview records" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {([...(interviewCapabilities(membership).readClosing ? [{ tool: "reviews" as const, label: "Submitted reviews" }] : []), ...(interviewCapabilities(membership).moderateResume && !active.studentId.startsWith("anonymous-") ? [{ tool: "resumes" as const, label: "Résumé moderation" }] : [])]).map(item => <Link key={item.tool} className="inline-flex min-h-10 items-center underline" href={applicantInterviewHref(membership.clubId, item.tool, (() => { const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search); if (round) query.set("roundId", round); return query.toString(); })(), active.id)} onClick={e => { if (busy || dirty || !canLeaveWorkspace()) e.preventDefault(); }}>{item.label}</Link>)}
              </nav>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <Badge variant="secondary">{applicationStatusLabels[active.status]}</Badge>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous applicant"
                    disabled={busy || activeIndex <= 0}
                    onClick={() => open(filtered[activeIndex - 1])}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {activeIndex >= 0
                      ? `${activeIndex + 1} / ${filtered.length}`
                      : "Outside current filters"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next applicant"
                    disabled={busy || activeIndex < 0 || activeIndex >= filtered.length - 1}
                    onClick={() => open(filtered[activeIndex + 1])}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              <section className="space-y-3 border-b border-border pb-6">
                <h3 className="oc-card-heading ">Profile</h3>
                {active.student.studentProfile ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {active.student.studentProfile.academicYear}
                      {active.student.studentProfile.gpa != null &&
                        ` · GPA ${active.student.studentProfile.gpa}`}
                      {active.student.studentProfile.actScore != null && ` · ACT ${active.student.studentProfile.actScore}`}
                      {active.student.studentProfile.satScore != null &&
                        ` · SAT ${active.student.studentProfile.satScore}`}
                    </p>
                    <RecruitmentAttendanceSummary clubId={membership.clubId} applicationId={active.id} />
                    {active.student.studentProfile.experiences.map((item) => (
                      <div key={item.id} className="text-sm">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-muted-foreground">
                          {item.subtitle} · {item.period}
                        </p>
                      </div>
                    ))}
                    <div className="flex gap-4 text-sm">
                      {[
                        { label: "Résumé", url: active.student.studentProfile.resumeUrl, resolver: (url: string | null | undefined) => resolveRecruitingResumeUrl(url, membership.clubId, active.id) },
                        { label: "LinkedIn", url: active.student.studentProfile.linkedinUrl, resolver: safeProfileUrl },
                      ].map(
                        ({ label, url, resolver }) =>
                          resolver(url) && (
                            <a
                              key={label}
                              href={resolver(url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-4"
                            >
                              {label}
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          ),
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No profile provided.</p>
                )}
              </section>
              <section className="space-y-3 border-b pb-6" aria-label="Interview information"><h3 className="oc-card-heading ">Interviews</h3>{active.studentId.startsWith("anonymous-") ? <p className="text-sm text-muted-foreground">Appointments are withheld during anonymous review.</p> : active.bookings.length ? <ul className="divide-y">{active.bookings.map(booking => <li key={booking.id} className="py-3 text-sm"><p>{schedulingDateTime(booking.slot.startTime)} – {slotTime(booking.slot.endTime, SCHEDULING_TIMEZONE)}</p><p className="mt-1 text-muted-foreground">{booking.slot.location || "Location not provided"}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No interview booking recorded.</p>}</section>
              <section className="space-y-5 border-b border-border pb-6">
                <h3 className="oc-card-heading ">Application responses</h3>
                {active.answers.map((answer) => (
                  <div key={answer.id}>
                    <h4 className="text-sm font-medium leading-6">{answer.question.prompt}</h4>
                    {answer.question.type === "FILE_UPLOAD" && applicationAttachmentUrl(answer.response, active.id, answer.questionId) ? (
                      <a
                        className="mt-2 inline-block text-sm underline"
                        href={applicationAttachmentUrl(answer.response, active.id, answer.questionId)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open document (new tab)
                      </a>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">
                        {answer.response || "No response"}
                      </p>
                    )}
                  </div>
                ))}
                {!active.answers.length && (
                  <p className="text-sm text-muted-foreground">{active.studentId.startsWith("anonymous-") ? "Responses and files are withheld during anonymous review. Any prepared anonymous content appears in the profile above." : "No club-specific responses."}</p>
                )}
              </section>
              {hasPermission(membership, "applications.review") && <ApplicantDisplayPanel key={active.id} clubId={membership.clubId} applicationId={active.id} refreshKey={JSON.stringify(active.evaluations)} />}
              <section className="space-y-4 border-b border-border pb-6">
                <h3 className="oc-card-heading">Evaluations · score and overall feedback</h3>
                {active.evaluations.map((item) => (
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
                {!active.evaluations.length && (
                  <p className="text-sm text-muted-foreground">No evaluations yet.</p>
                )}
                {canEvaluate ? <form data-autosave-editor="true" onBlur={draftSave.onBlur}
                  onSubmit={(event) => {
                    event.preventDefault()
                    void mutate("review")
                  }}
                  className="space-y-3"
                >
                  <AutosaveStatus save={draftSave} />
                  <p className="text-sm font-medium">
                    Your review · {data.rounds.find((item) => item.id === active.roundId)?.name}
                  </p>
                  <Label htmlFor="review-score">Score (1–10)</Label>
                  <Input
                    id="review-score"
                    type="number"
                    required
                    min={1}
                    max={10}
                    step="any"
                    value={score}
                    disabled={busy || !draftSave.ready || draftSave.recovery != null}
                    onChange={(event) => setScore(event.target.value)}
                  />
                  <Label htmlFor="review-notes">Overall evaluation feedback</Label>
                  <Textarea
                    id="review-notes"
                    rows={4}
                    value={notes}
                    disabled={busy || !draftSave.ready || draftSave.recovery != null}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button disabled={busy || !hasPermission(membership, "applications.review")} type="submit">
                      {busy ? "Saving…" : "Finalize evaluation"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {dirty ? "Draft · not finalized" : score ? "Finalized review" : "No review finalized"}
                    </span>
                  </div>
                </form> : <p className="text-sm text-muted-foreground">Submitted evaluations are read-only. A new identified interview evaluation requires a current panel assignment; anonymous review requires review permission. You cannot evaluate your own application.</p>}
              </section>
              <section className="space-y-3">
                <h3 className="oc-card-heading ">Recruitment actions</h3>
                <Label htmlFor="move-round">Round</Label>
                <div className="flex flex-wrap gap-2">
                  <select
                    id="move-round"
                    className={selectStyle}
                    disabled={busy || dirty}
                    value={targetRound}
                    onChange={(event) => setTargetRound(event.target.value)}
                  >
                    {data.rounds.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    disabled={busy || dirty || ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(active.status) || targetRound === active.roundId || !hasPermission(membership, "recruitment.manage") || !hasPermission(membership, "applicants.identify")}
                    onClick={() => void mutate("round")}
                  >
                    Move round
                  </Button>
                </div>
            {active&&hasPermission(membership,"recruitment.manage")&&hasPermission(membership,"applicants.identify")&&!data.rounds.find(r=>r.id===active.roundId)?.anonymousReview&&<ApplicationCycleAssignment key={active.id+active.recruitmentCycleId} clubId={membership.clubId} applicationId={active.id} cycleId={active.recruitmentCycleId} onSaved={()=>setRevision(v=>v+1)}/>}
                <p className="text-xs leading-6 text-muted-foreground">
                  Final decisions cannot move rounds. Rejected Applicants provides explicit reconsideration; other final decisions can be corrected. Moving out of an interview round returns the applicant to review. Save your review before moving.
                </p>
      {rejectedOnly&&active&&hasPermission(membership,"decisions.manage")&&hasPermission(membership,"applicants.identify")&&<div className="space-y-2"><label>Reason for reconsideration (at least 10 characters)<textarea className="block w-full border rounded p-2" maxLength={1000} value={reconsiderReason} onChange={e=>setReconsiderReason(e.target.value)}/></label><Button disabled={busy||reconsiderReason.trim().length<10} onClick={async()=>{setBusy(true);try{await reconsiderRejectedApplication({clubId:membership.clubId,applicationId:active.id,expectedGuard:active.publicationGuard,reason:reconsiderReason});setReconsiderReason("");setActiveId(null);setRevision(v=>v+1);setMessage("Application returned to review. Historical decisions are preserved.")}catch{setMessage("Reconsideration failed. Refresh and check access.")}finally{setBusy(false)}}}>Reconsider selected application</Button></div>}
                {active.recruitmentOffer?.status === "ACCEPTED" && <p className="text-xs text-muted-foreground">This offer was accepted. Decision changes preserve membership; use member management for access changes.</p>}
                {active.status === "ACCEPTED" && active.recruitmentOffer?.status === "PENDING" && hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify") && <div className="space-y-2"><p className="text-xs text-muted-foreground">Only pending offers can be rescinded. Accepted memberships must be managed through member management.</p><Button variant="outline" disabled={busy || dirty} onClick={async()=>{setBusy(true);try{await revokeRecruitmentOffer(membership.clubId,active.id);setRevision(v => v + 1);setMessage("Pending offer rescinded.");preview?.onChanged()}catch{setMessage("Only pending offers can be rescinded. Manage existing members through member management.")}finally{setBusy(false)}}}>Rescind pending offer</Button></div>}
                {hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify") ? (
                  <div className="flex flex-wrap gap-2">
                    {(["IN_REVIEW", "INTERVIEWING", "WAITLISTED", "ACCEPTED", "REJECTED"] as const)
                      .filter((value) => value !== active.status && (value !== "INTERVIEWING" || isInterviewRecruitmentRound(data.rounds.find(r => r.id === active.roundId)?.type || "")) && (!["ACCEPTED", "REJECTED", "WAITLISTED"].includes(active.status) || ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(value)))
                      .map((value) => (
                        <Button
                          key={value}
                          variant="outline"
                          size="sm"
                          disabled={busy || dirty}
                          onClick={() => setDecision(value)}
                        >
                          {applicationStatusLabels[value]}
                        </Button>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Decision-management permission is required to change application status or issue decisions.
                  </p>
                )}
              </section>
              <p role="status" className="text-sm leading-6">{message}</p>
              <Button variant="ghost" disabled={busy} onClick={() => { if (dirty && !window.confirm("Discard your unsaved review and reload applicant data?")) return; setActiveId(null); setDecision(""); setRevision(v => v + 1) }}>Reload applicant data</Button>
              </div><aside className="oc-applicant-resume" aria-label="Applicant résumé">
                <h3 className="oc-card-heading">Résumé</h3>
                {active.studentId.startsWith("anonymous-") ? <p className="text-sm text-muted-foreground">Résumé withheld during anonymous review.</p> : resolveRecruitingResumeUrl(active.student.studentProfile?.resumeUrl, membership.clubId, active.id) ? <>
                  <a className="inline-flex min-h-11 items-center text-sm underline" href={resolveRecruitingResumeUrl(active.student.studentProfile?.resumeUrl, membership.clubId, active.id)} target="_blank" rel="noopener noreferrer">Open résumé in a new tab</a>
                  <iframe key={active.id} title={`Résumé for ${name(active)}`} src={resolveRecruitingResumeUrl(active.student.studentProfile?.resumeUrl, membership.clubId, active.id)} referrerPolicy="no-referrer" className="h-[70dvh] min-h-96 w-full rounded-lg border bg-muted" />
                </> : <p className="text-sm text-muted-foreground">No résumé provided.</p>}
              </aside></div>
              </div>
              {quickQueue && <div className="oc-applicant-review-footer flex flex-wrap items-center justify-end gap-3" role="group" aria-label="Quick review decisions">
                <Button variant="ghost" disabled={busy} onClick={() => { const remaining = quickQueue.filter(id => id !== active.id); const next = remaining.map(id => applicants.find(app => app.id === id)).find(app => app && pendingCandidate(app)); setQuickQueue(remaining); if (next) open(next); else open() }}>Skip</Button>
                <Button variant="outline" disabled={busy || !canDecide || !pendingCandidate(active) || !draftSave.ready || draftSave.recovery != null} onClick={() => void quickDecision("REJECTED")}>Deny & next</Button>
                <Button disabled={busy || !canDecide || !pendingCandidate(active) || !draftSave.ready || draftSave.recovery != null} onClick={() => void quickDecision("ACCEPTED")}>{busy ? "Saving…" : "Accept & next"}</Button>
              </div>}

            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={!!boardMove} onOpenChange={value => { if (!value && !busy) setBoardMove(null) }}><DialogContent><DialogHeader><DialogTitle>{boardMove?.lane === "closed" ? "Choose the final decision" : "Move this candidate?"}</DialogTitle><DialogDescription>{applicants.find(app => app.id === boardMove?.id) && name(applicants.find(app => app.id === boardMove?.id)!)} · This updates the applicant’s status. Final decisions are visible to the applicant and publish their decision notification.</DialogDescription></DialogHeader>
        {boardError && <p role="alert" className="text-sm text-destructive">{boardError}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setBoardMove(null)}>Cancel move</Button>{boardMove?.lane === "closed" ? <><Button variant="outline" disabled={busy} onClick={() => void confirmBoardMove("REJECTED")}>Deny candidate</Button><Button disabled={busy} onClick={() => void confirmBoardMove("ACCEPTED")}>Accept candidate</Button></> : <Button disabled={busy} onClick={() => void confirmBoardMove(boardMove?.lane === "interview" ? "INTERVIEWING" : boardMove?.lane === "decision" ? "WAITLISTED" : "IN_REVIEW")}>Confirm move</Button>}</div>
      </DialogContent></Dialog>
      <Dialog
        open={!!decision}
        onOpenChange={(value) => {
          if (!value && !busy) setDecision("")
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update application status?</DialogTitle>
            <DialogDescription>
              {active && name(active)} will see their application marked{" "}
              {applicationStatusLabels[decision]}. The applicant will see this status in OutClass.
              {["ACCEPTED","WAITLISTED","REJECTED"].includes(decision) && (demo.isDemoEnabled ? " A fictional letter and notification will be saved in Demo. No email is sent." : " Status and a notification publish with an optional formal letter according to club settings. Decision-availability email follows separate student preferences.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setDecision("")}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void mutate("decision")}>
              {busy ? "Updating…" : ["ACCEPTED","WAITLISTED","REJECTED"].includes(decision) ? "Send now" : "Confirm status"}
            </Button>
          </div>
            {active&&["ACCEPTED","WAITLISTED","REJECTED"].includes(decision)&&<ScheduleDecision clubId={membership.clubId} selection={{kind:"DIRECT",applicationId:active.id,expectedGuard:active.publicationGuard,status:decision as "ACCEPTED"|"WAITLISTED"|"REJECTED"}} disabled={busy} onScheduled={()=>setDecision("")}/>}
          {decision && message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
