"use client"
import { answerText } from "@/lib/student-applications"
import "@/components/product/operational-dashboard.css"
import { completePipelineSelection, type PipelinePageQuery, type PipelineCursor } from "@/lib/pipeline-page"
import { nextQuickReviewApplicant } from "@/lib/quick-review-queue"
import { usePipelinePage } from "@/hooks/use-pipeline-page"
import { usePipelineApplicant } from "@/hooks/use-pipeline-applicant"
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
import { ApplicantDisplayPanel } from "@/components/applicant-intelligence"
import { InterviewFeedbackPanel } from "@/components/interview-feedback"
import { applicationAttachmentUrl } from "@/lib/student-applications"
import { applicationDecisionGroup, decisionFilters, type DecisionFilter } from "@/lib/application-decisions"
import { type ApplicantSort } from "@/lib/live-applicant-sorting"
import { applicantLane } from "@/lib/applicant-board"
import { LiveApplicantList, LiveApplicantKanban, LiveDecisionList, applicantSortOptions, type ApplicantLane } from "./live-applicant-views"
import { useListSort } from "@/hooks/use-list-sort"
import { SortControl } from "@/components/ui/sort-control"
import { useDemoMode } from "@/contexts/demo-context"
import { ApplicantRecusal } from "@/components/applicant-recusal"
import { ClubExportLink } from "@/components/club-export-link"
import { RecruitmentAttendanceSummary } from "@/components/recruitment-attendance-summary"
import { RevealApplicant } from "@/components/reveal-applicant"
import { hasPermission } from "@/lib/permissions"
import { interviewCapabilities } from "@/lib/interview-access"
import { applicantInterviewHref } from "@/lib/applicant-interview-navigation"
import { useRouter } from "next/navigation"
import { saveVotingSelection,votingSetupHref,decisionsHref } from "@/lib/voting-navigation"
import { RankedReviewList, type RankedReviewApi } from "@/components/ranked-review-list"
import Link from "next/link"
import { canLeaveWorkspace } from "@/lib/product-navigation"

import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, Linkedin, MoreHorizontal } from "@/components/icons"
import { StatusPill } from "@/components/ui/status-pill"
import { PreviouslyAppliedBadge } from "@/components/previously-applied-badge"
import { joinFacts } from "@/lib/join-facts"
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary"
import { AdditionalObservations } from "@/components/additional-observations"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DisabledReason, ReviewSection } from "./applicant-quick-review"
import { createPortal } from "react-dom"
import { useRevalidate } from "@/hooks/use-revalidate"
import { BoardDecisionMode } from "@/components/live-voting/board-decision-mode"
import { getRankedReviewRound, getRankedReviewSettings, getRoundTargetSummary, saveRankedReviewBands } from "@/lib/workspace-api"
import { getClubPipelinePage, getClubPipelineSelection, moveApplicantRound, setApplicationStatus, reconsiderRejectedApplication, revokeRecruitmentOffer } from "@/lib/workspace-api"
import { submitEvaluation } from "@/lib/workspace-api"
import { useApplicationState } from "@/lib/application-state"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { DemoRoundTarget } from "@/components/demo-workspace"
import { resolveRecruitingResumeUrl, safeProfileUrl } from "@/lib/student-profile"
import { defaultProfileFieldVisibility, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { anonymousApplicantLabel } from "@/lib/anonymous-review"
import { ApplicantProfileFacts, applicantProfileFacts } from "./applicant-profile-facts"
import { ResumeViewerDialog } from "@/components/resume-viewer-dialog"
import { applicationStatusLabels } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
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
import { NativeSelect } from "@/components/ui/native-select"
import { SearchField } from "@/components/ui/search-field"
import { FilterPopover } from "@/components/ui/filter-popover"
import { PillSelect } from "@/components/ui/pill-select"
import { PillGroup } from "@/components/ui/segmented-control"
import { RangeSlider } from "@/components/ui/range-slider"
import { Toggle } from "@/components/ui/toggle"
import { pluralize } from "@/lib/copy/terms"

type Pipeline = Awaited<ReturnType<typeof getClubPipelinePage>>
type Candidate = Pipeline["applications"][number]
/** Pending decisions split into these stages (the old Status dropdown's remaining distinct choices). */
const pendingStatuses = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"] as const
/** Range filters keep their string state ("" = no minimum); sliders speak numbers. */
const numberFilter = (value: string) => value === "" || !Number.isFinite(Number(value)) ? null : Number(value)
const filterText = (value: number | null) => value === null ? "" : String(value)
const selectStyle =
  "h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
const name = (app: Candidate) =>
  app.student.studentProfile
    ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`
    : app.student.email
const average = (app: Candidate) =>
  app.roundScore?.average ?? null
/** Decision buttons name the action, not the resulting state. */
const decisionActionLabels: Record<"IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED", string> = { IN_REVIEW: "Return to review", INTERVIEWING: "Move to interview", WAITLISTED: "Waitlist", ACCEPTED: "Accept", REJECTED: "Not selected" }
/** The club workspace page header renders an element with this id in its action slot; page actions portal into it. */
const PAGE_HEADER_ACTIONS_ID = "workspace-page-actions"
const applicantSortKeys: readonly ApplicantSort[] = ["name", "year", "status", "gpa", "sat", "act", "round", "score"]
/** Numbers and class year read best from the top. */
const applicantSortsDescending = (key: ApplicantSort) => ["score", "gpa", "sat", "act", "year"].includes(key)
/** Sorting by a hidden profile field is not offered; its values are withheld by the server. */
const sortableByProfile = (key: ApplicantSort, fields: ProfileFieldVisibility) => key === "gpa" ? fields.gpa : key === "sat" ? fields.sat : key === "act" ? fields.act : key === "year" ? fields.academicYear : true

export function LiveLeaderWorkspace({ scoped = false, decisionsOnly = false, rejectedOnly = false, initialDecision = "all", initialData, onData, validatedInitialData = false }: { validatedInitialData?: boolean; scoped?: boolean; decisionsOnly?: boolean; rejectedOnly?: boolean; initialDecision?: DecisionFilter; initialData?: { clubId: string; pipeline: Pipeline }; onData?: (clubId: string, data: Pipeline | null) => void }) {
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
    <div className="oc-workspace-stack">
      {!scoped && <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recruitment workspace
          </p>
          <h2 className="oc-section-heading mt-2">{club.club.name}</h2>
        </div>
        {!scoped && clubs.length > 1 && (
          <PillSelect label="Recruiting club" active={false} value={club.clubId} onChange={(value) => setClubId(value)} options={clubs.map((item) => ({ value: item.clubId, label: item.club.name }))} />
        )}
      </div>}
      <ClubWorkspace key={club.clubId} membership={club} decisionsOnly={decisionsOnly} rejectedOnly={rejectedOnly} initialDecision={initialDecision} validatedInitialData={validatedInitialData} initialData={initialData?.clubId === club.clubId ? initialData.pipeline : null} onData={data => onData?.(club.clubId, data)} />
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

function ClubWorkspace({ membership, decisionsOnly = false, rejectedOnly = false, initialDecision = "all", initialData = null, onData, preview, validatedInitialData = false }: { validatedInitialData?: boolean; preview?: { applicationId: string; onClose: () => void; onChanged: () => void; onNext?: () => void }; membership: ExtendedMembership; decisionsOnly?: boolean; rejectedOnly?: boolean; initialDecision?: DecisionFilter; initialData?: Pipeline | null; onData?: (data: Pipeline | null) => void }) {
  const router=useRouter();
  const [votingSelection,setVotingSelection]=useState<string[]>([]);
  const previewId = preview?.applicationId
  const demo = useDemoMode()
  const { leaderFocus, clearLeaderFocus } = useApplicationState()
  const auth = useAuth()
  const { readAuthority, isReadAuthorityCurrent } = auth
  const authority = useMemo(() => ({ user: auth.user, readAuthority: auth.readAuthority, support: auth.isImpersonating, loading: auth.loading, membership, demoReady: demo.ready, demoEnabled: demo.isDemoEnabled }), [auth.user, auth.readAuthority, auth.isImpersonating, auth.loading, membership, demo.ready, demo.isDemoEnabled])
  const canStartVoting=hasPermission(membership,"applications.review")&&hasPermission(membership,"decisions.manage")&&hasPermission(membership,"decisions.start");
  useEffect(()=>setVotingSelection([]),[auth.user?.id,membership.id,demo.isDemoEnabled]);
  const votingChoice=canStartVoting&&!preview&&!rejectedOnly?{ids:votingSelection,toggle:(id:string)=>setVotingSelection(old=>old.includes(id)?old.filter(v=>v!==id):[...old,id])}:undefined;
  function startSelectedVoting(){if(!auth.user||!votingSelection.length||!canLeaveWorkspace())return;try{const key=saveVotingSelection(sessionStorage,{userId:auth.user.id,clubId:membership.clubId,demo:demo.isDemoEnabled,applicationIds:votingSelection});router.push(votingSetupHref(membership.clubId,demo.isDemoEnabled?"demo=1":"",key));}catch{setMessage("Could not retain the applicant selection in this tab. Allow session storage and retry.")}}
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [position, setPosition] = useState<{ key: string; cursor: PipelineCursor } | null>(null)
  const [round, setRound] = useState("")
  const [decisionGroup, setDecisionGroupState] = useState<DecisionFilter>(rejectedOnly ? "rejected" : initialDecision)
  // The decision filter lives in the URL (`decision=`), so Rejected and other groups are linkable.
  const setDecisionGroup = useCallback((value: DecisionFilter) => {
    setDecisionGroupState(value)
    // Stage pills subdivide Pending; another decision group leaves no stage to filter by.
    if (value !== "all" && value !== "pending") setStatus("")
    if (preview || typeof window === "undefined" || !window.location?.href || !window.history) return
    const url = new URL(window.location.href)
    if (value === "all") url.searchParams.delete("decision"); else url.searchParams.set("decision", value)
    window.history.replaceState(window.history.state, "", url)
  }, [preview])
  const [status, setStatus] = useState("")
  const [review, setReview] = useState("")
  const [major, setMajor] = useState("")
  const [year, setYear] = useState("")
  const [gpa, setGpa] = useState("")
  const [sat, setSat] = useState("")
  const [act, setAct] = useState("")
  const [rating, setRating] = useState("")
  const clearApplicantFilters = () => { setQuery(""); setRound(""); setStatus(""); setReview(""); setMajor(""); setYear(""); setGpa(""); setSat(""); setAct(""); setRating("") }
  const [compact, setCompact] = useState(false)
  const [view, setView] = useState<"list" | "kanban" | "ranked">("list")
  // Ranked review opens the same masked single-applicant review (with finalized interviewer feedback).
  const [rankedOpen, setRankedOpen] = useState<string | null>(null)
  const [rankedChanged, setRankedChanged] = useState(0)
  const rankedApi = useMemo<RankedReviewApi>(() => ({
    loadRound: roundId => getRankedReviewRound(membership.clubId, roundId),
    loadSettings: roundId => getRankedReviewSettings(membership.clubId, roundId),
    saveBands: input => saveRankedReviewBands(input),
    loadRoundSummary: input => getRoundTargetSummary({ clubId: membership.clubId, ...input }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- a new authority (account, demo, impersonation) must reload the ranking
  }), [membership.clubId, authority])
  const [gender, setGender] = useState("")
  const [showGenderCounts, setShowGenderCounts] = useState(false)
  // One sort for headers, the toolbar control and the server read; kept in the URL (?sort=&order=).
  const listSort = useListSort(applicantSortKeys, "name", applicantSortsDescending)
  const { key: sort, descending } = listSort
  const [activeId, setActiveId] = useState<string | null>(null)
  const [writing, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [reconsiderReason, setReconsiderReason] = useState("")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState("")
  const [decision, setDecision] = useState("")
  const [targetRound, setTargetRound] = useState("")
  // Quick review (default) or the full profile layout; collapsed sections and their counts.
  const [fullProfile, setFullProfile] = useState(false)
  const [openSections, setOpenSections] = useState<string[]>([])
  const [notesCount, setNotesCount] = useState<number | "error" | null>(null)
  const [prosSummary, setProsSummary] = useState<{ count: number; canAdd: boolean } | "error" | null>(null)
  const [observationCount, setObservationCount] = useState<number | null>(null)
  const [panel, setPanel] = useState<"round" | "cycle" | "reconsider" | null>(null)
  const [quickQueue, setQuickQueue] = useState<string[] | null>(null)
  const [boardMove, setBoardMove] = useState<{ id: string; lane: ApplicantLane } | null>(null)
  const [boardError, setBoardError] = useState("")
  const mutating = useRef(false)
  // Bumped whenever a write starts, so a background read that began earlier never lands after it.
  const mutationEpoch = useRef(0), revalidateTicket = useRef(0)
  const [revalidateFailures, setRevalidateFailures] = useState(0)
  const detail = usePipelineApplicant(membership.clubId, previewId || null, revision)
  const readQuery = useMemo<PipelinePageQuery>(() => ({
    query, mode: "decisions", decisionGroup,
    ...(round ? { roundId: round } : {}), ...(gender ? { gender: gender as (typeof genderValues)[number] } : {}), genderCounts: showGenderCounts,
    ...(status ? { status: status as PipelinePageQuery["status"] } : {}), ...(review ? { review: review as PipelinePageQuery["review"] } : {}),
    ...(major ? { major } : {}), ...(year ? { year } : {}),
    ...(gpa ? { gpa: Number(gpa) } : {}), ...(sat ? { sat: Number(sat) } : {}), ...(act ? { act: Number(act) } : {}), ...(rating ? { rating: Number(rating) } : {}), sort, descending,
  }), [query, decisionGroup, round, gender, showGenderCounts, status, review, major, year, gpa, sat, act, rating, sort, descending])
  const selectionKey = JSON.stringify([membership.clubId, membership.id, membership.userId, readQuery])
  const cursor = position?.key === selectionKey ? position.cursor : undefined
  // A changed filter starts a new selection. Clearing that filter later must
  // not resurrect the previous selection's page cursor.
  useEffect(() => { if (position && position.key !== selectionKey) setPosition(null) }, [position, selectionKey])
  const pageQuery = useMemo(() => ({ ...readQuery, ...(cursor ? { cursor } : {}) }), [readQuery, cursor])
  const { data: listData, loading: listLoading, ready, invalid: invalidFilter, error: readError, setData, acceptPage, isCurrent } = usePipelinePage({
    clubId: membership.clubId, reviewerId: membership.id, userId: membership.userId, query: pageQuery, revision, authority,
    enabled: !previewId && demo.ready && !auth.loading && !!auth.user, initialData, validatedInitialData,
  })
  const latestAuthority = useRef(authority); latestAuthority.current = authority
  const requestKey = JSON.stringify([selectionKey, cursor, revision])
  const latestRequest = useRef(requestKey); latestRequest.current = requestKey
  const pageReady = !!previewId || ready
  const updating = !previewId && (!pageReady && !invalidFilter || !listData)
  const busy = writing || updating || invalidFilter
  const data = previewId ? detail.pipeline : listData
  const loading = previewId ? !detail.pipeline && !detail.error : listLoading
  // Page actions join the workspace page header when it provides a slot; otherwise they render inline.
  // Re-resolved after every commit (state changes only when the element does), so a remounted
  // header never leaves the portal on a detached node. A layout effect places it before paint.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null | undefined>(undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally every commit; setState bails out when the slot is unchanged
  useLayoutEffect(() => {
    const slot = typeof document === "undefined" ? null : document.getElementById(PAGE_HEADER_ACTIONS_ID)
    setActionSlot(slot)
  })
  // Keep the list current without a Refresh button: re-read the current page in place (rows stay
  // visible) on return to the tab and after applicant/decision changes elsewhere. Paused while an
  // applicant is open or a write is running so a background read never replaces a review in progress.
  const revalidate = useCallback(async () => {
    if (mutating.current || !isCurrent()) return
    const epoch = mutationEpoch.current, ticket = ++revalidateTicket.current
    const landed = () => !mutating.current && epoch === mutationEpoch.current && ticket === revalidateTicket.current && isCurrent()
    try {
      const refreshed = await getClubPipelinePage(membership.clubId, pageQuery)
      if (landed() && setData(refreshed)) setRevalidateFailures(0)
    } catch {
      // Keep the current rows; repeated failures surface a quiet Try again below.
      if (landed()) setRevalidateFailures(count => count + 1)
    }
  }, [membership.clubId, pageQuery, isCurrent, setData])
  useRevalidate(revalidate, { scopes: ["applicants", "decisions"], events: ["outclass:decision-schedules"], enabled: !previewId && !activeId && !writing && ready })
  const publish = useRef(onData)
  publish.current = onData
  useEffect(() => { if (!previewId) publish.current?.(pageReady ? listData : null) }, [listData, pageReady, previewId])
  const roundsForReview = useRef(data?.rounds)
  roundsForReview.current = data?.rounds
  const heading = useRef<HTMLHeadingElement>(null)
  // Everything inside the Filters menu, so its summary can show how many apply.
  const menuFilters = [round, review, gender, major, year, gpa, sat, act, rating].filter(Boolean).length
  const clearMenuFilters = () => { setRound(""); setReview(""); setGender(""); setShowGenderCounts(false); setMajor(""); setYear(""); setGpa(""); setSat(""); setAct(""); setRating("") }
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => { setError(""); setRevalidateFailures(0) }, [authority, revision, pageQuery])
  const selectionRequestKey = JSON.stringify([selectionKey, revision])
  const latestSelectionRequest = useRef(selectionRequestKey); latestSelectionRequest.current = selectionRequestKey
  const loadSelection = useCallback(async (snapshot = listData) => {
    if (!isReadAuthorityCurrent(readAuthority) || latestAuthority.current !== authority || latestSelectionRequest.current !== selectionRequestKey) throw new Error("Applicant selection changed")
    const result = snapshot?.coverage?.complete
      ? completePipelineSelection(snapshot, readQuery, membership.id, membership.userId)
      : await getClubPipelineSelection(membership.clubId, readQuery)
    if (!isReadAuthorityCurrent(readAuthority) || latestAuthority.current !== authority || latestSelectionRequest.current !== selectionRequestKey) throw new Error("Applicant selection changed")
    return result.applications
  }, [membership.clubId, membership.id, membership.userId, listData, readQuery, authority, selectionRequestKey, readAuthority, isReadAuthorityCurrent])
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
  const applicants = data?.applications || []
  const filtered = applicants
  const pageInfo = !previewId ? listData?.page : undefined
  const total = pageInfo?.total ?? filtered.length
  const baseTotal = pageInfo?.baseTotal ?? applicants.length
  const displayed = { items: pageReady ? filtered : [], page: pageInfo?.index ?? 0, count: pageInfo?.count ?? 1, start: pageInfo?.start ?? 0 }
  function changePage(next: PipelineCursor | null) {
    if (!next || busy) return
    focusPage.current = true
    setPosition({ key: selectionKey, cursor: next })
  }
  const workspaceElement = useRef<HTMLDivElement>(null)
  const focusPage = useRef(false)
  useEffect(() => {
    if (!focusPage.current || !pageReady) return
    focusPage.current = false
    if (activeId) return
    const frame = requestAnimationFrame(() => Array.from(workspaceElement.current?.querySelectorAll<HTMLButtonElement>("[data-applicant-id]") ?? []).find(button => button.getClientRects().length > 0)?.focus())
    return () => cancelAnimationFrame(frame)
  }, [displayed.page, activeId, pageReady])
  const previewOpened = useRef(false), previewOpen = useRef<(app: Candidate) => void>(() => {})
  useEffect(() => {
    if (!previewId || !data || loading || previewOpened.current) return
    const target = data.applications.find(app => app.id === previewId)
    if (target) { previewOpened.current = true; previewOpen.current(target) }
  }, [previewId, data, loading])
  const active = activeId ? previewId ? detail.application : pageReady ? listData?.applications.find(app => app.id === activeId) ?? null : null : null
  // The club's profile field choice. Hidden values are already removed on the server; this hides their labels.
  const profileFields = data?.profileFields ?? defaultProfileFieldVisibility()
  const dossierName = (app: Candidate) => profileFields.name || app.studentId.startsWith("anonymous-") ? name(app) : anonymousApplicantLabel(app.id)
  const resumeHref = (url: string | null | undefined) => active ? resolveRecruitingResumeUrl(url, membership.clubId, active.id) : undefined
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
      if (target) { setDecisionGroup("all"); open(target) }
    }
    clearLeaderFocus()
  }, [data, loading, leaderFocus, membership.clubId, clearLeaderFocus, setDecisionGroup])
  function open(app?: Pick<Candidate, "id" | "roundId">, located = false) {
    if (busy) return
    const apply = () => {
    setActiveId(app?.id || null)
    if (app && !located && !previewId && pageInfo && !filtered.some(item => item.id === app.id)) {
      setPosition({ key: selectionKey, cursor: { id: app.id, direction: "at", scope: pageInfo.scope } })
    }
    if (!app) { setQuickQueue(null); preview?.onClose() }
    setMessage("")
    setDecision("")
    if (app) {
      setScore("")
      setNotes("")
      setBaseline(JSON.stringify(["", ""]))
      setTargetRound(app.roundId)
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
  async function navigateApplicant(direction: -1 | 1) {
    if (busy || mutating.current || activeIndex < 0) return
    const adjacent = filtered[activeIndex + direction]
    if (adjacent) { open(adjacent); return }
    const next = direction === 1 ? pageInfo?.next : pageInfo?.previous
    if (!next) return
    mutating.current = true; mutationEpoch.current++; setBusy(true)
    try {
      if (canEvaluate && (draftSave.dirty || draftSave.saving)) await draftSave.flush()
      if (!isCurrent()) return
      const nextQuery = { ...readQuery, cursor: next }
      const adjacentPage = await getClubPipelinePage(membership.clubId, nextQuery)
      if (!acceptPage(adjacentPage, nextQuery)) return
      setPosition({ key: selectionKey, cursor: next })
      const target = direction === 1 ? adjacentPage.applications[0] : adjacentPage.applications.at(-1)
      if (target) open(target, true)
    } catch { setMessage("Couldn’t load the next applicant. Your review stays open.") }
    finally { mutating.current = false; setBusy(false) }
  }

  useEffect(() => {
    if (!active) return
    const mine = findReviewerEvaluation(active.evaluations, membership.id, roundsForReview.current?.find(item => item.id === active.roundId))
    const value = mine ? String(mine.score) : ""
    setScore(value)
    setNotes(mine?.notes || "")
    setBaseline(JSON.stringify([value, mine?.notes || ""]))
    setTargetRound(active.roundId)
    requestAnimationFrame(() => heading.current?.focus())
  }, [active, membership.id])
  previewOpen.current = open
  async function mutate(kind: "review" | "round" | "decision") {
    if (!active || mutating.current) return
    if (kind === "review" && (!score || Number(score) < 1 || Number(score) > 10)) {
      setMessage("Enter a score from 1 to 10 before saving your evaluation.")
      return
    }
    mutating.current = true; mutationEpoch.current++
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

        await draftSave.clear()
        setBaseline(JSON.stringify([score, notes]))
        setMessage("Evaluation saved.")
        setRevision(value => value + 1)
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
      if (!isCurrent()) throw new Error("Applicant scope changed")
      const refreshed = await getClubPipelinePage(membership.clubId, pageQuery)
      if (!setData(refreshed)) throw new Error("Applicant scope changed")
      return refreshed
    } catch (error) {
      if (!isCurrent()) throw error
      setData(null); setActiveId(null); setQuickQueue(null)
      setError("The status was saved, but applicants could not be refreshed. Reload to check current data and access.")
      throw error
    }
  }
  async function confirmBoardMove(status: "IN_REVIEW" | "INTERVIEWING" | "WAITLISTED" | "ACCEPTED" | "REJECTED") {
    const app = applicants.find(candidate => candidate.id === boardMove?.id)
    if (!app || !boardMove || !canMove(app, boardMove.lane) || mutating.current) return
    mutating.current = true; mutationEpoch.current++; setBusy(true); setBoardError("")
    try { await writeStatus(app, status); setBoardMove(null) }
    catch { setBoardError("This move could not be saved. Check your current access, then try again.") }
    finally { mutating.current = false; setBusy(false) }
  }
  async function quickDecision(status: "ACCEPTED" | "REJECTED") {
    if (!active || !canDecide || !pendingCandidate(active) || mutating.current || !quickQueue) return
    mutating.current = true; mutationEpoch.current++; setBusy(true); setMessage("")
    try {
      if (canEvaluate && (draftSave.dirty || draftSave.saving)) await draftSave.flush()
      const refreshed = await writeStatus(active, status)
      const remaining = quickQueue.filter(id => id !== active.id)
      const selection = await loadSelection(refreshed)
      const next = nextQuickReviewApplicant(remaining, selection)
      setQuickQueue(remaining)
      // Release the guard before opening the next profile; identity comes from the refreshed projection.
      mutating.current = false; setBusy(false)
      if (next) open(next)
      else { setActiveId(null); setQuickQueue(null); setMessage("Quick review complete.") }
    } catch { setMessage("This decision could not be saved. The candidate stays open. Check your access before retrying.") }
    finally { mutating.current = false; setBusy(false) }
  }
  async function startQuickReview() {
    if (!canDecide || busy || mutating.current) return
    const owner = authority, key = requestKey
    mutating.current = true; mutationEpoch.current++; setBusy(true); setMessage("")
    try {
      const queue = (await loadSelection()).filter(app => app.canQuickReview)
      if (!isCurrent() || latestAuthority.current !== owner || latestRequest.current !== key) return
      setQuickQueue(queue.map(app => app.id))
      if (queue[0]) open(queue[0])
    } catch { setMessage("Couldn’t load the complete review selection. Please try again.") }
    finally { mutating.current = false; setBusy(false) }
  }
  async function skipQuickReview() {
    if (!active || !quickQueue || busy || mutating.current) return
    const owner = authority, key = requestKey
    mutating.current = true; mutationEpoch.current++; setBusy(true)
    try {
      if (canEvaluate && (draftSave.dirty || draftSave.saving)) await draftSave.flush()
      const remaining = quickQueue.filter(id => id !== active.id)
      const selection = await loadSelection()
      if (!isCurrent() || latestAuthority.current !== owner || latestRequest.current !== key) return
      const next = nextQuickReviewApplicant(remaining, selection)
      setQuickQueue(remaining)
      if (next) open(next)
      else open()
    } catch { setMessage("Couldn’t refresh the complete review selection. Your review stays open.") }
    finally { mutating.current = false; setBusy(false) }
  }
  const sortBy = listSort.toggle
  useEffect(() => { setNotesCount(null); setProsSummary(null); setObservationCount(null); setPanel(null) }, [activeId])
  // ←/→ move between applicants while the review is open (Esc closes it). Ignored while typing or in a menu.
  const navigateRef = useRef(navigateApplicant); navigateRef.current = navigateApplicant
  useEffect(() => {
    if (!activeId) return
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="menu"], [role="listbox"], [role="slider"], [role="tablist"], [role="radiogroup"], iframe')) return
      // Another dialog over the review (confirm decision, move round) keeps the arrows.
      if (document.querySelector('[role="alertdialog"][data-state="open"]') || document.querySelectorAll('[role="dialog"][data-state="open"]').length > 1) return
      event.preventDefault()
      void navigateRef.current(event.key === "ArrowLeft" ? -1 : 1)
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [activeId])
  const votingBarShown = !!votingChoice && votingSelection.length > 0 && !activeId
  // The list clears the floating bar by its measured height (it wraps on phones), so no row is ever covered.
  const votingBar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const bar = votingBar.current
    if (!votingBarShown || !bar) return
    const root = document.documentElement
    const measure = () => root.style.setProperty("--oc-voting-bar-height", `${Math.ceil(bar.getBoundingClientRect().height)}px`)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(bar)
    return () => { observer.disconnect(); root.style.removeProperty("--oc-voting-bar-height") }
  }, [votingBarShown])
  if (loading) return <WorkspaceLoading label="Preparing your applicant pipeline…" layout="applicants" rows={5} />
  if (!data || error || readError)
    return (
      <div role="alert" className="space-y-3">
        <p>{error || (readError ? "Couldn’t load this club’s applicants. Your access may have changed." : previewId && detail.error ? "Couldn’t load this applicant. Your access may have changed." : "No data available.")}</p>
        <Button variant="outline" onClick={() => { setError(""); setPosition(null); setRevision((value) => value + 1) }}>
          Try again
        </Button>
      </div>
    )
  return (
    <div ref={workspaceElement} className="oc-live-pipeline oc-workspace-stack" data-unsaved={draftSave.dirty} data-saving={busy}>
      <div hidden={!!preview} className={votingBarShown ? "oc-voting-bar-clearance" : undefined}>
      {!active && message && <p role="status" className="text-sm">{message}</p>}
      {!preview && view !== "ranked" && <SegmentedControl label="Decision" value={decisionGroup} onChange={value => setDecisionGroup(value as DecisionFilter)} options={decisionFilters.map(group => ({ value: group.id, label: group.label, count: group.id === "all" ? listData?.page.baseTotal ?? 0 : listData?.facets.decisions[group.id] ?? 0 }))} />}
      {!preview && view !== "ranked" && !decisionsOnly && (decisionGroup === "all" || decisionGroup === "pending") && <SegmentedControl label="Pending stage" size="compact" value={status} onChange={setStatus}
        options={[{ value: "", label: decisionGroup === "pending" ? "All pending" : "All stages" }, ...pendingStatuses.map(key => ({ value: key, label: applicationStatusLabels[key] }))]} />}
{!rejectedOnly && !preview && actionSlot !== undefined && (() => {
        const actions = <div role="group" aria-label="Recruitment review" className="flex flex-wrap items-center justify-end gap-2">
          {!decisionsOnly && canDecide && <Button variant="outline" disabled={busy || !listData?.facets.quickReview} onClick={() => void startQuickReview()}>Quick review</Button>}
        </div>
        return actionSlot ? createPortal(actions, actionSlot) : actions
      })()}
      <div className="oc-toolbar">
        {!decisionsOnly && <SegmentedControl label="Applicant view" value={view} onChange={setView} options={[{ value: "list", label: "List" }, { value: "kanban", label: "Kanban" }, { value: "ranked", label: "Ranked" }]} />}
        {!decisionsOnly && <ClubExportLink clubId={membership.clubId} kind="applicants" membership={membership} label="Export CSV" />}
        {view !== "ranked" && <><SearchField
            ref={search}
            aria-label="Search applicants"
            placeholder="Name, anonymous ID, or major"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            shortcut="/"
            shortcutListener={false}
            containerClassName="min-w-0 flex-1 basis-60"
          />
        {/* Sort at every width; the table's column headers drive the same state. */}
        <SortControl label="Sort applicants" options={applicantSortOptions.filter(option => sortableByProfile(option.key, profileFields))} value={sort} descending={descending} descendingByDefault={applicantSortsDescending} onChange={listSort.set} />
        <FilterPopover count={menuFilters} title="Applicant filters"
          footer={<><Button variant="ghost" size="sm" disabled={!menuFilters} onClick={clearMenuFilters}>Clear filters</Button>{view === "list" && <Button size="sm" variant="ghost" aria-pressed={compact} onClick={() => setCompact((value) => !value)}>Compact rows</Button>}</>}>
        <div className="oc-filter-field"><span className="oc-filter-field-label">Round</span>
          <PillGroup label="Filter round" size="compact" value={round} onChange={value => { setRound(value); setGender(""); setShowGenderCounts(false) }}
            options={[{ value: "", label: "All rounds" }, ...data.rounds.map(item => ({ value: item.id, label: item.name }))]} />
        </div>
        {!decisionsOnly && <div className="oc-filter-field"><span className="oc-filter-field-label">Review state</span>
          <PillGroup label="Filter review state" size="compact" value={review} onChange={setReview}
            options={[{ value: "", label: "All review states" }, { value: "unreviewed", label: "No evaluations" }, { value: "mine", label: "Reviewed by me" }]} />
        </div>}
      {round && data?.rounds.find(r => r.id === round)?.genderVisible && <div className="oc-filter-field"><span className="oc-filter-field-label">Gender</span>
        <PillGroup label="Filter gender" size="compact" value={gender} onChange={setGender} options={[{ value: "", label: "All" }, ...genderValues.map(v => ({ value: v, label: v }))]} />
        <Toggle label="Show round gender composition" checked={showGenderCounts} onCheckedChange={setShowGenderCounts} />
        {showGenderCounts && data?.genderCounts && <dl className="flex flex-wrap gap-3 text-sm">{data.genderCounts.map(c => <div key={c.gender ?? "unset"}><dt className="inline">{c.gender ?? "Not provided"}: </dt><dd className="inline">{c.count}</dd></div>)}</dl>}
      </div>}
      {!decisionsOnly && <section className="oc-filter-field" aria-labelledby="leader-academic-filters"><h3 id="leader-academic-filters" className="oc-filter-field-label">Academic & review filters</h3>
          {profileFields.major && <PillSelect label="Filter major" allLabel="All majors" value={major} onChange={setMajor} options={(listData?.facets.majors ?? []).map(value => ({ value, label: value }))} />}
          {profileFields.academicYear && <PillGroup label="Filter academic year" size="compact" value={year} onChange={setYear}
            options={[{ value: "", label: "All years" }, ...(listData?.facets.years ?? []).map(value => ({ value, label: value }))]} />}
          {profileFields.gpa && <RangeSlider label="GPA greater than" min={0} max={4} step={0.01} value={numberFilter(gpa)} onChange={value => setGpa(filterText(value))} />}
          {profileFields.sat && <RangeSlider label="SAT greater than" min={400} max={1600} step={10} value={numberFilter(sat)} onChange={value => setSat(filterText(value))} />}
          {profileFields.act && <RangeSlider label="ACT greater than" min={1} max={36} step={1} value={numberFilter(act)} onChange={value => setAct(filterText(value))} />}
          <RangeSlider label="Minimum rating (out of 10)" min={0} max={10} step={0.1} value={numberFilter(rating)} onChange={value => setRating(filterText(value))} />
      </section>}
        </FilterPopover></>}
      </div>
      {view === "ranked" ? <RankedReviewList clubId={membership.clubId} rounds={data.rounds} initialRoundId={round || data.rounds.find(item => isInterviewRecruitmentRound(item.type))?.id} api={rankedApi} onOpen={setRankedOpen} votingSelection={votingChoice} changeSignal={rankedChanged}
        votingLink={hasPermission(membership, "applications.review") ? <Button variant="outline" size="sm" asChild><Link href={decisionsHref(membership.clubId, "voting", demo.isDemoEnabled ? "demo=1" : "")}>Open Voting room</Link></Button> : undefined} /> : <>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3">
        <p className="text-xs text-muted-foreground" role="status">
          {decisionsOnly ? `${pluralize(total, "application")} in this selection` : `${total} of ${pluralize(baseTotal, "applicant")} · scores out of 10`}
        </p>
        {(query || round || status || review || major || year || gpa || sat || act || rating) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearApplicantFilters}
          >
            Clear filters
          </Button>
        )}
        {revalidateFailures >= 2 && <p role="status" className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">Couldn’t update applicants. Showing the last loaded list.<Button variant="ghost" size="sm" disabled={busy} onClick={() => void revalidate()}>Try again</Button></p>}
      </div>
      {view === "kanban" && <p className="text-xs leading-6 text-muted-foreground">Drag a candidate to another column or use Move to. Review the change before it is saved. Interview moves require an interview round.</p>}
      {decisionGroup==="rejected"&&<p className="text-sm text-muted-foreground">Rejected applications keep their reviews and decision history. Open one to reconsider it; that returns it to review and does not change the student’s account or membership.</p>}
      {invalidFilter ? <p role="alert">Enter filters within the displayed numeric ranges.</p> : updating ? <p role="status" aria-live="polite">Updating applicants…</p> : !filtered.length ? <div role="status" className="space-y-3 border-y py-10 text-sm text-muted-foreground"><p>{baseTotal ? (decisionsOnly ? "No applications in this decision group match your filters." : "No applicants match these filters.") : rejectedOnly ? "No applications have been rejected. Published rejections appear here with their history preserved." : decisionsOnly ? "No applications are waiting for a decision." : "No one has submitted an application yet. Student drafts stay private until they submit."}</p>{baseTotal ? <Button variant="outline" size="sm" onClick={clearApplicantFilters}>Clear filters</Button> : <Button variant="outline" size="sm" asChild><Link href={rejectedOnly || decisionsOnly ? `/club/${encodeURIComponent(membership.clubId)}/workspace?section=recruitment&tool=applicants` : `/club/${encodeURIComponent(membership.clubId)}/workspace?section=settings&setting=application`}>{rejectedOnly || decisionsOnly ? "View all applicants" : "Review your application form"}</Link></Button>}</div> : decisionsOnly ? <LiveDecisionList sort={sort} descending={descending} sortBy={sortBy} applicants={displayed.items} rounds={data.rounds} open={open} compact={compact} name={name} average={average} /> : view === "kanban" ? <LiveApplicantKanban votingSelection={votingChoice} canMove={canMove} move={(app, lane) => { setBoardError(""); setBoardMove({ id: app.id, lane }) }} busy={busy} laneCounts={listData?.facets.lanes} applicants={displayed.items} rounds={data.rounds} open={open} compact={compact} name={name} average={average} /> : <LiveApplicantList profileFields={profileFields} votingSelection={votingChoice} sort={sort} descending={descending} sortBy={sortBy} applicants={displayed.items} rounds={data.rounds} open={open} compact={compact} name={name} average={average} />}
      {displayed.count > 1 && <nav aria-label="Applicant pages" className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" aria-label="Previous applicant page" disabled={busy || !pageInfo?.previous} onClick={() => changePage(pageInfo?.previous ?? null)}>Previous page</Button>
        <p role="status" className="text-sm">Page {displayed.page + 1} of {displayed.count} · Showing {displayed.start + 1}–{displayed.start + displayed.items.length} of {total}</p>
        <Button variant="outline" aria-label="Next applicant page" disabled={busy || !pageInfo?.next} onClick={() => changePage(pageInfo?.next ?? null)}>Next page</Button>
      </nav>}
      </>}
      {votingBarShown && <div ref={votingBar} role="region" aria-label="Voting selection" className="oc-voting-bar fixed inset-x-4 bottom-[var(--oc-toast-offset,1.5rem)] z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-lg border bg-card p-2 pl-4 shadow-lg">
        <span className="text-sm" role="status">{votingSelection.length} selected</span>
        <Button size="sm" disabled={busy} onClick={startSelectedVoting}>Start voting with selected applicants</Button>
        <Button size="sm" variant="ghost" onClick={() => setVotingSelection([])}>Clear selection</Button>
      </div>}
      </div>
      {preview && !active && !data.applications.length && <p role="alert">This applicant is no longer available. <Button onClick={preview.onClose}>Close preview</Button></p>}
      {!preview && view === "ranked" && rankedOpen && <ApplicantReviewPreview key={rankedOpen} clubId={membership.clubId} applicationId={rankedOpen} onClose={() => setRankedOpen(null)} onChanged={() => setRankedChanged(value => value + 1)} />}
      <Sheet
        open={!!activeId}
        onOpenChange={(value) => {
          if (!value) open()
        }}
      >
        <SheetContent
          data-layout={fullProfile ? "full" : "quick"}
          className="oc-workspace-drawer oc-applicant-drawer w-full p-0"
          onCloseAutoFocus={event => { if (previewId) { event.preventDefault(); requestAnimationFrame(() => (Array.from(document.querySelectorAll<HTMLElement>(`[data-applicant-id="${CSS.escape(previewId)}"]`)).find(element => element.getClientRects().length > 0) ?? document.getElementById("dashboard-reviews"))?.focus({ preventScroll: true })) } }}
          onInteractOutside={(event) => {
            if (dirty || busy) event.preventDefault()
          }}
        >
          {activeId && !active && <div className="oc-applicant-drawer-scroll">
            <SheetHeader><SheetTitle>Applicant review</SheetTitle><SheetDescription>{detail.error ? "This applicant could not be loaded. Your access may have changed." : "Loading applicant…"}</SheetDescription></SheetHeader>
            {detail.error && <div role="alert"><Button variant="outline" onClick={detail.retry}>Retry applicant</Button></div>}
          </div>}
          {active && (() => {
            const anonymousActive = active.studentId.startsWith("anonymous-")
            const profile = active.student.studentProfile
            const activeRound = data.rounds.find(item => item.id === active.roundId)
            const resumeUrl = anonymousActive || !profileFields.resume ? undefined : resolveRecruitingResumeUrl(profile?.resumeUrl, membership.clubId, active.id)
            const linkedinUrl = anonymousActive || !profileFields.linkedin ? undefined : safeProfileUrl(profile?.linkedinUrl)
            const canReview = hasPermission(membership, "applications.review")
            const canManageRecruitment = hasPermission(membership, "recruitment.manage") && hasPermission(membership, "applicants.identify")
            const finalStatus = ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(active.status)
            // Matches the server's eligibility rule, so the panel never asks for observations it will refuse.
            const observationsEligible = canReview && hasPermission(membership, "applicants.identify") && !anonymousActive && !!active.recruitmentCycleId && active.studentId !== membership.userId && !activeRound?.anonymousReview && active.status !== "DRAFTING"
            const evaluateReason = canEvaluate ? "" : active.studentId === membership.userId ? "You can’t evaluate your own application." : anonymousActive ? "Anonymous review requires review permission." : "Submitted evaluations are read-only. A current panel assignment is required to evaluate this applicant."
            const decisionOptions = canDecide ? (["IN_REVIEW", "INTERVIEWING", "WAITLISTED", "ACCEPTED", "REJECTED"] as const).filter((value) => value !== active.status && (value !== "INTERVIEWING" || isInterviewRecruitmentRound(activeRound?.type || "")) && (!finalStatus || ["ACCEPTED", "REJECTED", "WAITLISTED"].includes(value))) : []
            const interviewLinks = [...(interviewCapabilities(membership).readClosing ? [{ tool: "reviews" as const, label: "Submitted reviews" }] : []), ...(interviewCapabilities(membership).moderateResume && !anonymousActive ? [{ tool: "resumes" as const, label: "Résumé moderation" }] : [])]
            const interviewHref = (tool: "reviews" | "resumes") => applicantInterviewHref(membership.clubId, tool, (() => { const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search); if (round) query.set("roundId", round); return query.toString(); })(), active.id)
            const toggleSection = (key: string) => (value: boolean) => setOpenSections(current => value ? [...current, key] : current.filter(item => item !== key))
            const observationsPanel = observationsEligible && <SectionErrorBoundary label="observations"><AdditionalObservations key={active.id} clubId={membership.clubId} applicationId={active.id} embedded onCount={setObservationCount} /></SectionErrorBoundary>
            return <>
              <div className="oc-applicant-drawer-scroll">
                <header className="oc-quick-header">
                  {profileFields.photo && <Avatar className="size-10 shrink-0">
                    <AvatarImage src={profilePhotoSource(profile?.headshotUrl)} alt="" />
                    <AvatarFallback>{dossierName(active).split(" ").map((part) => part[0]).slice(0, 2).join("")}</AvatarFallback>
                  </Avatar>}
                  <div className="oc-quick-identity">
                    <div className="oc-quick-title-row">
                      <SheetTitle ref={heading} tabIndex={-1} className="oc-quick-name" title={anonymousActive || !profileFields.email ? undefined : active.student.email}>{dossierName(active)}</SheetTitle>
                      <StatusPill status={active.status} />
                      {quickQueue && <span className="oc-quick-fact">Quick review · {quickQueue.length} remaining</span>}
                    </div>
                    <SheetDescription className="oc-quick-facts">
                      {anonymousActive ? "Anonymous review · identity and appointments withheld" : joinFacts(profileFields.major && profile?.major, ...(profile ? applicantProfileFacts(profile, profileFields) : [])) || "Academic profile not provided"}
                      {!anonymousActive && profile && <> · <RecruitmentAttendanceSummary compact clubId={membership.clubId} applicationId={active.id} /></>}
                    </SheetDescription>
                    {"priorApplications" in active && !!active.priorApplications?.length && <p data-testid="prior-applications" className="oc-quick-facts"><PreviouslyAppliedBadge priors={active.priorApplications} detail /></p>}
                    <ApplicantRecusal key={active.id} clubId={membership.clubId} applicationId={active.id} anonymous={anonymousActive} onChanged={() => setRevision(v => v + 1)} />
                  </div>
                  <div className="oc-quick-tools">
                    {resumeUrl && <ResumeViewerDialog href={resumeUrl} name={dossierName(active)} clubId={membership.clubId} applicationId={active.id} trigger={<span className="sr-only">Résumé</span>} triggerClassName="size-9 border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-[var(--oc-content-soft)] hover:text-foreground" />}
                    {linkedinUrl && <a className="oc-quick-icon-action" href={linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" title="LinkedIn"><Linkedin size={16} aria-hidden="true" /></a>}
                    {anonymousActive && hasPermission(membership, "applicants.identify") && <RevealApplicant canPrepare={hasPermission(membership, "recruitment.manage")} key={active.id} clubId={membership.clubId} applicationId={active.id} />}
                    <nav aria-label="Applicant navigation" className="oc-quick-pager">
                      <Button variant="ghost" size="icon" aria-label="Previous applicant" aria-keyshortcuts="ArrowLeft" disabled={busy || activeIndex < 0 || activeIndex === 0 && !pageInfo?.previous} onClick={() => void navigateApplicant(-1)}><ChevronLeft className="size-4" /></Button>
                      <span className="text-xs text-muted-foreground tabular-nums">{activeIndex >= 0 ? `${displayed.start + activeIndex + 1}/${total}` : "Outside filters"}</span>
                      <Button variant="ghost" size="icon" aria-label="Next applicant" aria-keyshortcuts="ArrowRight" disabled={busy || activeIndex < 0 || activeIndex >= filtered.length - 1 && !pageInfo?.next} onClick={() => void navigateApplicant(1)}><ChevronRight className="size-4" /></Button>
                    </nav>
                    {preview?.onNext && <Button variant="outline" size="sm" disabled={busy} onClick={() => void (canEvaluate ? draftSave.flush() : Promise.resolve()).then(() => preview.onNext?.()).catch(() => {})}>Next assigned review</Button>}
                    <Button variant="link" size="sm" className="oc-quick-layout-toggle" aria-pressed={fullProfile} onClick={() => setFullProfile(value => !value)}>{fullProfile ? "Quick review" : "Full profile"}</Button>
                  </div>
                </header>
                {!fullProfile ? <div className="oc-quick-body">
                  <section aria-label="Application responses" className="oc-quick-responses">
                    {active.answers.map((answer) => <div key={answer.id} className="oc-quick-answer">
                      <h3>{answer.question.prompt}</h3>
                      {answer.question.type === "FILE_UPLOAD" && applicationAttachmentUrl(answer.response, active.id, answer.questionId)
                        ? <a className="text-sm underline" href={applicationAttachmentUrl(answer.response, active.id, answer.questionId)} target="_blank" rel="noopener noreferrer">Open document (new tab)</a>
                        : <p>{answerText(answer.question, answer.response) || "No response"}</p>}
                    </div>)}
                    {!active.answers.length && <p className="text-sm text-muted-foreground">{anonymousActive ? "Responses and files are withheld during anonymous review." : "No club-specific responses."}</p>}
                  </section>
                  <div className="oc-quick-sections">
                    {resumeUrl && <ReviewSection id={`resume-${active.id}`} title="Résumé preview" open={openSections.includes("resume")} onOpenChange={toggleSection("resume")} lazy>
                      <iframe key={active.id} title={`Résumé for ${dossierName(active)}`} src={resumeUrl} referrerPolicy="no-referrer" className="h-[60dvh] min-h-80 w-full rounded-lg border bg-muted" />
                    </ReviewSection>}
                    {canReview && !anonymousActive && <div hidden={!notesCount}><ReviewSection id={`notes-${active.id}`} title="Interview notes" count={typeof notesCount === "number" ? notesCount : null} open={openSections.includes("notes")} onOpenChange={toggleSection("notes")}>
                      <InterviewFeedbackPanel key={active.id} embedded clubId={membership.clubId} applicationId={active.id} roundId={active.roundId} refreshKey={JSON.stringify(active.evaluations)} onCount={setNotesCount} />
                    </ReviewSection></div>}
                    {canReview && <div hidden={!prosSummary || prosSummary !== "error" && !prosSummary.count && !prosSummary.canAdd}><ReviewSection id={`pros-${active.id}`} title="Pros/cons" count={prosSummary === "error" ? null : prosSummary?.count} open={openSections.includes("pros")} onOpenChange={toggleSection("pros")}>
                      <ApplicantDisplayPanel key={active.id} embedded additionalObservations={false} clubId={membership.clubId} applicationId={active.id} refreshKey={JSON.stringify(active.evaluations)} onSummary={setProsSummary} />
                    </ReviewSection></div>}
                    {observationsEligible && <ReviewSection id={`observations-${active.id}`} title="Additional observations" count={observationCount} open={openSections.includes("observations")} onOpenChange={toggleSection("observations")}>{observationsPanel}</ReviewSection>}
                    {active.evaluations.length > 0 && <ReviewSection id={`evaluations-${active.id}`} title="Evaluations" count={active.evaluations.length} open={openSections.includes("evaluations")} onOpenChange={toggleSection("evaluations")}>
                      <ul className="space-y-3">{active.evaluations.map((item) => <li key={item.id} className="border-l-2 border-border pl-3">
                        <p className="text-xs font-medium">{item.round} · {item.score} / 10{item.interviewerId === membership.id ? " · You" : " · Club reviewer"}</p>
                        {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.notes}</p>}
                      </li>)}</ul>
                    </ReviewSection>}
                  </div>
                </div> : <div className="oc-applicant-profile-layout"><div className="oc-dossier-document min-w-0 space-y-6">
                  <section className="oc-dossier-responses space-y-5 border-b border-border pb-6">
                    <h3 className="oc-card-heading">Application responses</h3>
                    {active.answers.map((answer, index) => <div className="oc-dossier-answer" key={answer.id}>
                      <p className="oc-editorial-label">{String(index + 1).padStart(2, "0")} / Application response</p>
                      <h4 className="text-sm font-medium leading-6">{answer.question.prompt}</h4>
                      {answer.question.type === "FILE_UPLOAD" && applicationAttachmentUrl(answer.response, active.id, answer.questionId)
                        ? <a className="mt-2 inline-block text-sm underline" href={applicationAttachmentUrl(answer.response, active.id, answer.questionId)} target="_blank" rel="noopener noreferrer">Open document (new tab)</a>
                        : <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{answerText(answer.question, answer.response) || "No response"}</p>}
                    </div>)}
                    {!active.answers.length && <p className="text-sm text-muted-foreground">{anonymousActive ? "Responses and files are withheld during anonymous review. Any prepared anonymous content appears in the Profile section." : "No club-specific responses."}</p>}
                  </section>
                  <section className="space-y-3 border-b border-border pb-6">
                    <h3 className="oc-card-heading">Profile</h3>
                    {profile ? <ApplicantProfileFacts profile={profile} fields={profileFields} resume={resumeUrl && <ResumeViewerDialog href={resumeUrl} name={dossierName(active)} clubId={membership.clubId} applicationId={active.id} trigger="Résumé" />}>
                      <RecruitmentAttendanceSummary clubId={membership.clubId} applicationId={active.id} />
                    </ApplicantProfileFacts> : <p className="text-sm text-muted-foreground">No profile provided.</p>}
                  </section>
                  <section className="space-y-3 border-b pb-6" aria-label="Interview information"><h3 className="oc-card-heading">Interviews</h3>{anonymousActive ? <p className="text-sm text-muted-foreground">Appointments are withheld during anonymous review.</p> : active.bookings.length ? <ul className="divide-y">{active.bookings.map(booking => <li key={booking.id} className="py-3 text-sm"><p>{schedulingDateTime(booking.slot.startTime)} – {slotTime(booking.slot.endTime, SCHEDULING_TIMEZONE)}</p><p className="mt-1 text-muted-foreground">{booking.slot.location || "Location not provided"}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No interview scheduled.</p>}</section>
                  {canReview && <ApplicantDisplayPanel key={active.id} additionalObservations={false} clubId={membership.clubId} applicationId={active.id} refreshKey={JSON.stringify(active.evaluations)} />}
                  {observationsPanel && <div className="space-y-2"><h3 className="oc-card-heading">Additional observations</h3>{observationsPanel}</div>}
                </div><div className="oc-applicant-assessment min-w-0 space-y-6">
                  {canReview && !anonymousActive && <InterviewFeedbackPanel key={active.id} clubId={membership.clubId} applicationId={active.id} roundId={active.roundId} refreshKey={JSON.stringify(active.evaluations)} />}
                  <section className="space-y-4">
                    <h3 className="oc-card-heading">Evaluations</h3>
                    {active.evaluations.map((item) => <div key={item.id} className="border-l-2 border-border pl-3"><p className="text-xs font-medium">{item.round} · {item.score} / 10{item.interviewerId === membership.id ? " · You" : " · Club reviewer"}</p>{item.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{item.notes}</p>}</div>)}
                    {!active.evaluations.length && <p className="text-sm text-muted-foreground">No evaluations yet.</p>}
                  </section>
                </div>{resumeUrl && <aside className="oc-applicant-resume" aria-label="Applicant résumé">
                  <ResumeViewerDialog href={resumeUrl} name={dossierName(active)} clubId={membership.clubId} applicationId={active.id} trigger="Open résumé" triggerClassName="self-start" />
                  <iframe key={active.id} title={`Résumé for ${dossierName(active)}`} src={resumeUrl} referrerPolicy="no-referrer" className="h-[70dvh] min-h-96 w-full rounded-lg border bg-muted" />
                </aside>}</div>}
              </div>
              <footer className="oc-applicant-review-footer oc-quick-footer" aria-label="Review and decide">
                <form data-autosave-editor="true" className="oc-quick-evaluation" onBlur={canEvaluate ? draftSave.onBlur : undefined} onSubmit={(event) => { event.preventDefault(); if (canEvaluate) void mutate("review") }}>
                  <Label htmlFor="review-score" className="sr-only">Score (1–10)</Label>
                  <DisabledReason field reason={evaluateReason}>
                    <Input id="review-score" type="number" required min={1} max={10} step="any" placeholder="Score" className="oc-quick-score" value={score} disabled={!canEvaluate || busy || !draftSave.ready || draftSave.recovery != null} onChange={(event) => setScore(event.target.value)} />
                  </DisabledReason>
                  <Label htmlFor="review-notes" className="sr-only">Overall evaluation feedback</Label>
                  <DisabledReason field reason={evaluateReason}>
                    <Textarea id="review-notes" rows={1} placeholder="One-line note" className="oc-quick-note min-h-10 resize-none" value={notes} disabled={!canEvaluate || busy || !draftSave.ready || draftSave.recovery != null} onChange={(event) => setNotes(event.target.value)} />
                  </DisabledReason>
                  {canEvaluate && <Button type="submit" variant="outline" disabled={busy || !canReview}>{busy ? "Saving…" : "Finalize evaluation"}</Button>}
                  {canEvaluate && <span className="oc-quick-save-state"><AutosaveStatus save={draftSave} />{dirty ? "Draft · not finalized" : score ? "Finalized review" : ""}</span>}
                </form>
                <div className="oc-quick-actions" role="group" aria-label={quickQueue ? "Quick review decisions" : "Decisions"}>
                  {quickQueue ? <>
                    <Button variant="ghost" disabled={busy} onClick={() => void skipQuickReview()}>Skip</Button>
                    <Button variant="outline" aria-describedby="quick-review-publishes" disabled={busy || !canDecide || !pendingCandidate(active) || !draftSave.ready || draftSave.recovery != null} onClick={() => void quickDecision("REJECTED")}>Deny & next</Button>
                    <Button aria-describedby="quick-review-publishes" disabled={busy || !canDecide || !pendingCandidate(active) || !draftSave.ready || draftSave.recovery != null} onClick={() => void quickDecision("ACCEPTED")}>{busy ? "Saving…" : "Accept & next"}</Button>
                    <span id="quick-review-publishes" className="oc-quick-publishes text-xs text-muted-foreground">Decisions publish immediately<span className="sr-only">. Skip leaves the candidate unchanged.</span></span>
                  </> : decisionOptions.map((value) => <DisabledReason key={value} reason={!busy && dirty && "Save your review before changing the status."}>
                    <Button variant={value === "ACCEPTED" ? "default" : "outline"} size="sm" disabled={busy || dirty} onClick={() => setDecision(value)}>{decisionActionLabels[value]}</Button>
                  </DisabledReason>)}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More applicant actions"><MoreHorizontal size={18} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-56">
                      {canManageRecruitment && <DropdownMenuItem onSelect={() => { setTargetRound(active.roundId); setPanel("round") }}>Move round…</DropdownMenuItem>}
                      {canManageRecruitment && !activeRound?.anonymousReview && <DropdownMenuItem onSelect={() => setPanel("cycle")}>Recruitment cycle assignment…</DropdownMenuItem>}
                      {active.status === "REJECTED" && canDecide && <DropdownMenuItem onSelect={() => setPanel("reconsider")}>Reconsider application…</DropdownMenuItem>}
                      {active.status === "ACCEPTED" && active.recruitmentOffer?.status === "PENDING" && canDecide && <DropdownMenuItem disabled={busy || dirty} onSelect={async () => { if (!window.confirm("Rescind this pending offer? Accepted memberships are managed in member management.")) return; setBusy(true); try { await revokeRecruitmentOffer(membership.clubId, active.id); setRevision(v => v + 1); setMessage("Pending offer rescinded."); preview?.onChanged() } catch { setMessage("Only pending offers can be rescinded. Manage existing members through member management.") } finally { setBusy(false) } }}>Rescind pending offer</DropdownMenuItem>}
                      {interviewLinks.map(item => <DropdownMenuItem key={item.tool} disabled={busy || dirty} asChild><Link href={interviewHref(item.tool)} onClick={e => { if (busy || dirty || !canLeaveWorkspace()) e.preventDefault() }}>{item.label}</Link></DropdownMenuItem>)}
                      <DropdownMenuItem disabled={busy} onSelect={() => { if (dirty && !window.confirm("Discard your unsaved review and reload applicant data?")) return; setActiveId(null); setDecision(""); setRevision(v => v + 1) }}>Reload applicant data</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {message && <p role="status" className="oc-quick-message">{message}</p>}
              </footer>
              <Dialog open={panel !== null} onOpenChange={value => { if (!value && !busy) setPanel(null) }}>
                <DialogContent>
                  {panel === "round" && <><DialogHeader><DialogTitle>Move round</DialogTitle><DialogDescription>{dossierName(active)} · currently in {activeRound?.name ?? "an unavailable round"}.</DialogDescription></DialogHeader>
                    <Label htmlFor="move-round">Round</Label>
                    <NativeSelect id="move-round" className={selectStyle} disabled={busy} value={targetRound} onChange={(event) => setTargetRound(event.target.value)}>{data.rounds.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect>
                    <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPanel(null)}>Cancel</Button>
                      <DisabledReason reason={!busy && (finalStatus ? "Final decisions can’t move rounds. Reconsider a rejected application first; correct other decisions with the decision buttons." : dirty ? "Save your review before moving." : false)}>
                        <Button disabled={busy || dirty || finalStatus || targetRound === active.roundId} onClick={() => { setMessage(""); void mutate("round") }}>Move round</Button>
                      </DisabledReason></div>
                    {message && <p role="status" className="text-sm">{message}</p>}</>}
                  {panel === "cycle" && <><DialogHeader><DialogTitle>Recruitment cycle assignment</DialogTitle><DialogDescription>{dossierName(active)}</DialogDescription></DialogHeader>
                    <ApplicationCycleAssignment key={active.id + active.recruitmentCycleId} clubId={membership.clubId} applicationId={active.id} cycleId={active.recruitmentCycleId} onSaved={() => { setPanel(null); setRevision(v => v + 1) }} /></>}
                  {panel === "reconsider" && <><DialogHeader><DialogTitle>Reconsider application</DialogTitle><DialogDescription>Returns {dossierName(active)} to review. Earlier decisions stay in the history.</DialogDescription></DialogHeader>
                    <Label htmlFor="reconsider-reason">Reason (at least 10 characters)</Label>
                    <Textarea id="reconsider-reason" maxLength={1000} value={reconsiderReason} onChange={e => setReconsiderReason(e.target.value)} />
                    <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setPanel(null)}>Cancel</Button>
                      <Button disabled={busy || reconsiderReason.trim().length < 10} onClick={async () => { setBusy(true); try { await reconsiderRejectedApplication({ clubId: membership.clubId, applicationId: active.id, expectedGuard: active.publicationGuard, reason: reconsiderReason }); setReconsiderReason(""); setPanel(null); setActiveId(null); setRevision(v => v + 1); setMessage("Application returned to review. Historical decisions are preserved.") } catch { setMessage("Reconsideration failed. Check your access and try again.") } finally { setBusy(false) } }}>Reconsider application</Button></div></>}
                </DialogContent>
              </Dialog>
            </>
          })()}
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
              {active && dossierName(active)} will see their application marked{" "}
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
            {active&&["ACCEPTED","WAITLISTED","REJECTED"].includes(decision)&&<ScheduleDecision clubId={membership.clubId} selection={{kind:"DIRECT",applicationId:active.id,expectedGuard:active.publicationGuard,status:decision as "ACCEPTED"|"WAITLISTED"|"REJECTED"}} disabled={busy} onScheduled={()=>{setDecision("");setRevision(v=>v+1)}}/>}
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
