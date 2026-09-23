"use client"

import { WorkspaceLoading } from "@/components/workspace-loading"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react"
import { BoardDecisionMode } from "@/components/live-voting/board-decision-mode"
import { getClubPipeline, moveApplicantRound, setApplicationStatus } from "@/actions/crm"
import { submitEvaluation } from "@/actions/evaluations"
import { useApplicationState } from "@/lib/application-state"
import { useAuth, type ExtendedMembership } from "@/contexts/auth-context"
import { useDemoMode } from "@/contexts/demo-context"
import { safeProfileUrl } from "@/lib/student-profile"
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
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
  app.evaluations.length
    ? app.evaluations.reduce((total, item) => total + item.score, 0) / app.evaluations.length
    : null

export function LiveLeaderWorkspace() {
  const { user } = useAuth()
  const { leaderFocus } = useApplicationState()
  const { isDemoEnabled } = useDemoMode()
  const clubs = (user?.memberships || []).filter(
    (item) => item.role === "PRESIDENT" || item.role === "RECRUITMENT_LEAD",
  )
  const [clubId, setClubId] = useState("")
  useEffect(() => {
    if (leaderFocus) setClubId(leaderFocus.clubId)
  }, [leaderFocus])
  const club = clubs.find((item) => item.clubId === clubId) || clubs[0]
  if (!club)
    return (
      <div className="space-y-3 py-10">
        <h2 className="text-xl font-semibold">No recruitment workspace assigned</h2>
        <p className="text-sm text-muted-foreground">
          A president or recruitment-lead role is required to open a club’s workspace.
        </p>
      </div>
    )
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Recruitment workspace
          </p>
          <h2 className="mt-2 font-display text-3xl">{club.club.name}</h2>
        </div>
        {clubs.length > 1 && (
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
      </div>
      <ClubWorkspace key={club.clubId} membership={club} />
    </div>
  )
}

function ClubWorkspace({ membership }: { membership: ExtendedMembership }) {
  const { leaderFocus, clearLeaderFocus } = useApplicationState()
  const [data, setData] = useState<Pipeline | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [round, setRound] = useState("")
  const [status, setStatus] = useState("")
  const [review, setReview] = useState("")
  const [major, setMajor] = useState("")
  const [year, setYear] = useState("")
  const [gpa, setGpa] = useState("")
  const [sat, setSat] = useState("")
  const [compact, setCompact] = useState(true)
  const [sort, setSort] = useState("name")
  const [descending, setDescending] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [baseline, setBaseline] = useState("")
  const [decision, setDecision] = useState("")
  const [targetRound, setTargetRound] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify([score, notes]) !== baseline && !!activeId
  useEffect(() => {
    let current = true
    setLoading(true)
    setError("")
    
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
          setLoading(false)
        })
      }, 300)
      return () => { current = false }
    }

    getClubPipeline(membership.clubId)
      .then((result) => {
        if (current) setData(result)
      })
      .catch(() => {
        if (current) setError("Couldn’t load this club’s applicants. Please try again.")
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [membership.clubId, revision])
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
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, busy])
  const applicants = data?.applications || []
  const filtered = useMemo(
    () =>
      applicants
        .filter((app) => {
          const profile = app.student.studentProfile
          return (
            `${name(app)} ${app.student.email} ${profile?.major || ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()) &&
            (!round || app.roundId === round) &&
            (!status || app.status === status) &&
            (!major || profile?.major === major) &&
            (!year || String(profile?.gradYear) === year) &&
            (!gpa || (profile?.gpa != null && profile.gpa > Number(gpa))) &&
            (!sat || (profile?.satScore != null && profile.satScore > Number(sat))) &&
            (!review ||
              (review === "unreviewed"
                ? app.evaluations.length === 0
                : app.evaluations.some((item) => item.interviewerId === membership.id)))
          )
        })
        .sort((a, b) => {
          let value = 0
          if (sort === "score") {
            const left = average(a),
              right = average(b)
            if (left === null || right === null)
              return left === right ? name(a).localeCompare(name(b)) : left === null ? 1 : -1
            value = left - right
          } else if (sort === "year")
            value =
              (a.student.studentProfile?.gradYear || 0) - (b.student.studentProfile?.gradYear || 0)
          else if (sort === "status") value = a.status.localeCompare(b.status)
          else value = name(a).localeCompare(name(b))
          return (descending ? -value : value) || a.id.localeCompare(b.id)
        }),
    [
      applicants,
      query,
      round,
      status,
      major,
      year,
      gpa,
      sat,
      review,
      sort,
      descending,
      membership.id,
    ],
  )
  const active = applicants.find((app) => app.id === activeId)
  const activeIndex = filtered.findIndex((app) => app.id === activeId)
  useEffect(() => {
    if (!data || loading || !leaderFocus || leaderFocus.clubId !== membership.clubId) return
    if (leaderFocus.roundId) setRound(leaderFocus.roundId)
    if (leaderFocus.applicantId) {
      const target = data.applications.find((app) => app.id === leaderFocus.applicantId)
      if (target) open(target)
    }
    clearLeaderFocus()
  }, [data, loading, leaderFocus, membership.clubId, clearLeaderFocus])
  function open(app?: Candidate) {
    if (busy || (dirty && !window.confirm("Discard your unsaved review changes?"))) return
    setActiveId(app?.id || null)
    setMessage("")
    setDecision("")
    if (app) {
      const roundName = data?.rounds.find((item) => item.id === app.roundId)?.name
      const mine = app.evaluations.find(
        (item) => item.interviewerId === membership.id && item.round === roundName,
      )
      const value = mine ? String(mine.score) : ""
      setScore(value)
      setNotes(mine?.notes || "")
      setBaseline(JSON.stringify([value, mine?.notes || ""]))
      setTargetRound(app.roundId)
      requestAnimationFrame(() => heading.current?.focus())
    } else
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>(`[data-applicant-id="${CSS.escape(activeId || "")}"]`)
          ?.focus()
      })
  }
  async function mutate(kind: "review" | "round" | "decision") {
    if (!active || busy) return
    if (kind === "review" && (!score || Number(score) < 1 || Number(score) > 10)) {
      setMessage("Enter a score from 1 to 10 before saving your evaluation.")
      return
    }
    setBusy(true)
    setMessage("")
    try {
      if (kind === "review") {
        const roundName = data?.rounds.find((item) => item.id === active.roundId)?.name
        if (!roundName) throw new Error()
        let result
        if (isDemoEnabled) {
          result = {
            success: true,
            evaluation: {
              id: crypto.randomUUID(),
              applicationId: active.id,
              clubId: membership.clubId,
              evaluatorId: user?.id,
              roundName: targetRound,
              score: Number(score),
              notes,
              createdAt: new Date(),
            }
          }
        } else {
          result = await submitEvaluation({
            clubId: membership.clubId,
            applicationId: active.id,
            roundName: targetRound,
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
        setMessage("Evaluation saved.")
      } else if (kind === "round") {
        await moveApplicantRound({
          clubId: membership.clubId,
          applicationId: active.id,
          newRoundId: targetRound,
        })
        setData((previous) =>
          previous
            ? {
                ...previous,
                applications: previous.applications.map((app) =>
                  app.id === active.id ? { ...app, roundId: targetRound } : app,
                ),
              }
            : previous,
        )
        const mine = active.evaluations.find(
          (item) =>
            item.interviewerId === membership.id &&
            item.round === data?.rounds.find((item) => item.id === targetRound)?.name,
        )
        setScore(mine ? String(mine.score) : "")
        setNotes(mine?.notes || "")
        setBaseline(JSON.stringify([mine ? String(mine.score) : "", mine?.notes || ""]))
        setMessage("Round updated. Application status is unchanged.")
      } else {
        await setApplicationStatus({
          clubId: membership.clubId,
          applicationId: active.id,
          status: decision as "ACCEPTED",
        })
        setData((previous) =>
          previous
            ? {
                ...previous,
                applications: previous.applications.map((app) =>
                  app.id === active.id ? { ...app, status: decision as Candidate["status"] } : app,
                ),
              }
            : previous,
        )
        setDecision("")
        setMessage("Application status updated.")
      }
    } catch {
      setMessage(
        "This change could not be saved. Your entries are still here. Check your access and try again.",
      )
    } finally {
      setBusy(false)
    }
  }
  function sortBy(key: string) {
    if (sort === key) setDescending((value) => !value)
    else {
      setSort(key)
      setDescending(false)
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
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-5 border-y border-border py-5 sm:grid-cols-4">
        {[
          ["Submitted applicants", applicants.length],
          ["Unreviewed", applicants.filter((app) => !app.evaluations.length).length],
          ["Interviewing", applicants.filter((app) => app.status === "INTERVIEWING").length],
          ["Accepted", applicants.filter((app) => app.status === "ACCEPTED").length],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-xs text-muted-foreground">
        {data.rounds.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRound(round === item.id ? "" : item.id)}
            aria-pressed={round === item.id}
            className="rounded px-1 py-1 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
          >
            {item.name}{" "}
            <span className="ml-2 font-semibold text-foreground">
              {applicants.filter((app) => app.roundId === item.id).length}
            </span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            ref={search}
            aria-label="Search applicants"
            placeholder="Name, email, or major · /"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter round"
          className={selectStyle}
          value={round}
          onChange={(event) => setRound(event.target.value)}
        >
          <option value="">All rounds</option>
          {data.rounds.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
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
          aria-pressed={compact}
          onClick={() => setCompact((value) => !value)}
        >
          {compact ? "Compact rows" : "Comfortable rows"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRevision((value) => value + 1)}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>
      <BoardDecisionMode
        applicants={filtered}
        rounds={data.rounds}
        clubId={membership.clubId}
        clubName={membership.club.name}
        canDecide={membership.role === "PRESIDENT"}
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
      />
      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded py-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
          Academic filters
        </summary>
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
            aria-label="Filter graduation year"
            className={selectStyle}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All years</option>
            {[
              ...new Set(
                applicants.flatMap((app) =>
                  app.student.studentProfile ? [app.student.studentProfile.gradYear] : [],
                ),
              ),
            ]
              .sort()
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
      </details>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground" role="status">
          {filtered.length} of {applicants.length} applicants · scores out of 10
        </p>
        {(query || round || status || review || major || year || gpa || sat) && (
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
              setSat("")
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                ["name", "Applicant"],
                ["year", "Education"],
                ["round", "Round"],
                ["status", "Status"],
                ["score", "Avg score"],
                ["review", "Review state"],
              ].map(([key, label]) => (
                <TableHead
                  key={key}
                  aria-sort={sort === key ? (descending ? "descending" : "ascending") : undefined}
                >
                  {["round", "review"].includes(key) ? (
                    label
                  ) : (
                    <button
                      type="button"
                      onClick={() => sortBy(key)}
                      className="py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {label}
                      {sort === key ? (descending ? " ↓" : " ↑") : ""}
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((app) => (
              <TableRow key={app.id} className="hover:bg-secondary/40">
                <TableCell className={compact ? "py-3" : "py-5"}>
                  <button
                    data-applicant-id={app.id}
                    type="button"
                    onClick={() => open(app)}
                    className="flex items-center gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <Avatar className="size-8">
                      <AvatarImage
                        src={safeProfileUrl(app.student.studentProfile?.headshotUrl)}
                        alt=""
                      />
                      <AvatarFallback className="text-xs">
                        {name(app)
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      <span className="block text-sm font-medium">{name(app)}</span>
                      <span className="text-xs text-muted-foreground">{app.student.email}</span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="text-xs">
                  <span className="block">
                    {app.student.studentProfile?.major || "Not provided"}
                  </span>
                  <span className="text-muted-foreground">
                    {app.student.studentProfile?.gradYear
                      ? `Class of ${app.student.studentProfile.gradYear}`
                      : ""}
                  </span>
                </TableCell>
                <TableCell className="text-xs">
                  {data.rounds.find((item) => item.id === app.roundId)?.name || "Not available"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{applicationStatusLabels[app.status]}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{average(app)?.toFixed(1) ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {app.evaluations.length ? `${app.evaluations.length} evaluations` : "Unreviewed"}
                </TableCell>
              </TableRow>
            ))}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  {applicants.length
                    ? "No applicants match these filters."
                    : "Submitted applications will appear here. Student drafts stay private."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Sheet
        open={!!active}
        onOpenChange={(value) => {
          if (!value) open()
        }}
      >
        <SheetContent
          className="w-full overflow-y-auto p-6 sm:max-w-2xl"
          onInteractOutside={(event) => {
            if (dirty || busy) event.preventDefault()
          }}
        >
          {active && (
            <>
              <SheetHeader className="px-0 pr-10">
                <Avatar className="size-12">
                  <AvatarImage
                    src={safeProfileUrl(active.student.studentProfile?.headshotUrl)}
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
                  className="text-xl focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {name(active)}
                </SheetTitle>
                <SheetDescription>
                  {active.student.studentProfile?.major || "Academic profile not provided"} ·{" "}
                  {active.student.email}
                </SheetDescription>
              </SheetHeader>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
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
                <h3 className="text-sm font-semibold">Profile</h3>
                {active.student.studentProfile ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-7">
                      {active.student.studentProfile.bio || "No introduction provided."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Class of {active.student.studentProfile.gradYear}
                      {active.student.studentProfile.gpa != null &&
                        ` · GPA ${active.student.studentProfile.gpa}`}
                      {active.student.studentProfile.satScore != null &&
                        ` · SAT ${active.student.studentProfile.satScore}`}
                    </p>
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
                        ["Résumé", active.student.studentProfile.resumeUrl],
                        ["LinkedIn", active.student.studentProfile.linkedinUrl],
                      ].map(
                        ([label, url]) =>
                          safeProfileUrl(url) && (
                            <a
                              key={label}
                              href={safeProfileUrl(url)}
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
              <section className="space-y-5 border-b border-border pb-6">
                <h3 className="text-sm font-semibold">Application responses</h3>
                {active.answers.map((answer) => (
                  <div key={answer.id}>
                    <h4 className="text-sm font-medium leading-6">{answer.question.prompt}</h4>
                    {answer.question.type === "FILE_UPLOAD" && safeProfileUrl(answer.response) ? (
                      <a
                        className="mt-2 inline-block text-sm underline"
                        href={safeProfileUrl(answer.response)}
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
                  <p className="text-sm text-muted-foreground">No club-specific responses.</p>
                )}
              </section>
              <section className="space-y-4 border-b border-border pb-6">
                <h3 className="text-sm font-semibold">Evaluations</h3>
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
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void mutate("review")
                  }}
                  className="space-y-3"
                >
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
                    disabled={busy}
                    onChange={(event) => setScore(event.target.value)}
                  />
                  <Label htmlFor="review-notes">Notes for club reviewers</Label>
                  <Textarea
                    id="review-notes"
                    rows={4}
                    value={notes}
                    disabled={busy}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <Button disabled={busy} type="submit">
                      {busy ? "Saving…" : "Save evaluation"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {dirty ? "Unsaved changes" : score ? "Saved review" : "No review saved"}
                    </span>
                  </div>
                </form>
              </section>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Recruitment actions</h3>
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
                    disabled={busy || dirty || targetRound === active.roundId}
                    onClick={() => void mutate("round")}
                  >
                    Move round
                  </Button>
                </div>
                <p className="text-xs leading-6 text-muted-foreground">
                  Moving rounds does not change the student-visible application status. Save your
                  review before moving.
                </p>
                {membership.role === "PRESIDENT" ? (
                  <div className="flex flex-wrap gap-2">
                    {(["IN_REVIEW", "INTERVIEWING", "WAITLISTED", "ACCEPTED", "REJECTED"] as const)
                      .filter((value) => value !== active.status)
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
                    Only the club president can change application status or issue decisions.
                  </p>
                )}
              </section>
              <p role="status" className="text-sm leading-6">
                {message}
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={!!decision}
        onOpenChange={(value) => {
          if (!value && !busy) setDecision("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update application status?</DialogTitle>
            <DialogDescription>
              {active && name(active)} will see their application marked{" "}
              {applicationStatusLabels[decision]}. The applicant will see this status in OutClass.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setDecision("")}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void mutate("decision")}>
              {busy ? "Updating…" : "Confirm status"}
            </Button>
          </div>
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
