"use client"
import { UserFacingError } from "@/lib/action-result"
import "@/components/product/operational-dashboard.css"
import "@/components/applicant-review/applicant-review.css"
import { completePipelineSelection, type PipelinePageQuery, type PipelineCursor } from "@/lib/pipeline-page"
import { usePipelinePage } from "@/hooks/use-pipeline-page"
import { useStagedDecisions } from "@/hooks/use-staged-decisions"
import { isInterviewRecruitmentRound } from "@/lib/recruitment-lifecycle"
import { genderValues } from "@/lib/student-profile"
import { decisionFilters, type DecisionFilter } from "@/lib/application-decisions"
import { type ApplicantSort } from "@/lib/live-applicant-sorting"
import { boardColumnFor, type BoardColumnId } from "@/lib/applicant-board"
import { isPendingDecision } from "@/lib/staged-decisions"
import { LiveApplicantList, LiveDecisionList, applicantSortOptions } from "./live-applicant-views"
import { ApplicantBoard } from "@/components/applicant-review/applicant-board"
import { ApplicantReviewFlow } from "@/components/applicant-review/applicant-review-flow"
import { useListSort } from "@/hooks/use-list-sort"
import { SortControl } from "@/components/ui/sort-control"
import { useDemoMode } from "@/contexts/demo-context"
import { hasPermission } from "@/lib/permissions"
import { canExport, clubExportHref } from "@/lib/club-exports-access"
import { useRouter } from "next/navigation"
import { saveVotingSelection, votingSetupHref, decisionsHref } from "@/lib/voting-navigation"
import { RankedReviewList, type RankedReviewApi } from "@/components/ranked-review-list"
import Link from "next/link"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { WorkspaceLoading } from "@/components/workspace-loading"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Download, Kanban, MoreHorizontal, Rows3, Settings as SettingsIcon, SlidersHorizontal, Trophy } from "@/components/icons"
import { canOpenRecruitingSettings, withRecruitingSettings, type RecruitingSettingsSection } from "@/lib/recruiting-settings"
import { navigateWithinClub } from "@/lib/workspace-navigation"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { createPortal } from "react-dom"
import { useRevalidate } from "@/hooks/use-revalidate"
import { getRankedReviewRound, getRankedReviewSettings, getRoundTargetSummary, saveRankedReviewBands } from "@/lib/workspace-api"
import { getClubPipelinePage, getClubPipelineSelection } from "@/lib/workspace-api"
import { useApplicationState } from "@/lib/application-state"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { DemoRoundTarget } from "@/components/demo-workspace"
import { defaultProfileFieldVisibility, type ProfileFieldVisibility } from "@/lib/profile-field-visibility"
import { applicationStatusLabels } from "@/lib/student-applications"
import { Button } from "@/components/ui/button"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { SearchField } from "@/components/ui/search-field"
import { readApplicantView, writeApplicantView, type ApplicantView } from "@/lib/applicant-view"
import { FilterPopover } from "@/components/ui/filter-popover"
import { PillSelect } from "@/components/ui/pill-select"
import { PillGroup } from "@/components/ui/segmented-control"
import { RangeSlider } from "@/components/ui/range-slider"
import { Toggle } from "@/components/ui/toggle"
import { pluralize } from "@/lib/copy/terms"

type Pipeline = Awaited<ReturnType<typeof getClubPipelinePage>>
type Candidate = Pipeline["applications"][number]
type Review = { ids: string[]; startId: string; title: string }
/** Pending decisions split into these stages (the old Status dropdown's remaining distinct choices). */
const pendingStatuses = ["SUBMITTED", "IN_REVIEW", "INTERVIEWING"] as const
/** Range filters keep their string state ("" = no minimum); sliders speak numbers. */
const numberFilter = (value: string) => value === "" || !Number.isFinite(Number(value)) ? null : Number(value)
const filterText = (value: number | null) => value === null ? "" : String(value)
const name = (app: { student: { email?: string; studentProfile?: { firstName: string; lastName: string } | null } }) =>
  app.student.studentProfile
    ? `${app.student.studentProfile.firstName} ${app.student.studentProfile.lastName}`
    : app.student.email ?? "Applicant"
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

/** One applicant in the shared review (dashboard assigned reviews, Ranked review): same masked read and decisions. */
export function ApplicantReviewPreview({ clubId, applicationId, onClose, onChanged, onNext }: { clubId: string; applicationId: string; onClose: () => void; onChanged: () => void; onNext?: () => void }) {
  const { user } = useAuth()
  const membership = user?.memberships.find(m => m.clubId === clubId)
  if (!membership) return <p role="alert">Applicant access unavailable.</p>
  return <ApplicantReviewFlow key={applicationId} membership={membership} ids={[applicationId]} startId={applicationId} title="Applicant review" onClose={onClose} onChanged={onChanged} onNext={onNext} />
}

function ClubWorkspace({ membership, decisionsOnly = false, rejectedOnly = false, initialDecision = "all", initialData = null, onData, validatedInitialData = false }: { validatedInitialData?: boolean; membership: ExtendedMembership; decisionsOnly?: boolean; rejectedOnly?: boolean; initialDecision?: DecisionFilter; initialData?: Pipeline | null; onData?: (data: Pipeline | null) => void }) {
  const router = useRouter()
  const [votingSelection, setVotingSelection] = useState<string[]>([])
  const demo = useDemoMode()
  const { leaderFocus, clearLeaderFocus } = useApplicationState()
  const auth = useAuth()
  const { readAuthority, isReadAuthorityCurrent } = auth
  const authority = useMemo(() => ({ user: auth.user, readAuthority: auth.readAuthority, support: auth.isImpersonating, loading: auth.loading, membership, demoReady: demo.ready, demoEnabled: demo.isDemoEnabled }), [auth.user, auth.readAuthority, auth.isImpersonating, auth.loading, membership, demo.ready, demo.isDemoEnabled])
  const canStartVoting = hasPermission(membership, "applications.review") && hasPermission(membership, "decisions.manage") && hasPermission(membership, "decisions.start")
  const canReview = hasPermission(membership, "applications.review")
  const canDecide = hasPermission(membership, "decisions.manage") && hasPermission(membership, "applicants.identify")
  useEffect(() => setVotingSelection([]), [auth.user?.id, membership.id, demo.isDemoEnabled])
  const votingChoice = canStartVoting && !rejectedOnly ? { ids: votingSelection, toggle: (id: string) => setVotingSelection(old => old.includes(id) ? old.filter(v => v !== id) : [...old, id]) } : undefined
  function startSelectedVoting() { if (!auth.user || !votingSelection.length || !canLeaveWorkspace()) return; try { const key = saveVotingSelection(sessionStorage, { userId: auth.user.id, clubId: membership.clubId, demo: demo.isDemoEnabled, applicationIds: votingSelection }); router.push(votingSetupHref(membership.clubId, demo.isDemoEnabled ? "demo=1" : "", key)) } catch { setMessage("Could not retain the applicant selection in this tab. Allow session storage and retry.") } }
  const [error, setError] = useState("")
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [position, setPosition] = useState<{ key: string; cursor: PipelineCursor } | null>(null)
  // `roundId` and `review=1` (open the review) arrive from the Overview review card; read once, then the filters own them.
  const initialParams = useRef(typeof window === "undefined" || !window.location?.href ? new URLSearchParams() : new URL(window.location.href).searchParams)
  const [round, setRound] = useState(initialParams.current.get("roundId") ?? "")
  const reviewRequested = useRef(initialParams.current.get("review") === "1")
  const [decisionGroup, setDecisionGroupState] = useState<DecisionFilter>(rejectedOnly ? "rejected" : initialDecision)
  // The decision filter lives in the URL (`decision=`), so Rejected and other groups are linkable.
  const setDecisionGroup = useCallback((value: DecisionFilter) => {
    setDecisionGroupState(value)
    // Stage pills subdivide Pending; another decision group leaves no stage to filter by.
    if (value !== "all" && value !== "pending") setStatus("")
    if (decisionsOnly || typeof window === "undefined" || !window.location?.href || !window.history) return
    const url = new URL(window.location.href)
    if (value === "all") url.searchParams.delete("decision"); else url.searchParams.set("decision", value)
    window.history.replaceState(window.history.state, "", url)
  }, [decisionsOnly])
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
  // The layout lives in the URL (`applicantView=`) like the decision filter; Decide's list has no layout choice.
  const [view, setViewState] = useState<ApplicantView>(() => decisionsOnly ? "list" : readApplicantView(initialParams.current))
  const setView = useCallback((value: ApplicantView) => {
    setViewState(value)
    if (decisionsOnly || typeof window === "undefined" || !window.location?.href || !window.history) return
    window.history.replaceState(window.history.state, "", writeApplicantView(new URL(window.location.href), value))
  }, [decisionsOnly])
  // Ranked review opens the same review flow (with finalized interviewer feedback).
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
  const [reviewing, setReviewing] = useState<Review | null>(null)
  const [opening, setOpening] = useState(false)
  const [message, setMessage] = useState("")
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
  const { data: listData, loading, ready, invalid: invalidFilter, error: readError, setData, isCurrent } = usePipelinePage({
    clubId: membership.clubId, reviewerId: membership.id, userId: membership.userId, query: pageQuery, revision, authority,
    enabled: demo.ready && !auth.loading && !!auth.user, initialData, validatedInitialData,
  })
  const latestAuthority = useRef(authority); latestAuthority.current = authority
  const updating = !ready && !invalidFilter || !listData
  const busy = opening || updating || invalidFilter
  const data = listData
  const rounds = useMemo(() => data?.rounds ?? [], [data?.rounds])
  const staged = useStagedDecisions(membership.clubId, { enabled: canDecide && !rejectedOnly, rounds, name: id => { const app = data?.applications.find(item => item.id === id); return app ? name(app) : "" } })
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
  // visible) on return to the tab and after applicant/decision changes elsewhere. Paused while the review is open.
  const revalidateTicket = useRef(0)
  const [revalidateFailures, setRevalidateFailures] = useState(0)
  const revalidate = useCallback(async () => {
    if (!isCurrent()) return
    const ticket = ++revalidateTicket.current
    const landed = () => ticket === revalidateTicket.current && isCurrent()
    try {
      const refreshed = await getClubPipelinePage(membership.clubId, pageQuery)
      if (landed() && setData(refreshed)) setRevalidateFailures(0)
    } catch {
      // Keep the current rows; repeated failures surface a quiet Try again below.
      if (landed()) setRevalidateFailures(count => count + 1)
    }
  }, [membership.clubId, pageQuery, isCurrent, setData])
  useRevalidate(revalidate, { scopes: ["applicants", "decisions"], events: ["outclass:decision-schedules"], enabled: !reviewing && ready })
  const publish = useRef(onData)
  publish.current = onData
  useEffect(() => { publish.current?.(ready ? listData : null) }, [listData, ready])
  // Everything inside the Filters menu, so its summary can show how many apply.
  const menuFilters = [round, status, review, gender, major, year, gpa, sat, act, rating].filter(Boolean).length
  const anyFilter = !!(query || menuFilters)
  const clearMenuFilters = () => { setRound(""); setStatus(""); setReview(""); setGender(""); setShowGenderCounts(false); setMajor(""); setYear(""); setGpa(""); setSat(""); setAct(""); setRating("") }
  const search = useRef<HTMLInputElement>(null)
  useEffect(() => { setError(""); setRevalidateFailures(0) }, [authority, revision, pageQuery])
  const selectionRequestKey = JSON.stringify([selectionKey, revision])
  const latestSelectionRequest = useRef(selectionRequestKey); latestSelectionRequest.current = selectionRequestKey
  /** The whole ordered selection (no identities) for the review queue and board counts. */
  const loadSelection = useCallback(async (input: PipelinePageQuery = readQuery) => {
    const owner = latestSelectionRequest.current
    if (!isReadAuthorityCurrent(readAuthority) || latestAuthority.current !== authority) throw new Error("Applicant selection changed")
    const result = input === readQuery && listData?.coverage?.complete
      ? completePipelineSelection(listData, readQuery, membership.id, membership.userId)
      : await getClubPipelineSelection(membership.clubId, input)
    if (!isReadAuthorityCurrent(readAuthority) || latestAuthority.current !== authority || latestSelectionRequest.current !== owner) throw new Error("Applicant selection changed")
    return result.applications
  }, [membership.clubId, membership.id, membership.userId, listData, readQuery, authority, readAuthority, isReadAuthorityCurrent])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement
      if (event.key === "/" && !reviewing && !element.closest('input, textarea, select, [contenteditable="true"]')) {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [reviewing])
  // Decide › Review lists only applicants still waiting for a decision: pending, with nothing staged.
  const needsDecision = useCallback((app: { id: string; status: string }) => isPendingDecision(app.status) && !staged.get(app.id), [staged])
  const applicants = useMemo(() => {
    const rows = data?.applications || []
    return decisionsOnly ? rows.filter(needsDecision) : rows
  }, [data?.applications, decisionsOnly, needsDecision])
  const pageInfo = listData?.page
  const total = pageInfo?.total ?? applicants.length
  const baseTotal = pageInfo?.baseTotal ?? applicants.length
  const displayed = { items: ready ? applicants : [], page: pageInfo?.index ?? 0, count: pageInfo?.count ?? 1, start: pageInfo?.start ?? 0 }
  const profileFields = data?.profileFields ?? defaultProfileFieldVisibility()
  function changePage(next: PipelineCursor | null) {
    if (!next || busy) return
    focusPage.current = true
    setPosition({ key: selectionKey, cursor: next })
  }
  const workspaceElement = useRef<HTMLDivElement>(null)
  const focusPage = useRef(false)
  useEffect(() => {
    if (!focusPage.current || !ready) return
    focusPage.current = false
    if (reviewing) return
    const frame = requestAnimationFrame(() => Array.from(workspaceElement.current?.querySelectorAll<HTMLElement>("[data-applicant-id]") ?? []).find(button => button.getClientRects().length > 0)?.focus())
    return () => cancelAnimationFrame(frame)
  }, [displayed.page, reviewing, ready])

  /** What "Review applicants" covers: the current tab and filters, or Pending when nothing narrows the list. */
  const reviewScope = useMemo(() => {
    if (decisionsOnly) return { query: { ...readQuery, decisionGroup: "pending" as const }, title: "Needs a decision" }
    if (decisionGroup === "all" && !anyFilter) return { query: { ...readQuery, decisionGroup: "pending" as const }, title: "Reviewing pending applicants" }
    const group = decisionFilters.find(item => item.id === decisionGroup)?.label ?? "All"
    return { query: readQuery, title: anyFilter ? `Reviewing ${group.toLowerCase() === "all" ? "filtered" : `${group.toLowerCase()}, filtered`} applicants` : `Reviewing ${group.toLowerCase()} applicants` }
  }, [decisionsOnly, decisionGroup, anyFilter, readQuery])
  const queueIds = useCallback((rows: { id: string; status: string }[]) => rows.filter(app => !decisionsOnly || needsDecision(app)).map(app => app.id), [decisionsOnly, needsDecision])
  async function startReview() {
    if (busy) return
    setOpening(true); setMessage("")
    try {
      const ids = queueIds(await loadSelection(reviewScope.query))
      if (!ids.length) { setMessage(decisionsOnly ? "Everyone here has a decision. Send them from the Send step." : "No applicants to review with this tab and these filters."); return }
      setReviewing({ ids, startId: ids[0], title: reviewScope.title })
    } catch { setMessage("Couldn’t load the applicants to review. Please try again.") }
    finally { setOpening(false) }
  }
  /** Clicking a row or card opens the review there; Next continues through the whole selection. */
  function open(app: Pick<Candidate, "id">) {
    const pageIds = displayed.items.map(item => item.id)
    setReviewing({ ids: pageIds.includes(app.id) ? pageIds : [app.id], startId: app.id, title: decisionsOnly ? "Needs a decision" : "Applicant review" })
    void loadSelection().then(rows => {
      const ids = queueIds(rows)
      if (ids.includes(app.id)) setReviewing(current => current?.startId === app.id ? { ...current, ids } : current)
    }).catch(() => {})
  }
  function closeReview(lastId: string | null) {
    setReviewing(null)
    setRevision(value => value + 1)
    requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>(`[data-applicant-id="${CSS.escape(lastId ?? "")}"]`)).find(element => element.getClientRects().length > 0)?.focus())
  }
  useEffect(() => {
    if (!data || loading || !leaderFocus || leaderFocus.clubId !== membership.clubId) return
    if (leaderFocus.roundId) setRound(leaderFocus.roundId)
    if (leaderFocus.applicantId) {
      const target = data.applications.find((app) => app.id === leaderFocus.applicantId)
      if (target) { setDecisionGroup("all"); open(target) }
    }
    clearLeaderFocus()
  }, [data, loading, leaderFocus, membership.clubId, clearLeaderFocus, setDecisionGroup]) // eslint-disable-line react-hooks/exhaustive-deps -- open reads the current page
  useEffect(() => {
    if (!reviewRequested.current || !data || loading || !ready) return
    reviewRequested.current = false
    if (data.rounds.length && round && !data.rounds.some(item => item.id === round)) setRound("")
    if (typeof window !== "undefined" && window.history) { const url = new URL(window.location.href); url.searchParams.delete("review"); window.history.replaceState(window.history.state, "", url) }
    if (canReview || canDecide) void startReview()
  }, [data, loading, ready]) // eslint-disable-line react-hooks/exhaustive-deps -- runs once, when the first page is ready

  // Board counts come from the whole filtered selection (ids, rounds and statuses only), placed by staged decisions.
  const [selection, setSelection] = useState<{ key: string; rows: { id: string; status: string; roundId: string }[] } | null>(null)
  useEffect(() => {
    if (view !== "kanban" || !ready || decisionsOnly) return
    let current = true
    const key = selectionRequestKey
    loadSelection().then(rows => { if (current) setSelection({ key, rows }) }).catch(() => { if (current) setSelection(null) })
    return () => { current = false }
  }, [view, ready, selectionRequestKey, decisionsOnly]) // eslint-disable-line react-hooks/exhaustive-deps -- reload per selection, not per loader identity
  const boardCounts = useMemo(() => {
    if (!selection || selection.key !== selectionRequestKey) return null
    const counts = new Map<BoardColumnId, number>()
    for (const row of selection.rows) { const column = boardColumnFor(row, staged.get(row.id)); if (column) counts.set(column, (counts.get(column) ?? 0) + 1) }
    return counts
  }, [selection, selectionRequestKey, staged])

  // The drawer returns focus to whatever had it when it opened: put it on ⋯ first, since the menu item is gone.
  const moreTools = useRef<HTMLButtonElement>(null)
  const openSettings = (section: RecruitingSettingsSection) => {
    if (!canLeaveWorkspace() || typeof window === "undefined") return
    moreTools.current?.focus({ preventScroll: true })
    const href = `${window.location.pathname}?${withRecruitingSettings(window.location.search, section)}`
    if (!navigateWithinClub(href)) router.push(href, { scroll: false })
  }
  const votingBarShown = !!votingChoice && votingSelection.length > 0 && !reviewing
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
        <p>{error || (readError ? "Couldn’t load this club’s applicants. Your access may have changed." : "No data available.")}</p>
        <Button variant="outline" onClick={() => { setError(""); setPosition(null); setRevision((value) => value + 1) }}>
          Try again
        </Button>
      </div>
    )
  const exportable = !demo.isDemoEnabled && canExport(membership, "applicants")
  const settingsAllowed = canOpenRecruitingSettings(membership)
  const reviewButton = (canReview || canDecide) && !rejectedOnly && <Button disabled={busy} onClick={() => void startReview()}>{opening ? "Loading…" : decisionsOnly ? "Review applicants needing a decision" : "Review applicants"}</Button>
  const statusTabs = view !== "ranked" && !decisionsOnly && !rejectedOnly && <SegmentedControl label="Decision" size="compact" className="oc-status-tabs" value={decisionGroup} onChange={value => setDecisionGroup(value as DecisionFilter)} options={decisionFilters.map(group => ({ value: group.id, label: group.label, count: group.id === "all" ? listData?.page.baseTotal ?? 0 : listData?.facets.decisions[group.id] ?? 0 }))} />
  return (
    <div ref={workspaceElement} className="oc-live-pipeline oc-workspace-stack" data-saving={busy}>
      <div className={votingBarShown ? "oc-voting-bar-clearance" : undefined}>
      {message && <p role="status" className="text-sm">{message}</p>}
      {/* The one review entry point: the current tab and filters (Pending when nothing narrows the list). */}
      {!decisionsOnly && reviewButton && actionSlot !== undefined && (actionSlot ? createPortal(<div role="group" aria-label="Recruitment review" className="flex flex-wrap items-center justify-end gap-2">{reviewButton}</div>, actionSlot) : <div className="flex justify-end">{reviewButton}</div>)}
      {decisionsOnly && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Applicants still waiting for a decision. Advance, Hold and Reject are saved here and sent from the Send step.</p>{reviewButton}</div>}
      <div className="oc-applicants-toolbar-wrap"><div className="oc-toolbar oc-applicants-toolbar">
        {!decisionsOnly && <SegmentedControl label="Applicant view" size="compact" className="oc-view-switch" value={view} onChange={setView} options={[
          { value: "list", label: null, ariaLabel: "List", icon: <Rows3 /> },
          { value: "kanban", label: null, ariaLabel: "Kanban", icon: <Kanban /> },
          { value: "ranked", label: null, ariaLabel: "Ranked", icon: <Trophy /> },
        ]} />}
        {statusTabs}
        {view !== "ranked" && <><SearchField
            ref={search}
            aria-label="Search applicants"
            placeholder="Name, anonymous ID, or major"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            shortcut="/"
            shortcutListener={false}
            containerClassName="oc-toolbar-search"
          />
        {/* Sort at every width; the table's column headers drive the same state. */}
        <div className="oc-toolbar-sort flex items-center"><SortControl label="Sort applicants" options={applicantSortOptions.filter(option => sortableByProfile(option.key, profileFields))} value={sort} descending={descending} descendingByDefault={applicantSortsDescending} onChange={listSort.set} /></div></>}
        <div className="oc-toolbar-tools flex items-center gap-2">
        {view !== "ranked" && <FilterPopover count={menuFilters} title="Applicant filters"
          footer={<><Button variant="ghost" size="sm" disabled={!menuFilters} onClick={clearMenuFilters}>Clear filters</Button>{view === "list" && <Button size="sm" variant="ghost" aria-pressed={compact} onClick={() => setCompact((value) => !value)}>Compact rows</Button>}</>}>
        <div className="oc-filter-field"><span className="oc-filter-field-label">Round</span>
          <PillSelect label="Filter round" size="compact" allLabel="All rounds" value={round} onChange={value => { setRound(value); setGender(""); setShowGenderCounts(false) }}
            options={data.rounds.map(item => ({ value: item.id, label: item.name }))} />
        </div>
        {!decisionsOnly && (decisionGroup === "all" || decisionGroup === "pending") && <div className="oc-filter-field"><span className="oc-filter-field-label">Stage</span>
          <PillSelect label="Filter stage" size="compact" allLabel={decisionGroup === "pending" ? "All pending" : "All stages"} value={status} onChange={setStatus}
            options={pendingStatuses.map(key => ({ value: key, label: applicationStatusLabels[key] }))} />
        </div>}
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
          {profileFields.academicYear && <PillSelect label="Filter academic year" size="compact" allLabel="All years" value={year} onChange={setYear}
            options={(listData?.facets.years ?? []).map(value => ({ value, label: value }))} />}
          {profileFields.gpa && <RangeSlider label="GPA greater than" min={0} max={4} step={0.01} value={numberFilter(gpa)} onChange={value => setGpa(filterText(value))} />}
          {profileFields.sat && <RangeSlider label="SAT greater than" min={400} max={1600} step={10} value={numberFilter(sat)} onChange={value => setSat(filterText(value))} />}
          {profileFields.act && <RangeSlider label="ACT greater than" min={1} max={36} step={1} value={numberFilter(act)} onChange={value => setAct(filterText(value))} />}
          <RangeSlider label="Minimum rating (out of 10)" min={0} max={10} step={0.1} value={numberFilter(rating)} onChange={value => setRating(filterText(value))} />
      </section>}
        </FilterPopover>}
        {!decisionsOnly && (exportable || settingsAllowed) && <DropdownMenu>
          <DropdownMenuTrigger asChild><IconButton ref={moreTools} variant="outline" aria-label="More applicant tools" title="More"><MoreHorizontal aria-hidden="true" /></IconButton></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {exportable && <DropdownMenuItem asChild><a href={clubExportHref(membership.clubId, "applicants", round || null)} download><Download aria-hidden="true" />Export CSV</a></DropdownMenuItem>}
            {/* Recruiting settings open from the URL, so Back closes the drawer. Opening waits a frame for the menu to close. */}
            {settingsAllowed && <DropdownMenuItem onSelect={() => requestAnimationFrame(() => openSettings("grading"))}><SlidersHorizontal aria-hidden="true" />Grading categories</DropdownMenuItem>}
            {settingsAllowed && <DropdownMenuItem onSelect={() => requestAnimationFrame(() => openSettings("anonymous"))}><SettingsIcon aria-hidden="true" />Recruiting settings</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>}
        </div>
      </div></div>
      {view === "ranked" && !decisionsOnly ? <RankedReviewList clubId={membership.clubId} rounds={data.rounds} initialRoundId={round || data.rounds.find(item => isInterviewRecruitmentRound(item.type))?.id} api={rankedApi} onOpen={setRankedOpen} votingSelection={votingChoice} changeSignal={rankedChanged}
        votingLink={canReview ? <Button variant="outline" size="sm" asChild><Link href={decisionsHref(membership.clubId, "voting", demo.isDemoEnabled ? "demo=1" : "")}>Open Voting room</Link></Button> : undefined} /> : <>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-3">
        <p className="text-xs text-muted-foreground" role="status">
          {decisionsOnly ? `${pluralize(displayed.items.length, "applicant")} on this page need a decision` : `${total} of ${pluralize(baseTotal, "applicant")} · scores out of 10`}
        </p>
        {anyFilter && <Button variant="ghost" size="sm" onClick={clearApplicantFilters}>Clear filters</Button>}
        {revalidateFailures >= 2 && <p role="status" className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">Couldn’t update applicants. Showing the last loaded list.<Button variant="ghost" size="sm" disabled={busy} onClick={() => void revalidate()}>Try again</Button></p>}
      </div>
      {decisionGroup === "rejected" && <p className="text-sm text-muted-foreground">Reconsidering returns an application to review; its history is kept.</p>}
      {invalidFilter ? <p role="alert">Enter filters within the displayed numeric ranges.</p> : updating ? <p role="status" aria-live="polite">Updating applicants…</p> : !displayed.items.length ? <div role="status" className="space-y-3 border-y py-10 text-sm text-muted-foreground"><p>{baseTotal ? (decisionsOnly ? "Every applicant here has a decision. Send them from the Send step." : "No applicants match these filters.") : rejectedOnly ? "No applications have been rejected." : decisionsOnly ? "No applications are waiting for a decision." : "No one has submitted an application yet. Student drafts stay private until they submit."}</p>{baseTotal && !decisionsOnly ? <Button variant="outline" size="sm" onClick={clearApplicantFilters}>Clear filters</Button> : !decisionsOnly && <Button variant="outline" size="sm" asChild><Link href={rejectedOnly ? `/club/${encodeURIComponent(membership.clubId)}/workspace?section=recruitment&tool=applicants` : `/club/${encodeURIComponent(membership.clubId)}/workspace?section=settings&setting=application`}>{rejectedOnly ? "View all applicants" : "Review your application form"}</Link></Button>}</div>
        : decisionsOnly ? <LiveDecisionList sort={sort} descending={descending} sortBy={listSort.toggle} applicants={displayed.items} rounds={data.rounds} open={open} compact={compact} name={name} staged={staged.items} />
        : view === "kanban" ? <ApplicantBoard applicants={displayed.items} rounds={data.rounds} counts={boardCounts} staged={canDecide ? staged : null} canDecide={canDecide} name={name} open={open}
            note={displayed.count > 1 ? `Showing ${displayed.items.length} of ${total} on this page. Column counts cover all ${total}.` : undefined} />
        : <LiveApplicantList profileFields={profileFields} votingSelection={votingChoice} sort={sort} descending={descending} sortBy={listSort.toggle} applicants={displayed.items} rounds={data.rounds} open={open} compact={compact} name={name} staged={staged.items} />}
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
      {view === "ranked" && rankedOpen && <ApplicantReviewFlow key={rankedOpen} membership={membership} ids={[rankedOpen]} startId={rankedOpen} title="Ranked review" staged={canDecide ? staged : null} onClose={() => setRankedOpen(null)} onChanged={() => setRankedChanged(value => value + 1)} />}
      {reviewing && <ApplicantReviewFlow key={`${reviewing.title}:${reviewing.startId}`} membership={membership} ids={reviewing.ids} startId={reviewing.startId} title={reviewing.title} staged={canDecide ? staged : null} onClose={closeReview} onChanged={() => void revalidate()} />}
    </div>
  )
}

