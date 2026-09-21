"use client"

import { LeadsTable } from "@/components/qr/leads-table"
import { LiveVotingLauncher } from "@/components/live-voting/live-voting-launcher"
import { useAttendance, eventsAttended } from "@/lib/attendance"
import { useApplicationState } from "@/lib/application-state"
import { currentStudent, experienceItems } from "@/lib/data"
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { CRMViewManager } from "@/components/customization/crm-view-manager"
import { crmColumns, emptyFilters, matchesCRMFilters, useClubCustomization, type CRMFilters, type ColumnId } from "@/lib/club-customization"
import { ChevronUp, ChevronDown, Search, SlidersHorizontal, Play, ChevronLeft, ChevronRight, FileText, LinkIcon, Check, Lock, ArrowUpRight, Zap, X, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/status-badge"
import { SpeedReviewMode } from "@/components/views/leader-dashboard/speed-review-mode"
import { PipelineView } from "@/components/views/leader-dashboard/pipeline-view"
import { type Applicant, workspaceRounds } from "@/lib/data"

import { averageApplicantScore, nextApplicantSort, sortApplicants, type ApplicantSortKey, type SortConfig } from "@/lib/applicant-sorting"

const SORT_COLUMNS: { key: ApplicantSortKey; label: string; className?: string }[] = [
  { key: "name", label: "Applicant" },
  { key: "year", label: "Year", className: "w-24" },
  { key: "major", label: "Major", className: "w-40" },
  { key: "gpa", label: "GPA", className: "w-20" },
  { key: "satScore", label: "SAT", className: "w-20" },
  { key: "status", label: "Status", className: "w-28" },
  { key: "score", label: "Avg Score", className: "w-28 pr-4 text-right" },
]


const SCORING_CRITERIA = [
  { id: "culture", label: "Culture" },
  { id: "experience", label: "Experience" },
  { id: "case", label: "Case" },
] as const

export function LeaderDashboardView() {
  const attendance = useAttendance()
  const { isApplied } = useApplicationState()
  const [pipeline, setPipeline] = useState<"applicants" | "leads">("applicants")
  const { state: customization, update, stages, stageName, applicants, setApplicants, ready } = useClubCustomization()
  const viewMode = customization.crm.layout
  const { query, stage, minGpa: appliedMinGpa, minSat: appliedMinSat } = customization.crm.filters
  const majors = useMemo(() => new Set(customization.crm.filters.majors), [customization.crm.filters.majors])
  const years = useMemo(() => new Set(customization.crm.filters.years), [customization.crm.filters.years])
  const visible = (id: ColumnId) => !customization.crm.hidden.includes(id)
  const STAGES = ["All Stages", ...stages.map(s => s.id)]
  function setFilter<K extends keyof CRMFilters>(key: K, value: CRMFilters[K]) {
    update(p => ({ ...p, crm: { ...p.crm, filters: { ...p.crm.filters, [key]: value } } }))
  }
  const setStage = (value: string) => setFilter("stage", value)
  const setQuery = (value: string) => setFilter("query", value)
  const setMajors: Dispatch<SetStateAction<Set<string>>> = value => setFilter("majors", [...(typeof value === "function" ? value(majors) : value)])
  const setYears: Dispatch<SetStateAction<Set<string>>> = value => setFilter("years", [...(typeof value === "function" ? value(years) : value)])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [minSat, setMinSat] = useState("")
  const [minGpa, setMinGpa] = useState("")
  useEffect(() => { setMinSat(appliedMinSat?.toString() ?? ""); setMinGpa(appliedMinGpa?.toString() ?? "") }, [appliedMinSat, appliedMinGpa])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: "ascending" })
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [speedReviewQueue, setSpeedReviewQueue] = useState<Applicant[] | null>(null)

  const allMajors = useMemo(() => Array.from(new Set(applicants.map((a) => a.major))), [applicants])
  const allYears = useMemo(() => Array.from(new Set(applicants.map((a) => a.year))), [applicants])

  const filtered = useMemo(() => applicants.filter(applicant => matchesCRMFilters(applicant, customization.crm.filters)), [applicants, customization.crm.filters])

  const pipelineFiltered = filtered

  const sortedApplicants = useMemo(() => sortConfig.key === "status"
    ? [...filtered].sort((a, b) => (sortConfig.direction === "ascending" ? 1 : -1) * stageName(a.status).localeCompare(stageName(b.status)))
    : sortApplicants(filtered, sortConfig, scores), [filtered, sortConfig, scores, customization.stages])
  const navList = viewMode === "pipeline" ? pipelineFiltered : sortedApplicants
  const activeIndex = navList.findIndex((applicant) => applicant.id === activeId)
  const active = applicants.find((applicant) => applicant.id === activeId) ?? null

  function requestSort(key: ApplicantSortKey) {
    setSortConfig((previous) => nextApplicantSort(previous, key))
  }

  function averageScore(applicantId: string, fallback: number) {
    return averageApplicantScore(applicantId, fallback, scores)
  }

  function setCriterionScore(applicantId: string, criterion: string, value: number) {
    setScores((prev) => ({
      ...prev,
      [applicantId]: { ...prev[applicantId], [criterion]: value },
    }))
  }

  function roundAggregate(roundId: string) {
    const round = workspaceRounds.find((r) => r.id === roundId)
    if (!round) return { score: null as number | null, notes: [] as { interviewer: string; initials: string; note: string; score: number }[] }
    const comments = round.questions.flatMap((q) => q.collaboratorComments)
    if (comments.length === 0) return { score: null, notes: [] }
    const score = comments.reduce((sum, c) => sum + c.score, 0) / comments.length
    return { score, notes: comments }
  }

  const STAGE_SEQUENCE = [...customization.stages.map(s => s.id), "Accepted"]

  function reachedStage(status: Applicant["status"], stage: Applicant["status"]) {
    if (status === "Rejected") return false
    const targetIndex = STAGE_SEQUENCE.indexOf(stage)
    return targetIndex >= 0 && STAGE_SEQUENCE.indexOf(status) >= targetIndex
  }

  function promoteToNextRound() {
    if (!active) return
    const currentIdx = STAGE_SEQUENCE.indexOf(active.status)
    if (currentIdx === -1 || currentIdx === STAGE_SEQUENCE.length - 1) return
    const next = STAGE_SEQUENCE[currentIdx + 1]
    setApplicants((prev) => prev.map((a) => (a.id === active.id ? { ...a, status: next } : a)))
    toast.success(`${active.name} moved to ${stageName(next)}`)
  }

  function toggleSet(setter: typeof setMajors, value: string) {
    setter((prev) => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) => (filtered.every(a => prev.has(a.id)) ? new Set() : new Set(filtered.map((a) => a.id))))
  }

  function applyAdvancedFilters() {
    const sat = minSat.trim() === "" ? null : Number(minSat)
    const gpa = minGpa.trim() === "" ? null : Number(minGpa)
    if ((sat !== null && (!Number.isFinite(sat) || sat < 0 || sat > 1600)) || (gpa !== null && (!Number.isFinite(gpa) || gpa < 0 || gpa > 4))) {
      toast.error("Enter a GPA from 0 to 4 and SAT score from 0 to 1600."); return
    }
    update(p => ({ ...p, crm: { ...p.crm, filters: { ...p.crm.filters, minSat: sat, minGpa: gpa } } }))
  }

  function runAutoReject() {
    const lowSat = 1400
    const lowGpa = 3.5
    let count = 0
    setApplicants((prev) =>
      prev.map((a) => {
        if (a.status === customization.stages[0].id && (a.satScore < lowSat || Number(a.gpa) < lowGpa)) {
          count += 1
          return { ...a, status: "Rejected" as const }
        }
        return a
      }),
    )
    toast.success(`Auto-Reject Automation complete — ${count} applicant${count === 1 ? "" : "s"} rejected`)
  }

  function openSpeedReview() {
    const queue = applicants.filter((a) => a.status === customization.stages[0].id)
    setSpeedReviewQueue(queue)
  }

  function handleSpeedReviewDecide(id: string, decision: "advance" | "waitlist" | "reject") {
    const candidate = applicants.find((a) => a.id === id)
    if (!candidate) return
    if (decision === "advance") {
      const next = STAGE_SEQUENCE[STAGE_SEQUENCE.indexOf(candidate.status) + 1]
      if (!next || candidate.status === "Rejected") return
      setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)))
      toast.success(`${candidate.name} advanced to ${stageName(next)}`)
    } else if (decision === "reject") {
      setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status: "Rejected" } : a)))
      toast.success(`${candidate.name} rejected`)
    } else {
      toast.success(`${candidate.name} moved to Waitlist / Hold`)
    }
  }

  function saveScore() {
    if (!active) return
    toast.success(`Score saved for ${active.name}`)
  }

  function movePipelineCandidate(id: string, status: Applicant["status"]) {
    const candidate = applicants.find((a) => a.id === id)
    if (!candidate || candidate.status === status || !stages.some(s => s.id === status)) return
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
    toast.success(`${candidate.name} moved to ${stageName(status)}`)
  }

  function openProfileFromPipeline(id: string) {
    const idx = pipelineFiltered.findIndex((a) => a.id === id)
    if (idx !== -1) setActiveId(id)
  }

  function rejectFromPipeline(id: string) {
    const candidate = applicants.find((a) => a.id === id)
    if (!candidate) return
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status: "Rejected" } : a)))
    toast.success(`${candidate.name} rejected`)
  }

  function sendEmail(name: string) {
    toast.success(`Email drafted for ${name}`)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function bulkAdvance() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setApplicants((prev) =>
      prev.map((a) => {
        if (!selected.has(a.id)) return a
        const currentIdx = STAGE_SEQUENCE.indexOf(a.status)
        if (currentIdx === -1 || currentIdx === STAGE_SEQUENCE.length - 1) return a
        return { ...a, status: STAGE_SEQUENCE[currentIdx + 1] }
      }),
    )
    toast.success(`${ids.length} candidate${ids.length === 1 ? "" : "s"} advanced to the next round`)
    clearSelection()
  }

  function bulkReject() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setApplicants((prev) => prev.map((a) => (selected.has(a.id) ? { ...a, status: "Rejected" as const } : a)))
    toast.success(`${ids.length} candidate${ids.length === 1 ? "" : "s"} rejected`)
    clearSelection()
  }

  function bulkMessage() {
    const count = selected.size
    if (count === 0) return
    toast.success(`Bulk message drafted for ${count} candidate${count === 1 ? "" : "s"}`)
  }

  const applicantIds = new Set(applicants.map(applicant => applicant.email.toLowerCase()))
  if (isApplied("vvf")) applicantIds.add(currentStudent.email)

  const activeFilterCount = (query ? 1 : 0) + (stage !== "All Stages" ? 1 : 0) + majors.size + years.size + (appliedMinSat !== null ? 1 : 0) + (appliedMinGpa !== null ? 1 : 0)

  return (
    <div className="space-y-4 font-sans">
      <div className="flex gap-2" role="group" aria-label="CRM pipeline">
        <Button variant="outline" aria-pressed={pipeline === "applicants"} className={cn("shadow-none", pipeline === "applicants" && "bg-black text-white hover:bg-neutral-800 hover:text-white")} onClick={() => setPipeline("applicants")}>Active Applicants</Button>
        <Button variant="outline" aria-pressed={pipeline === "leads"} className={cn("shadow-none", pipeline === "leads" && "bg-black text-white hover:bg-neutral-800 hover:text-white")} onClick={() => setPipeline("leads")}>Interested Leads</Button>
      </div>
      {pipeline === "leads" ? <LeadsTable attendance={attendance} applicantIds={applicantIds} clubId="vvf" /> : <>
      <CRMViewManager />
      <fieldset disabled={!ready} className="min-w-0 space-y-4">
      {/* Filter command bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <Select value={stage} onValueChange={(v) => setStage(v as (typeof STAGES)[number])}>
          <SelectTrigger className="h-8 w-36 text-xs" size="sm">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-neutral-200 bg-white shadow-none">
            {STAGES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {stageName(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Major / Year
              {(majors.size > 0 || years.size > 0) && (
                <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground">
                  {majors.size + years.size}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 rounded-xl border-neutral-200 bg-white p-3 shadow-none">
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Major</p>
                <div className="space-y-1.5">
                  {allMajors.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={majors.has(m)} onCheckedChange={() => toggleSet(setMajors, m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Year</p>
                <div className="space-y-1.5">
                  {allYears.map((y) => (
                    <label key={y} className="flex items-center gap-2 text-xs">
                      <Checkbox checked={years.has(y)} onCheckedChange={() => toggleSet(setYears, y)} />
                      {y}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <SlidersHorizontal className="size-3.5" /> Advanced Filters
              {(appliedMinSat !== null || appliedMinGpa !== null) && (
                <span className="ml-1 rounded-full bg-secondary px-1.5 text-[10px] font-medium text-secondary-foreground">
                  {(appliedMinSat !== null ? 1 : 0) + (appliedMinGpa !== null ? 1 : 0)}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3 rounded-xl border-neutral-200 bg-white p-3 shadow-none">
            <div className="space-y-1.5">
              <Label htmlFor="crm-min-sat" className="text-xs font-medium">SAT Score greater than</Label>
              <Input
                type="number"
                id="crm-min-sat" min={0} max={1600}
                value={minSat}
                onChange={(e) => setMinSat(e.target.value)}
                placeholder="e.g. 1450"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crm-min-gpa" className="text-xs font-medium">GPA greater than</Label>
              <Input
                type="number"
                step="0.01"
                id="crm-min-gpa" min={0} max={4}
                value={minGpa}
                onChange={(e) => setMinGpa(e.target.value)}
                placeholder="e.g. 3.7"
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" className="h-8 w-full text-xs" onClick={applyAdvancedFilters}>
              Apply
            </Button>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => {
              update(p => ({ ...p, crm: { ...p.crm, filters: emptyFilters } }))
              setMinSat("")
              setMinGpa("")
            }}
          >
            Clear filters
          </Button>
        )}

        <LiveVotingLauncher applicants={(viewMode === "pipeline" ? pipelineFiltered : sortedApplicants).map(applicant => ({
          ...applicant,
          cumulativeScore: averageScore(applicant.id, applicant.score),
          resumeHighlight: applicant.resumeHighlight ?? (applicant.email === currentStudent.email && experienceItems[0] ? `${experienceItems[0].title} — ${experienceItems[0].subtitle}` : undefined),
        }))} />
        <Button
          size="sm"
          className="h-8 bg-primary text-xs text-white hover:bg-primary/90"
          onClick={openSpeedReview}
        >
          <Zap className="size-3.5" /> Speed Review
        </Button>

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={runAutoReject}>
          <Play className="size-3.5" /> Run Auto-Reject Automation
        </Button>
      </div>

      {/* CRM pipeline (kanban) view */}
      {viewMode === "pipeline" && (
        <PipelineView
          columns={stages.map(s => ({ id: s.id, title: s.name }))}
          applicants={pipelineFiltered}
          getScore={averageScore}
          onMove={movePipelineCandidate}
          onViewProfile={openProfileFromPipeline}
          onReject={rejectFromPipeline}
          onSendEmail={sendEmail}
        />
      )}

      {/* CRM data table */}
      {viewMode === "table" && (
      <Card className="overflow-hidden rounded-xl border-neutral-200 bg-white py-0 shadow-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {crmColumns.every(column => !visible(column.id)) ? <p className="p-8 text-center text-sm text-neutral-500">All columns are hidden. Open View Settings to show columns.</p> : <Table>
              <TableHeader>
                <TableRow className="bg-white [&_th]:h-12 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
                  {visible("selection") && <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every(a => selected.has(a.id))}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>}
                  {SORT_COLUMNS.filter(column => visible(column.key)).map((column) => (
                    <TableHead key={column.key} scope="col" className={column.className}
                      aria-sort={sortConfig.key === column.key ? sortConfig.direction : "none"}>
                      <button type="button" onClick={() => requestSort(column.key)}
                        aria-label={`Sort by ${column.label} ${sortConfig.key === column.key && sortConfig.direction === "descending" ? "ascending" : "descending"}`}
                        className={cn("flex min-h-10 w-full cursor-pointer select-none items-center gap-1 whitespace-nowrap rounded px-1 text-left text-[11px] font-medium uppercase tracking-wide transition-colors hover:bg-neutral-50 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400", column.key === "score" && "justify-end", sortConfig.key === column.key && "text-neutral-900")}>
                        {column.label}
                        <span className="inline-flex size-3 shrink-0" aria-hidden="true">
                          {sortConfig.key === column.key && (sortConfig.direction === "ascending" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />)}
                        </span>
                      </button>
                    </TableHead>
                  ))}
                  {visible("events") && <TableHead>Events Attended</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedApplicants.map((a) => (
                  <TableRow
                    key={a.id}
                    onClick={() => setActiveId(a.id)}
                    data-state={selected.has(a.id) ? "selected" : undefined}
                    className="cursor-pointer text-xs transition-colors hover:bg-neutral-50 [&_td]:h-16 [&_td]:py-4"
                  >
                    {visible("selection") && <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleRow(a.id)} aria-label={`Select ${a.name}`} />
                    </TableCell>}
                    {visible("name") && <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback className="bg-muted text-[10px] font-medium">{a.initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{a.name}</p>
                        </div>
                      </div>
                    </TableCell>}
                    {visible("year") && <TableCell className="text-muted-foreground">{a.year}</TableCell>}
                    {visible("major") && <TableCell className="truncate text-muted-foreground">{a.major}</TableCell>}
                    {visible("gpa") && <TableCell className="font-sans tabular-nums">{a.gpa}</TableCell>}
                    {visible("satScore") && <TableCell className="font-sans tabular-nums">{a.satScore}</TableCell>}
                    {visible("status") && <TableCell>
                      <select aria-label={`Recruitment stage for ${a.name}`} value={a.status} onClick={event => event.stopPropagation()} onChange={event => movePipelineCandidate(a.id, event.target.value)} className="max-w-44 rounded-md border border-neutral-200 bg-white p-1.5 text-xs">{stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </TableCell>}
                    {visible("score") && <TableCell className="pr-4 text-right font-sans font-medium">
                      {averageScore(a.id, a.score) > 0 ? averageScore(a.id, a.score).toFixed(1) : "—"}
                    </TableCell>}
                    {visible("events") && <TableCell className="tabular-nums">{eventsAttended(attendance, "vvf", a.email.toLowerCase())}</TableCell>}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={Math.max(1, crmColumns.filter(column => visible(column.id)).length)} className="py-10 text-center text-sm text-muted-foreground">
                      No applicants match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>}
          </div>
        </CardContent>
      </Card>
      )}

      </fieldset>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-foreground px-4 py-2 shadow-none">
            <span className="whitespace-nowrap text-xs font-medium text-white">
              {selected.size} candidate{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="h-5 w-px bg-white/20" />
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkAdvance}
              className="h-7 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-muted-foreground"
            >
              <ArrowUpRight className="size-3.5" />
              Advance Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkReject}
              className="h-7 gap-1.5 px-2 text-xs font-medium text-red-400 hover:bg-white/10 hover:text-red-400"
            >
              <X className="size-3.5" />
              Reject Selected
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkMessage}
              className="h-7 gap-1.5 px-2 text-xs font-medium text-white hover:bg-white/10 hover:text-white"
            >
              <Mail className="size-3.5" />
              Send Bulk Message
            </Button>
            <div className="h-5 w-px bg-white/20" />
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelection}
              aria-label="Clear selection"
              className="size-6 text-white hover:bg-white/10 hover:text-white"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Side profile drawer */}
      <Sheet open={activeId !== null} onOpenChange={(o) => !o && setActiveId(null)}>
        <SheetContent className="w-full gap-0 overflow-hidden p-0 sm:max-w-[45vw]">
          {active && (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b pr-20">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11">
                    <AvatarFallback className="bg-secondary font-medium text-foreground">{active.initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{active.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {active.major} · {active.year}
                    </p>
                  </div>
                  <StatusBadge status={stageName(active.status)} />
                </div>
              </SheetHeader>

              <div className="absolute right-12 top-3.5 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={activeIndex <= 0}
                  onClick={() => setActiveId(navList[activeIndex - 1]?.id ?? activeId)}
                  aria-label="Previous candidate"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={activeIndex < 0 || activeIndex >= navList.length - 1}
                  onClick={() => setActiveId(navList[activeIndex + 1]?.id ?? activeId)}
                  aria-label="Next candidate"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <Tabs defaultValue="application" className="flex flex-1 flex-col gap-0 overflow-hidden">
                <div className="border-b px-4">
                  <TabsList className="h-auto bg-transparent p-0">
                    <TabsTrigger
                      value="application"
                      className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Application
                    </TabsTrigger>
                    <TabsTrigger
                      value="rubric"
                      className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Screening Rubric
                    </TabsTrigger>
                    <TabsTrigger
                      value="history"
                      className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Evaluation History
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="application" className="flex-1 space-y-4 overflow-y-auto p-4">
                  <h3 className="text-sm font-semibold font-sans tracking-tight">Essays</h3>
                  {active.essays.map((essay, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">{essay.question}</p>
                      <p className="mt-1.5 text-pretty text-sm leading-relaxed">{essay.answer}</p>
                    </div>
                  ))}

                  {active.links.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold font-sans tracking-tight">Links</h3>
                      <div className="flex flex-wrap gap-2">
                        {active.links.map((link) => (
                          <span
                            key={link.url}
                            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            <LinkIcon className="size-3" />
                            {link.label} — {link.url}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-sm font-semibold font-sans tracking-tight">Resume</h3>
                    <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border bg-muted/30 text-muted-foreground">
                      <FileText className="size-8" />
                      <p className="text-xs font-medium">{active.resumeFileName}</p>
                      <p className="text-[11px]">Embedded PDF preview</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="rubric" className="flex-1 space-y-6 overflow-y-auto p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold font-sans tracking-tight">Screening rubric</h3>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {averageScore(active.id, active.score).toFixed(1)} avg
                    </span>
                  </div>

                  <div className="space-y-5">
                    {SCORING_CRITERIA.map((c) => {
                      const value = scores[active.id]?.[c.id] ?? 5
                      return (
                        <div key={c.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">{c.label}</Label>
                            <span className="font-sans text-sm tabular-nums text-muted-foreground">{value}/5</span>
                          </div>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[value]}
                            onValueChange={([v]) => setCriterionScore(active.id, c.id, v)}
                          />
                        </div>
                      )
                    })}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-sm font-medium">
                      Screener Notes
                    </Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      placeholder="Leave feedback for your exec team…"
                      value={notes[active.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [active.id]: e.target.value }))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
                  {(() => {
                    const stages = customization.stages.map((stage, index) => {
                      const round = stage.id === "Round 1" ? roundAggregate("round-1") : stage.id === "Round 2" ? roundAggregate("round-2") : null
                      return {
                        key: stage.id,
                        title: stage.name,
                        subtitle: index === 0 ? "Initial screener review" : "Recruitment evaluation",
                        locked: !reachedStage(active.status, stage.id),
                        score: round?.score ?? (index === 0 ? averageScore(active.id, active.score) : null),
                        scoreLabel: "/5",
                        notes: round?.notes ?? (index === 0 && notes[active.id] ? [{ interviewer: "Screener", initials: "SC", note: notes[active.id] }] : []),
                      }
                    })

                    return (
                      <div className="relative space-y-6 pl-2">
                        {stages.map((stage, i) => (
                          <div key={stage.key} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                                  stage.locked
                                    ? "border-gray-200 bg-gray-100 text-gray-400"
                                    : "border-foreground bg-foreground text-white",
                                )}
                              >
                                {stage.locked ? <Lock className="size-3" /> : i + 1}
                              </div>
                              {i < stages.length - 1 && (
                                <div className={cn("mt-1 w-px flex-1", stage.locked ? "bg-gray-200" : "bg-foreground/20")} />
                              )}
                            </div>

                            <div className={cn("flex-1 pb-2", stage.locked && "opacity-60")}>
                              {stage.locked ? (
                                <div className="rounded-lg border border-dashed border-gray-200 bg-white p-3.5">
                                  <div className="flex items-center gap-2">
                                    <Lock className="size-3.5 text-gray-400" />
                                    <p className="text-sm font-semibold text-gray-500">{stage.title}</p>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-400">
                                    Locked — candidate has not reached this stage yet.
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-lg border border-gray-200 bg-white p-3.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{stage.title}</p>
                                      <p className="text-xs text-muted-foreground">{stage.subtitle}</p>
                                    </div>
                                    {stage.score !== null && (
                                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                        {stage.score.toFixed(1)}
                                        {stage.scoreLabel}
                                      </span>
                                    )}
                                  </div>

                                  {stage.notes.length > 0 ? (
                                    <div className="mt-2.5 space-y-2">
                                      {stage.notes.map((n, idx) => (
                                        <div key={idx} className="flex gap-2 rounded-md bg-white p-2">
                                          <Avatar className="size-6 shrink-0">
                                            <AvatarFallback className="text-[10px]">{n.initials}</AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0">
                                            <p className="text-xs font-medium text-foreground">{n.interviewer}</p>
                                            <p className="text-xs leading-relaxed text-muted-foreground">{n.note}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-2.5 text-xs italic text-muted-foreground">
                                      Awaiting scores from the Live Interview Workspace.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </TabsContent>
              </Tabs>

              <div className="mt-auto flex items-center gap-2 border-t bg-background p-4">
                <Button variant="outline" className="flex-1" onClick={saveScore}>
                  <Check className="size-4" /> Save Score
                </Button>
                <Button
                  className="flex-1 bg-primary text-white hover:bg-primary/90"
                  onClick={promoteToNextRound}
                  disabled={active.status === "Accepted" || active.status === "Rejected"}
                >
                  <ArrowUpRight className="size-4" /> Promote to Next Round
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {speedReviewQueue && (
        <SpeedReviewMode
          candidates={speedReviewQueue}
          onClose={() => setSpeedReviewQueue(null)}
          onDecide={handleSpeedReviewDecide}
        />
      )}
      </>}
    </div>
  )
}
