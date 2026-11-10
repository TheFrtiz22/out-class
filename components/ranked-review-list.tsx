"use client"
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { getRankedReviewRound, getRankedReviewSettings, saveRankedReviewBands } from "@/lib/workspace-api"
import { ApplicantIdentity } from "@/components/applicant-identity"
import { VotingSelection } from "@/components/views/leader-dashboard/live-applicant-views"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Lock } from "@/components/icons"
import { useRevalidate } from "@/hooks/use-revalidate"
import { formatAverage, scoredEvaluationsLabel } from "@/lib/interview-review-summary"
import { NO_INTERVIEW_SCORES } from "@/lib/interview-feedback"
import { profilePhotoSource } from "@/lib/profile-photo"
import { applicationStatusLabels } from "@/lib/application-status"
import { RANKED_REVIEW_NO_CYCLE, bandsFromBoundaries, rankedBandLabels, rankedBandOrder, rankedCycleKey, rankedReviewView, rankingSignature, validateBands, type RankedBand, type RankedBands } from "@/lib/ranked-review"
import { VotingTargetSummary, type ScopedTargetSummary } from "@/components/voting-target-summary"
import { bandCounts } from "@/lib/voting-target-summary"
import "./ranked-review-list.css"

type Pipeline = Awaited<ReturnType<typeof getRankedReviewRound>>
type Settings = Awaited<ReturnType<typeof getRankedReviewSettings>>
export type RankedReviewApi = {
  loadRound: (roundId: string) => Promise<Pipeline>
  loadSettings: (roundId: string) => Promise<Settings>
  saveBands: (input: Parameters<typeof saveRankedReviewBands>[0]) => Promise<{ revision: number; bands: RankedBands | null }>
  /** Entire-round target and decision counts (server-authorized, counts only). Optional: omitted, decisions are not shown. */
  loadRoundSummary?: (input: { roundId: string; cycleId?: string }) => Promise<ScopedTargetSummary>
}
type Round = { id: string; name: string; anonymousReview: boolean }
type Snapshot = { roundId: string; data: Pipeline; settings: Settings; signature: string }
type Row = { id: string; name: string; photo: string | null; anonymous: boolean; cycle: string; average: number | null; submitted: number; required: number; visible: boolean; status: string }
type ShownRow = Row & { rank?: number; band?: RankedBand | null }

const selectStyle = "h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
/** Large rounds render in steps so the first ranks paint quickly; every applicant stays reachable. */
const RANKED_PAGE_SIZE = 200

function toRows(data: Pipeline, roundId: string): Row[] {
  // Server reads are already scoped to the round; this keeps another round's rows out by construction.
  return data.applications.filter(app => app.roundId === roundId).map(app => {
    const anonymous = app.studentId.startsWith("anonymous-")
    const profile = app.student.studentProfile
    const summary = app.roundScore
    return { id: app.id, anonymous, status: app.status,
      name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : app.student.email,
      photo: anonymous ? null : profilePhotoSource(profile?.headshotUrl) ?? null,
      cycle: anonymous ? RANKED_REVIEW_NO_CYCLE : rankedCycleKey(app.recruitmentCycleId),
      visible: !!summary, average: summary?.average ?? null, submitted: summary?.submitted ?? 0, required: summary?.required ?? 0 }
  })
}
const signatureOf = (data: Pipeline, settings: Settings, roundId: string) =>
  JSON.stringify([rankingSignature(toRows(data, roundId).map(r => ({ ...r, label: r.name }))), settings.scopes])

/**
 * Compact, round-specific ranked review list. Ranking uses only the already
 * authorized `roundScore`; hidden scores are never ranked. New results never
 * reorder the list on their own: they wait behind an explicit refresh.
 */
export function RankedReviewList({ clubId, rounds, initialRoundId, api, onOpen, votingSelection, votingLink, changeSignal = 0 }: {
  clubId: string
  rounds: Round[]
  initialRoundId?: string
  api: RankedReviewApi
  onOpen: (applicationId: string) => void
  votingSelection?: { ids: string[]; toggle: (id: string) => void }
  votingLink?: ReactNode
  /** Bumped by the host after a review is saved elsewhere; triggers a background check only. */
  changeSignal?: number
}) {
  const [roundId, setRoundId] = useState(initialRoundId && rounds.some(r => r.id === initialRoundId) ? initialRoundId : rounds[0]?.id ?? "")
  const [loaded, setShown] = useState<Snapshot | null>(null)
  // Only the selected round's snapshot is ever rendered: while another round loads, nothing from the previous one shows.
  const shown = loaded?.roundId === roundId ? loaded : null
  const [pendingSnapshot, setPending] = useState<Snapshot | null>(null)
  const pending = pendingSnapshot?.roundId === roundId ? pendingSnapshot : null
  const [error, setError] = useState("")
  const [checkFailed, setCheckFailed] = useState(false)
  const [chosenCycle, setChosenCycle] = useState<string | null>(null)
  // Selection, cycle and pending results belong to one club + round; switching rounds clears them.
  const [selection, setSelection] = useState<{ key: string; id: string } | null>(null)
  const selectedId = selection?.key === `${clubId}:${roundId}` ? selection.id : null
  const ticket = useRef(0)
  const [roundSummary, setRoundSummary] = useState<{ key: string; value: ScopedTargetSummary | null; failed: boolean } | null>(null)
  const [summaryTick, setSummaryTick] = useState(0)
  const summaryTicket = useRef(0)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const listRoot = useRef<HTMLElement>(null)
  const [limit, setLimit] = useState({ key: "", count: RANKED_PAGE_SIZE })

  const load = useCallback(async (target: string) => {
    const mine = ++ticket.current
    setError(""); setPending(null); setCheckFailed(false)
    try {
      const [data, settings] = await Promise.all([api.loadRound(target), api.loadSettings(target)])
      if (mine !== ticket.current) return
      setShown({ roundId: target, data, settings, signature: signatureOf(data, settings, target) })
    } catch {
      if (mine === ticket.current) { setShown(null); setError("Couldn’t load this round’s ranking. Your access may have changed.") }
    }
  }, [api])
  useEffect(() => { if (roundId) void load(roundId) }, [roundId, load])

  // Background check: never replaces what is on screen. A difference raises "Updated results available".
  const check = useCallback(async () => {
    const current = shown
    if (!current) return
    setSummaryTick(v => v + 1)
    const mine = ticket.current
    try {
      const [data, settings] = await Promise.all([api.loadRound(current.roundId), api.loadSettings(current.roundId)])
      if (mine !== ticket.current) return
      setCheckFailed(false)
      const signature = signatureOf(data, settings, current.roundId)
      setPending(signature === current.signature ? null : { roundId: current.roundId, data, settings, signature })
    } catch { if (mine === ticket.current) setCheckFailed(true) }
  }, [api, shown])
  useRevalidate(check, { scopes: ["applicants", "decisions"], enabled: !!shown })
  const lastSignal = useRef(changeSignal)
  useEffect(() => { if (lastSignal.current !== changeSignal) { lastSignal.current = changeSignal; void check() } }, [changeSignal, check])

  function applyPending() {
    if (!pending) return
    ticket.current++
    setShown(pending); setPending(null)
    requestAnimationFrame(() => listHeading.current?.focus())
  }

  const round = rounds.find(r => r.id === roundId)
  const anonymousRound = !!round?.anonymousReview
  // Rows depend only on the loaded data, so saving bands or selecting never rebuilds them.
  const shownData = shown?.data, shownRound = shown?.roundId
  const rows = useMemo(() => shownData && shownRound ? toRows(shownData, shownRound) : [], [shownData, shownRound])
  const cycleOptions = useMemo(() => {
    if (!shown || anonymousRound) return []
    const present = new Set(rows.map(r => r.cycle))
    const named = shown.settings.cycles.filter(c => present.has(c.id)).map(c => ({ key: c.id, label: c.name }))
    const unknown = [...present].filter(key => key !== RANKED_REVIEW_NO_CYCLE && !named.some(c => c.key === key)).sort().map(key => ({ key, label: "Unnamed cycle" }))
    return [...named, ...unknown, ...(present.has(RANKED_REVIEW_NO_CYCLE) ? [{ key: RANKED_REVIEW_NO_CYCLE, label: "No cycle recorded" }] : [])]
  }, [shown, rows, anonymousRound])
  const cycleKey = anonymousRound ? RANKED_REVIEW_NO_CYCLE : cycleOptions.find(c => c.key === chosenCycle)?.key ?? cycleOptions[0]?.key ?? RANKED_REVIEW_NO_CYCLE
  const setting = shown?.settings.scopes[cycleKey] ?? { bands: null, revision: 0 }
  const settingBands = setting.bands
  // Ranking, bands and ties are derived once per data/scope/bands change, never on selection or voting toggles.
  const view = useMemo(() => rankedReviewView(rows.filter(r => r.cycle === cycleKey || anonymousRound), settingBands), [rows, cycleKey, anonymousRound, settingBands])
  const { ranked, notScored, hidden, banded, byBand, ties, tiedRanks } = view
  const canManage = !!shown?.settings.canManage
  const bandSummary = useMemo(() => shown ? bandCounts({ banded, notScored: notScored.length, hidden: hidden.length, bandsSet: !!settingBands }) : null, [shown, banded, notScored, hidden, settingBands])
  // Decision counts follow the same round and cycle as the list; applicants without a cycle have no voting room.
  const summaryCycle = anonymousRound ? undefined : cycleKey === RANKED_REVIEW_NO_CYCLE ? null : cycleKey
  const summaryKey = shown && api.loadRoundSummary && summaryCycle !== null ? `${shown.roundId}:${summaryCycle ?? "all"}` : ""
  useEffect(() => {
    if (!summaryKey || !shown || !api.loadRoundSummary) return
    const mine = ++summaryTicket.current
    api.loadRoundSummary({ roundId: shown.roundId, ...(summaryCycle ? { cycleId: summaryCycle } : {}) })
      .then(value => { if (mine === summaryTicket.current) setRoundSummary({ key: summaryKey, value, failed: false }) })
      .catch(() => { if (mine === summaryTicket.current) setRoundSummary({ key: summaryKey, value: null, failed: true }) })
  }, [summaryKey, summaryTick]) // eslint-disable-line react-hooks/exhaustive-deps
  const currentSummary = roundSummary?.key === summaryKey ? roundSummary : null
  const summaryStatus = !api.loadRoundSummary ? undefined : summaryCycle === null ? "Voting decisions are recorded per recruitment cycle." : currentSummary?.failed ? "Round decisions unavailable." : !currentSummary ? "Loading…" : undefined
  const selectedMissing = !!selectedId && !!shown && !rows.some(r => r.id === selectedId)

  // Stable handlers so unchanged rows skip re-rendering; the host's toggle may change identity every render.
  const onOpenRef = useRef(onOpen), toggleRef = useRef(votingSelection?.toggle)
  useEffect(() => { onOpenRef.current = onOpen; toggleRef.current = votingSelection?.toggle })
  // Selection is keyed by club + round, so it never carries into another round.
  const select = useCallback((id: string) => { setSelection({ key: `${clubId}:${roundId}`, id }); onOpenRef.current(id) }, [clubId, roundId])
  const toggle = useCallback((id: string) => toggleRef.current?.(id), [])
  const votingIds = votingSelection?.ids
  const chosen = useMemo(() => new Set(votingIds), [votingIds])
  const voting = !!votingSelection

  // Display order: ranked (by band when set), then Not scored, then hidden. Only the first `visibleCount` render.
  const ordered = useMemo(() => [...(settingBands ? rankedBandOrder.flatMap(b => byBand[b]) : banded), ...notScored, ...hidden], [settingBands, byBand, banded, notScored, hidden])
  const limitKey = `${shown?.roundId ?? ""}:${cycleKey}`
  const requested = limit.key === limitKey ? limit.count : RANKED_PAGE_SIZE
  const selectedIndex = selectedId ? ordered.findIndex(r => r.id === selectedId) : -1
  // The open applicant always stays on screen, even after a refresh moves them down.
  const visibleCount = Math.min(ordered.length, Math.max(requested, selectedIndex + 1))
  const remaining = ordered.length - visibleCount
  function showMore(count: number) {
    const next = ordered[visibleCount]?.id
    setLimit({ key: limitKey, count: visibleCount + count })
    // Keyboard users continue from the first newly shown applicant.
    if (next) requestAnimationFrame(() => listRoot.current?.querySelector<HTMLButtonElement>(`button[data-applicant-id="${CSS.escape(next)}"]`)?.focus())
  }

  let budget = visibleCount
  const take = <T,>(items: readonly T[]) => { const part = items.slice(0, Math.max(0, budget)); budget -= part.length; return part }
  const renderRow = (r: ShownRow) => <RankedRow key={r.id} row={r} tied={r.rank !== undefined && tiedRanks.has(r.rank)} selected={selectedId === r.id} voting={voting} checked={chosen.has(r.id)} onSelect={select} onToggle={toggle} />
  const rankedSection = !ranked.length ? <p className="text-sm text-muted-foreground">{NO_INTERVIEW_SCORES}</p>
    : settingBands ? rankedBandOrder.map(band => {
      const members = byBand[band]
      const visible = take(members)
      const b = settingBands
      const range = band === "red" ? `ranks ${b.red.start}+` : `ranks ${b[band].start}–${b[band].end}`
      return visible.length ? <div key={band} className="oc-ranked-group" data-band={band}><h4 className="oc-ranked-group-heading text-xs font-medium"><span className="oc-ranked-band" data-band={band}>{rankedBandLabels[band]}</span> {range} · {members.length}</h4><ol className="oc-ranked-list">{visible.map(renderRow)}</ol></div> : null
    }) : <ol className="oc-ranked-list">{take(banded).map(renderRow)}</ol>
  const notScoredShown = take(notScored), hiddenShown = take(hidden)

  return <section ref={listRoot} className="oc-ranked-review space-y-4" aria-labelledby="ranked-review-heading">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">Round
          <NativeSelect aria-label="Ranked round" className={selectStyle} value={roundId} onChange={e => { setRoundId(e.target.value); setChosenCycle(null) }}>
            {rounds.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </NativeSelect>
        </label>
        {cycleOptions.length > 1 && <label className="grid gap-1 text-xs text-muted-foreground">Cycle
          <NativeSelect aria-label="Ranked cycle" className={selectStyle} value={cycleKey} onChange={e => setChosenCycle(e.target.value)}>
            {cycleOptions.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </NativeSelect>
        </label>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" disabled={!shown} onClick={() => void check()}>Check for updates</Button>
        {votingLink}
      </div>
    </div>
    <p className="oc-ranked-note text-xs leading-5 text-muted-foreground" role="note">Ranked by each applicant’s average of submitted interview scores in this round. Bands are discussion groups, not Pass, Hold or Do not pass decisions. Nothing here advances, rejects or notifies anyone.{round?.anonymousReview ? " Cycles are withheld in anonymous review, so the whole round is ranked." : ""}</p>
    {pending && <div role="status" className="oc-ranked-updates flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"><span>Updated results available.</span><Button size="sm" variant="outline" onClick={applyPending}>Refresh ranking</Button></div>}
    {checkFailed && <p role="status" className="text-xs text-muted-foreground">Couldn’t check for new results. Showing the last loaded ranking.</p>}
    {error ? <div role="alert" className="space-y-2 text-sm"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void load(roundId)}>Try again</Button></div>
      : !shown ? <p role="status" className="text-sm text-muted-foreground">Loading ranking…</p>
      : <>
        <BandSettings key={`${shown.roundId}:${cycleKey}:${setting.revision}`} clubId={clubId} roundId={shown.roundId} cycleKey={cycleKey} bands={setting.bands} revision={setting.revision} canManage={canManage} api={api}
          onSaved={(bands, revision) => setShown(s => s && s.roundId === shown.roundId ? { ...s, settings: { ...s.settings, scopes: { ...s.settings.scopes, [cycleKey]: { bands, revision } } }, signature: signatureOf(s.data, { ...s.settings, scopes: { ...s.settings.scopes, [cycleKey]: { bands, revision } } }, s.roundId) } : s)} />
        <VotingTargetSummary label="Round target and counts" target={currentSummary?.value ?? null} targetFallback={summaryKey && !currentSummary ? "Loading…" : "Not available"} bands={bandSummary} round={currentSummary?.value ?? null} roundStatus={summaryStatus} />
        {ties.map(t => <p key={`${t.band}:${t.rank}`} role="note" className="oc-ranked-tie text-xs" data-band={t.band}>{t.message}</p>)}
        {selectedMissing && <p role="status" className="text-xs text-muted-foreground">The selected applicant is no longer in this round.</p>}
        <h3 ref={listHeading} tabIndex={-1} id="ranked-review-heading" className="text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">Ranked applicants <span className="font-normal text-muted-foreground">· {ranked.length} scored</span></h3>
        {rankedSection}
        {notScoredShown.length > 0 && <div className="oc-ranked-group" data-group="not-scored"><h4 className="text-xs font-medium">Not scored · {notScored.length}</h4><p className="text-xs text-muted-foreground">No submitted interview score yet. Not ranked and not placed in a band.</p><ul className="oc-ranked-list">{notScoredShown.map(renderRow)}</ul></div>}
        {hiddenShown.length > 0 && <div className="oc-ranked-group" data-group="hidden"><h4 className="text-xs font-medium">Score not available · {hidden.length}</h4><p className="text-xs text-muted-foreground">You can’t see these scores yet, so they are not ranked.</p><ul className="oc-ranked-list">{hiddenShown.map(renderRow)}</ul></div>}
        {remaining > 0 && <div className="oc-ranked-more flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <p aria-live="polite" className="mr-auto">Showing {visibleCount} of {ordered.length} applicants</p>
          <Button type="button" size="sm" variant="outline" onClick={() => showMore(RANKED_PAGE_SIZE)}>Show {Math.min(RANKED_PAGE_SIZE, remaining)} more</Button>
          {remaining > RANKED_PAGE_SIZE && <Button type="button" size="sm" variant="ghost" onClick={() => showMore(remaining)}>Show all {ordered.length}</Button>}
        </div>}
      </>}
  </section>
}

/** One ranked row. Memoized: selecting an applicant or toggling a vote re-renders only the rows that changed. */
const RankedRow = memo(function RankedRow({ row: r, tied, selected, voting, checked, onSelect, onToggle }: { row: ShownRow; tied: boolean; selected: boolean; voting: boolean; checked: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  return <li className="oc-ranked-row" data-band={r.band ?? undefined} data-selected={selected || undefined}>
    {voting && <VotingSelection app={r} name={r.name} selection={{ ids: checked ? [r.id] : [], toggle: onToggle }} />}
    <button type="button" data-applicant-id={r.id} aria-current={selected ? "true" : undefined} className="oc-ranked-open" onClick={() => onSelect(r.id)}>
      <span className="oc-ranked-rank">{r.rank !== undefined ? <><span aria-hidden="true">{r.rank}</span><span className="sr-only">Rank {r.rank}{tied ? ", tied" : ""}</span>{tied && <span className="oc-ranked-tied" aria-hidden="true">Tied</span>}</> : <span aria-hidden="true">–</span>}</span>
      <ApplicantIdentity name={r.name} photo={r.photo} anonymous={r.anonymous} className="oc-ranked-identity"><span className="text-xs text-muted-foreground">{applicationStatusLabels[r.status as keyof typeof applicationStatusLabels] ?? r.status}</span></ApplicantIdentity>
      <span className="oc-ranked-score">{!r.visible ? <span className="oc-ranked-hidden"><Lock aria-hidden="true" size={14} />Hidden until you review</span> : <><strong>{formatAverage(r.average)}{r.average !== null && <span className="text-muted-foreground"> / 10</span>}</strong><span className="text-xs text-muted-foreground">{r.average === null ? `${r.submitted} of ${r.required} reviews submitted` : scoredEvaluationsLabel(r.submitted)}</span></>}</span>
      {r.band && <span className="oc-ranked-band" data-band={r.band}>{rankedBandLabels[r.band]}</span>}
      <span className="sr-only"> · Open applicant review and interviewer feedback</span>
    </button>
  </li>
})

function BandSettings({ clubId, roundId, cycleKey, bands, revision, canManage, api, onSaved }: { clubId: string; roundId: string; cycleKey: string; bands: RankedBands | null; revision: number; canManage: boolean; api: RankedReviewApi; onSaved: (bands: RankedBands | null, revision: number) => void }) {
  const [greenEnd, setGreenEnd] = useState(String(bands?.green.end ?? 20))
  const [yellowEnd, setYellowEnd] = useState(String(bands?.yellow.end ?? 40))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const summary = bands ? rankedBandOrder.map(b => `${rankedBandLabels[b]} ${b === "red" ? `${bands.red.start}+` : `${bands[b].start}–${bands[b].end}`}`).join(" · ") : null
  const proposed = validateBands(bandsFromBoundaries(Number(greenEnd), Number(yellowEnd)))
  async function save(next: RankedBands | null) {
    setSaving(true); setMessage("")
    try { const result = await api.saveBands({ clubId, roundId, cycleKey, expectedRevision: revision, bands: next }); onSaved(result.bands, result.revision) }
    catch { setMessage("Couldn’t save discussion bands. Someone may have changed them; refresh the ranking and try again.") }
    finally { setSaving(false) }
  }
  return <div className="oc-ranked-settings text-sm">
    <p className="text-xs text-muted-foreground">{summary ? <>Discussion bands: {summary}</> : canManage ? "No discussion bands yet — ranks only. Set bands to group ranks for discussion." : "No discussion bands set — ranks only."}</p>
    {canManage && <details className="mt-2" open={!bands || undefined}>
      <summary className="min-h-9 cursor-pointer py-2 text-xs font-medium">{bands ? "Edit discussion bands" : "Set discussion bands"}</summary>
      <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (proposed.ok) void save(proposed.bands) }}>
        <div><Label htmlFor={`green-end-${roundId}`}>Green ends at rank</Label><Input id={`green-end-${roundId}`} className="mt-1 w-28" type="number" min={1} step={1} value={greenEnd} onChange={e => setGreenEnd(e.target.value)} /></div>
        <div><Label htmlFor={`yellow-end-${roundId}`}>Yellow ends at rank</Label><Input id={`yellow-end-${roundId}`} className="mt-1 w-28" type="number" min={2} step={1} value={yellowEnd} onChange={e => setYellowEnd(e.target.value)} /></div>
        <p className="pb-2 text-xs text-muted-foreground">{proposed.ok ? `Red: rank ${proposed.bands.red.start} onward` : "Red: after Yellow"}</p>
        <Button type="submit" size="sm" disabled={saving || !proposed.ok}>Save bands</Button>
        {bands && <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save(null)}>Remove bands</Button>}
      </form>
      {!proposed.ok && <p role="alert" className="mt-2 text-xs">{proposed.errors.join(" ")}</p>}
      {message && <p role="alert" className="mt-2 text-xs">{message}</p>}
    </details>}
  </div>
}
