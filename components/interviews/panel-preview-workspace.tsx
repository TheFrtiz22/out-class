"use client"
import { SCHEDULING_TIMEZONE, SCHEDULING_TIMEZONE_LABEL } from "@/lib/scheduling-config"

import { useEffect, useRef, useState } from "react"
import { beginPanelScheduleRevision, revalidatePanelDraft, reviewPanelPublication, publishPanelSchedule, assignPanelAvailabilityOverride, revokePanelAvailabilityOverride, generatePanelProposal, savePanelProposalDraft, discardPanelProposal, getPanelProposalWorkspace } from "@/lib/workspace-api";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { PanelPublicationHistory,PanelChangeList } from "./panel-publication-history"
import { LockKeyhole, Unlock, X, ChevronDown } from "@/components/icons"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { LoadingState } from "@/components/ui/loading-state"
import { availabilityOverrideConditions, assignmentKey, canProposeMember, panelDraftScene,panelScheduleChanges,mergePanelPublication, panelIssueMessages, type PanelAssignment, type PanelOptions, type PanelProposalView, type PanelWorkspace,type PanelApprovalReview } from "@/lib/panel-proposals"
import { dayKey, slotTime, zonedInstant } from "@/lib/interview-rooms"
import { panelIssueSummary } from "@/lib/panel-issue-summary"
import { panelPublicationStatus } from "@/lib/panel-publication-status"
import type { BookingSettings } from "@/lib/interview-rooms"
import { canLeaveWorkspace } from "@/lib/product-navigation"
import { addDays } from "@/lib/availability"

export function PanelPreviewWorkspace({ clubId, roundId, autoStart = false, autoRequest = autoStart ? 1 : 0, autoFillPublished = false, initialWindow, initialSession, initialDate, bookingSettings, onSummary, onGenerated, onRooms, onApproved }: { clubId: string; roundId: string; autoStart?: boolean; autoRequest?: number; autoFillPublished?: boolean; initialWindow?: { start: string; end: string }; initialSession?: string; initialDate?: string; bookingSettings?: Pick<BookingSettings, "bookingPublishedAt" | "bookingPaused">; onSummary?: (summary: { required: number; filled: number; state: string; hasDraft: boolean }) => void; onGenerated?: () => void; onRooms?: () => void; onApproved?: () => void }) {
  const [workspace, setWorkspace] = useState<PanelWorkspace | null>(null), [draft, setDraft] = useState<PanelProposalView | null>(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [dirty, setDirty] = useState(false)
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [selected, setSelected] = useState("")
  const [review,setReview]=useState<PanelApprovalReview|null>(null),[override,setOverride]=useState(false),[reason,setReason]=useState("")
  const [options, setOptions] = useState<PanelOptions>({ maxConsecutiveMinutes: null, breakMinutes: 15 })
  const [availabilityOverride, setAvailabilityOverride] = useState<{ slotId: string; memberId: string; requestId: string; replaceMemberId?: string; conditions: string[] } | null>(null), [availabilityReason, setAvailabilityReason] = useState("")
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set())
  const [settingsOpen, setSettingsOpen] = useState(false), [focusSlot, setFocusSlot] = useState("")
  const [comparisonOpen, setComparisonOpen] = useState(false), [historyOpen, setHistoryOpen] = useState(false), [showPublished, setShowPublished] = useState(false)
  const comparisonOrigin = useRef<HTMLButtonElement>(null), historyOrigin = useRef<HTMLButtonElement>(null)
  const [recheckRequired, setRecheckRequired] = useState(false), [rechecking, setRechecking] = useState(false), [recheckError, setRecheckError] = useState(""), [recheckResult, setRecheckResult] = useState("")
  const checking = useRef(false), availabilityGeneration = useRef(0)
  const approvalSummary = useRef<HTMLDListElement>(null)
  const initial = useRef<Promise<PanelWorkspace> | null>(null)
  const rowButtons = useRef(new Map<string, HTMLButtonElement>())
  const scope = { clubId, roundId }
  const accept = (value: PanelWorkspace) => {
    if (value.proposal?.stale) setRecheckRequired(true)
    if (!value.proposal) { setRecheckRequired(false); setRecheckError(""); setRecheckResult("") }
    setWorkspace(previous=>({...previous,...value,clubName:value.clubName??previous?.clubName,canPublish:value.canPublish??previous?.canPublish,canOverrideAvailability:value.canOverrideAvailability??previous?.canOverrideAvailability,published:value.published===undefined?previous?.published:value.published,history:value.history??previous?.history})); setDraft(value.proposal); setDirty(false)
    const window = value.proposal?.document.window ?? initialWindow ?? value.suggestedWindow
    if (window) { setStart(dayKey(window.start, SCHEDULING_TIMEZONE)); setEnd(dayKey(new Date(+new Date(window.end) - 1), SCHEDULING_TIMEZONE)) }
    if (value.proposal) setOptions(value.proposal.document.options)
    setSelected(previous => (value.proposal?.document.sessions ?? value.scene.sessions).some(s => s.id === previous) ? previous : "")
  }
  const initialWindowRef = useRef(initialWindow)
  const acceptLatest = useRef(accept)
  acceptLatest.current = accept
  useEffect(() => {
    let current = true
    initial.current ??= getPanelProposalWorkspace({ clubId, roundId, ...(initialWindowRef.current ? { window: initialWindowRef.current } : {}) })
    initial.current.then(value => { if (current) acceptLatest.current(value) }).catch(error => { if (current) setError(error instanceof Error?error.message:"Could not load the panel draft.") }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  // Each scope gets a keyed workspace; sharing the promise also prevents duplicate Strict Mode generation.
  }, [clubId, roundId])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", unload)
    return () => window.removeEventListener("beforeunload", unload)
  }, [dirty, busy])
  const handledAuto = useRef(0), latestAuto = useRef({ begin, generate, onGenerated })
  latestAuto.current = { begin, generate, onGenerated }
  useEffect(() => {
    if (!workspace || busy || !autoStart || handledAuto.current >= autoRequest) return
    handledAuto.current = autoRequest
    if (draft) { latestAuto.current.onGenerated?.(); return }
    if (workspace.published) void latestAuto.current.begin(undefined, autoFillPublished).then(() => latestAuto.current.onGenerated?.())
    else if (workspace.suggestedWindow) void latestAuto.current.generate("REGENERATE", undefined, initialWindow)
  }, [workspace, busy, autoStart, autoRequest, autoFillPublished, draft, initialWindow])
  useEffect(() => { if (initialSession) setSelected(initialSession) }, [initialSession])
  useEffect(() => {
    if (draft) onSummary?.({ hasDraft: true, required: draft.validation.required, filled: draft.validation.filled, state: panelPublicationStatus(bookingSettings, workspace?.published?.document, draft.document).label })
    else if (workspace) onSummary?.({ hasDraft: false, required: workspace.scene.sessions.reduce((n, s) => n + s.required, 0), filled: workspace.scene.sessions.reduce((n, s) => n + s.existingMemberIds.length, 0), state: panelPublicationStatus(bookingSettings, workspace.published?.document).label })
  }, [draft, workspace, bookingSettings, onSummary])
  useEffect(() => {
    const changed = () => {
      availabilityGeneration.current += 1
      setRecheckRequired(true); setRecheckResult("")
      setDraft(previous => previous ? { ...previous, stale: true } : previous)
      void getPanelProposalWorkspace({ clubId, roundId }).then(value => {
        setWorkspace(value)
        if (value.suggestedWindow) { const window = value.suggestedWindow; setStart(previous => previous || dayKey(window.start, SCHEDULING_TIMEZONE)); setEnd(previous => previous || dayKey(new Date(+new Date(window.end) - 1), SCHEDULING_TIMEZONE)) }
      }).catch(() => setRecheckError("Could not refresh availability. Your assignments are retained; retry the availability check."))
    }
    const events = ["outclass:staffing-changed", "outclass:availability-changed"]
    events.forEach(event => window.addEventListener(event, changed))
    return () => events.forEach(event => window.removeEventListener(event, changed))
  }, [clubId, roundId])
  async function run(work: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try { await work() } catch(error) { setError(error instanceof Error&&!("digest"in error)?error.message:"Could not apply this change. Check conflicts or reload if another administrator changed the draft.") } finally { setBusy(false) }
  }
  async function generate(mode: "REGENERATE" | "FILL_MISSING",selectedSlotIds?:string[], requestedWindow?: { start: string; end: string }) {
    if (!workspace) return
    await run(async () => {
      const window = draft?.document.window ?? requestedWindow ?? { start: new Date(zonedInstant(start, "00:00", SCHEDULING_TIMEZONE)).toISOString(), end: new Date(zonedInstant(addDays(end, 1), "00:00", SCHEDULING_TIMEZONE)).toISOString() }
      accept(await generatePanelProposal({ ...scope, window, options, revision: draft?.revision ?? 0, mode,selectedSlotIds, ...(draft ? { assignments: draft.document.assignments } : {}) }))
      onGenerated?.(); globalThis.window.dispatchEvent(new Event("outclass:panels-changed"))
      setNotice("")
    })
  }
  const requirements=()=>draft?.document.sessions.map(s=>({slotId:s.id,required:s.required}))??[]
  async function edit(assignments: PanelAssignment[], targets=requirements()) {
    if (!draft) return
    await run(async () => { const value = await savePanelProposalDraft({ ...scope, proposalId: draft.id, revision: draft.revision, assignments,requirements:targets }); setDraft(value); setDirty(false); setNotice("Draft saved.") })
  }
  const sessions = draft?.document.sessions ?? workspace?.scene.sessions ?? []
  const targetDay = initialDate || (sessions.find(s => s.id === initialSession) ? dayKey(sessions.find(s => s.id === initialSession)!.startTime, SCHEDULING_TIMEZONE) : "")
  const selectedDay = sessions.find(s => s.id === selected) ? dayKey(sessions.find(s => s.id === selected)!.startTime, SCHEDULING_TIMEZONE) : ""
  useEffect(() => { if (targetDay) setExpandedDays(previous => new Set([...previous, targetDay])) }, [targetDay])
  useEffect(() => { if (selectedDay) setExpandedDays(previous => new Set([...previous, selectedDay])) }, [selectedDay])
  useEffect(() => {
    if (!focusSlot || busy || review) return
    const button = rowButtons.current.get(focusSlot)
    if (button && !button.closest('[hidden]')) { button.focus({ preventScroll: true }); button.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" }); setFocusSlot("") }
  }, [focusSlot, busy, review, expandedDays])
  function revealIssues(value: PanelProposalView | null | undefined, kind: "all" | "staffing" | "conflicts" = "all") {
    if (!value) return
    const summary = panelIssueSummary(value.validation)
    const ids = new Set(kind === "staffing" ? summary.missingSlots : kind === "conflicts" ? summary.conflictSlots : [...summary.missingSlots, ...summary.conflictSlots])
    const affected = value.document.sessions.filter(s => ids.has(s.id)).sort((a,b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
    const days = affected.map(s => dayKey(s.startTime, SCHEDULING_TIMEZONE))
    if (days.length) { setShowPublished(false); setExpandedDays(previous => new Set([...previous, ...days])); setFocusSlot(affected[0].id) }
  }
  async function revalidate() {
    if (!draft || busy || checking.current) return
    checking.current = true
    try { await run(async () => {
      const generation = availabilityGeneration.current
      setRechecking(true); setRecheckError(""); setRecheckResult("")
      try {
        const saved = dirty ? await savePanelProposalDraft({ ...scope, proposalId: draft.id, revision: draft.revision, assignments, requirements: requirements() }) : draft
        setDraft(saved); setDirty(false)
        const result = await revalidatePanelDraft({ ...scope, proposalId: saved.id, revision: saved.revision })
        const current = await getPanelProposalWorkspace(scope)
        if (!current.proposal || current.proposal.id !== saved.id || !result.ok && current.proposal.revision !== saved.revision) throw new Error("The draft changed. Reload before confirming.")
        accept(current); revealIssues(current.proposal)
        if (!result.ok) throw new Error(result.error)
        if (current.proposal.validation.issues.length) throw new Error("Assignments still have conflicts. Review the affected slots and recheck availability.")
        if (generation !== availabilityGeneration.current || current.proposal.stale) throw new Error("Availability changed again while checking. Recheck availability before confirming.")
        setRecheckRequired(false); setRecheckResult("Availability rechecked.")
      } catch (error) {
        setRecheckRequired(true); setDraft(previous => previous ? { ...previous, stale: true } : previous)
        setRecheckError(error instanceof Error && !("digest" in error) ? error.message : "Could not check availability. Retry the check.")
      } finally { setRechecking(false) }
    }) } finally { checking.current = false }
  }
  const assignments = draft?.document.assignments ?? []
  const session = sessions.find(s => s.id === selected), scene = workspace?.scene ? draft?panelDraftScene(draft.document,workspace.scene):workspace.scene:undefined
  const name = (id: string) => scene?.members.find(m => m.id === id)?.name ?? "Former member"
  const sessionLabel = (id: string) => { const s = sessions.find(s => s.id === id); return s ? `${s.roomName} · ${dayKey(s.startTime, SCHEDULING_TIMEZONE)} ${slotTime(s.startTime, SCHEDULING_TIMEZONE)} ${SCHEDULING_TIMEZONE_LABEL}` : "Removed session" }
  function chooseInterviewer(memberId: string, replaceMemberId?: string) {
    if (!scene || !session || !draft || !memberId) return
    const without = replaceMemberId ? assignments.filter(a => !(a.slotId === session.id && a.memberId === replaceMemberId)) : assignments
    const reasons = canProposeMember(scene, without, session.id, memberId, draft.document.options)
    if (reasons.length && workspace?.canOverrideAvailability && reasons.every(r => availabilityOverrideConditions.includes(r as typeof availabilityOverrideConditions[number]))) {
      setAvailabilityOverride({ slotId: session.id, memberId, requestId: crypto.randomUUID(), replaceMemberId, conditions: reasons }); setAvailabilityReason(""); return
    }
    void edit([...without, { slotId: session.id, memberId, locked: false, source: "MANUAL" }])
  }
  const candidates = (replaceMemberId?: string) => !scene || !session || !draft ? [] : scene.members.map(m => {
    const reasons = canProposeMember(scene, assignments.filter(a => !(a.slotId === session.id && a.memberId === replaceMemberId)), session.id, m.id, draft.document.options)
    return { m, reasons, allowed: !reasons.length || !!workspace?.canOverrideAvailability && reasons.every(r => availabilityOverrideConditions.includes(r as typeof availabilityOverrideConditions[number])) }
  }).sort((a,b) => Number(!!a.reasons.length) - Number(!!b.reasons.length) || a.m.name.localeCompare(b.m.name))
  const move = (from: PanelAssignment, slotId: string) => edit(assignments.map(a => assignmentKey(a) === assignmentKey(from) ? { ...a, slotId, source: "MANUAL" } : a))
  async function begin(restoreVersion?: number, fill = false) {
    if (!workspace?.published) return
    await run(async () => {
      const result = await beginPanelScheduleRevision({ ...scope, publishedVersion: workspace.published!.version, restoreVersion })
      if (!result.ok) throw new Error(result.error)
      const current = await getPanelProposalWorkspace(scope)
      if (fill && current.proposal) {
        const proposal = current.proposal
        accept(await generatePanelProposal({ ...scope, revision: proposal.revision, window: proposal.document.window, options: proposal.document.options, mode: "REGENERATE", assignments: proposal.document.assignments }))
        setNotice("Unpublished proposal saved. The published schedule stays active until approval.")
      } else { accept(current); setNotice("Working revision created. The published schedule stays active.") }
    })
  }
  async function finalize(){if(!draft)return;await run(async()=>{let current=draft;if(dirty)current=await savePanelProposalDraft({...scope,proposalId:draft.id,revision:draft.revision,assignments,requirements:requirements()});setDraft(current);setDirty(false);const result=await reviewPanelPublication({...scope,proposalId:current.id,revision:current.revision});const refreshed=await getPanelProposalWorkspace(scope);accept(refreshed);revealIssues(refreshed.proposal);if(!result.ok)throw new Error(result.error);setOverride(false);setReason("");setReview(result.value)})}
  const changes=draft?panelScheduleChanges(workspace?.published?.document??null,mergePanelPublication(workspace?.published?.document??null,draft.document)):[]
  const issues = draft ? panelIssueSummary(draft.validation) : null
  const needsRecheck = !!draft && (draft.stale || recheckRequired)
  const publication = panelPublicationStatus(bookingSettings, workspace?.published?.document, draft?.document)
  const official = showPublished && !!draft && !!workspace?.published
  const scheduleSessions = official ? workspace!.published!.document.sessions : sessions
  const scheduleAssignments = official ? workspace!.published!.document.assignments : assignments
  return <section className="min-w-0 space-y-5" aria-label="Review Panel Assignments" data-saving={busy} data-unsaved={dirty}>
<header className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-medium">Confirm interviewers</h3><span role="status" className="text-xs text-muted-foreground">{rechecking ? "Checking…" : busy ? "Saving…" : draft ? "Draft saved" : workspace?.published ? "Interviewers confirmed" : "Not assigned"}</span></header>
    {!draft && error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error} <Button variant="outline" size="sm" disabled={busy} onClick={() => { if (canLeaveWorkspace()) void run(async () => accept(await getPanelProposalWorkspace(scope))) }}>Reload draft</Button></p>}
    {draft && initialWindow && (draft.document.window.start !== initialWindow.start || draft.document.window.end !== initialWindow.end) && <p className="text-xs text-muted-foreground">This saved draft covers {dayKey(draft.document.window.start, SCHEDULING_TIMEZONE)} through {dayKey(new Date(+new Date(draft.document.window.end) - 1), SCHEDULING_TIMEZONE)}. The date filter applies to Rooms; it does not replace this draft.</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {!workspace && busy ? <LoadingState label="Preparing panel planning…" rows={3}/> : workspace && <>
      {!workspace.scene.sessions.some(s => s.active) && !draft && <div className="space-y-2 rounded-xl border border-dashed p-4"><h4 className="font-semibold">No upcoming interview sessions</h4><p className="text-sm text-muted-foreground">Create or reopen a room with future interview times before filling panels.</p>{onRooms && <Button variant="outline" onClick={onRooms}>Go to Rooms</Button>}</div>}
      <div className="flex flex-wrap gap-2">{workspace.published && !draft ? <><Button variant="outline" disabled={busy} onClick={() => begin()}>Edit interviewers</Button>{onApproved && <Button onClick={onApproved}>Continue to booking</Button>}</> : <><Button variant={draft ? "outline" : "default"} disabled={busy || !start || !end} onClick={() => generate(draft ? "FILL_MISSING" : "REGENERATE")}>{busy ? "Working…" : "Assign available interviewers"}</Button>{draft && <Button disabled={busy || !workspace.canPublish} onClick={finalize}>Confirm interviewers</Button>}</>}<div className="ml-auto"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" disabled={busy}>Schedule tools</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" onSelect={() => setSettingsOpen(true)}>Assignment rules</DropdownMenuItem>
        {draft && <><DropdownMenuItem className="min-h-11" disabled={busy} onSelect={() => generate("REGENERATE")}>Regenerate unlocked assignments</DropdownMenuItem><DropdownMenuItem className="min-h-11" disabled={busy} onSelect={() => { if (window.confirm("Discard unapproved changes? Confirmed reservations and the published schedule are retained.")) void run(async () => { await discardPanelProposal({...scope,proposalId:draft.id,revision:draft.revision}); accept(await getPanelProposalWorkspace(scope)); setNotice("Draft discarded.") }) }}>Discard draft</DropdownMenuItem></>}
      </DropdownMenuContent></DropdownMenu></div></div>
      {draft && issues && <section aria-label="Staffing issues" className="space-y-2 text-sm">
        {error && <p role="alert" className="text-destructive">{error} <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (canLeaveWorkspace()) void run(async () => accept(await getPanelProposalWorkspace(scope))) }}>Reload draft</Button></p>}
        {needsRecheck && <p role="status" className="text-amber-800">Availability has changed. Recheck assignments before confirming.</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><Button size="sm" variant={needsRecheck ? "outline" : "link"} className={needsRecheck ? "" : "h-9 px-0 text-muted-foreground"} disabled={busy} onClick={() => void revalidate()}>{rechecking ? "Checking availability…" : "Recheck availability"}</Button>{recheckResult && <p role="status" className="text-xs text-muted-foreground">{recheckResult}</p>}</div>
        {recheckError && <p role="alert" className="text-destructive">{recheckError} Your assignments are retained. Recheck availability to retry.</p>}
        {issues.staffingText && <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><p role="status" className={issues.missingSlots.length ? "text-amber-800" : "text-muted-foreground"}>{issues.staffingText}</p>{!!issues.missingSlots.length && <Button size="sm" variant="link" className="h-9 px-0" disabled={busy} onClick={() => revealIssues(draft, "staffing")}>Review slots</Button>}</div>}
        {!!issues.conflictSlots.length && <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><p role="status" className="text-amber-800">{issues.conflictText}</p><Button size="sm" variant="link" className="h-9 px-0" disabled={busy} onClick={() => revealIssues(draft, "conflicts")}>Review conflicts</Button></div>}
      </section>}
      <section aria-label="Publication status" className="space-y-1 text-sm"><p role="status" className="font-medium">{publication.label}</p>{publication.detail && <p className="text-xs text-muted-foreground">{publication.detail}</p>}<div className="flex flex-wrap items-center gap-4">{draft && <Button type="button" variant="link" size="sm" className="h-9 px-0" onClick={event => { comparisonOrigin.current = event.currentTarget; setComparisonOpen(true) }}>Review changes</Button>}{workspace.published && <Button type="button" variant="link" size="sm" className="h-9 px-0 text-muted-foreground" onClick={event => { historyOrigin.current = event.currentTarget; setHistoryOpen(true) }}>Publication history</Button>}</div></section>
      {(!workspace.published || draft) && <p className="text-xs text-muted-foreground">Both actions include slots in collapsed dates.</p>}
      {!workspace.canPublish && <p className="text-xs text-muted-foreground">A club owner must approve interviewer access.</p>}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Assignment rules</DialogTitle><DialogDescription>Schedule-wide assignment settings.</DialogDescription></DialogHeader><div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><label className="ir-field">From<Input aria-label="Panel window from" type="date" disabled={busy || !!draft} value={start} onChange={e => setStart(e.target.value)}/></label><label className="ir-field">Through<Input aria-label="Panel window through" type="date" disabled={busy || !!draft} value={end} onChange={e => setEnd(e.target.value)}/></label><p className="pb-2 text-xs text-muted-foreground">{SCHEDULING_TIMEZONE_LABEL}</p><label className="ir-field">Maximum consecutive duty<NativeSelect aria-label="Maximum consecutive duty" disabled={busy} value={options.maxConsecutiveMinutes ?? "none"} onChange={e => setOptions({ ...options, maxConsecutiveMinutes: e.target.value === "none" ? null : Number(e.target.value) })}><option value="none">No configured limit</option>{[30,60,90,120,180,240,480].map(n => <option key={n} value={n}>{n} minutes</option>)}</NativeSelect></label><label className="ir-field">Break resets duty<NativeSelect aria-label="Break resets duty" disabled={busy} value={options.breakMinutes} onChange={e => setOptions({ ...options, breakMinutes: Number(e.target.value) })}>{[5,10,15,30,60].map(n => <option key={n} value={n}>{n} minutes</option>)}</NativeSelect></label></div>
<p className="text-xs text-muted-foreground">Duty rules apply when you assign or regenerate interviewers. Saved schedules retain their original date range.</p></div></DialogContent></Dialog>
        {draft && workspace.published && <div role="group" aria-label="Assignment view" className="flex flex-wrap gap-2"><Button size="sm" variant={!official ? "secondary" : "ghost"} aria-pressed={!official} onClick={() => setShowPublished(false)}>Draft assignments</Button><Button size="sm" variant={official ? "secondary" : "ghost"} aria-pressed={official} onClick={() => setShowPublished(true)}>Currently approved assignments</Button></div>}
        <div className="space-y-5" aria-label="Interviewer schedule">{[...new Set(scheduleSessions.map(s => dayKey(s.startTime, SCHEDULING_TIMEZONE)))].sort().map(day => {
          const daySessions = scheduleSessions.filter(s => dayKey(s.startTime, SCHEDULING_TIMEZONE) === day)
          const unfilled = daySessions.reduce((n,s) => n + (draft && !official ? (draft.validation.sessions.find(row => row.slotId === s.id)?.unfilled ?? Math.max(0, s.required - assignments.filter(a => a.slotId === s.id).length)) : Math.max(0, s.required - (official ? scheduleAssignments.filter(a => a.slotId === s.id).length : s.existingMemberIds.length))), 0)
          const conflicts = official ? 0 : draft?.validation.issues.filter(i => daySessions.some(s => s.id === i.slotId)).length ?? 0
          const open = expandedDays.has(day), headingId = 'panel-day-heading-' + roundId + '-' + day, panelId = 'panel-day-' + roundId + '-' + day
          return <section key={day} className="ir-panel-day"><h4><button type="button" id={headingId} aria-expanded={open} aria-controls={panelId} className="ir-panel-day-trigger" onClick={() => setExpandedDays(previous => { const next = new Set(previous); if (next.has(day)) next.delete(day); else next.add(day); return next })}><ChevronDown size={16} aria-hidden="true" className={open ? "ir-panel-day-chevron is-open" : "ir-panel-day-chevron"}/><span>{day} · {SCHEDULING_TIMEZONE_LABEL}</span><span className="ir-panel-day-summary">{daySessions.length} {daySessions.length === 1 ? "slot" : "slots"}{unfilled > 0 ? ' · ' + unfilled + ' unfilled positions' : ' · Fully staffed'}{conflicts > 0 ? ' · ' + conflicts + ' conflicts' : ''}</span></button></h4><div id={panelId} role="region" aria-labelledby={headingId} hidden={!open} className="ir-panel-day-content">{[...new Map(scheduleSessions.map(s => [s.roomId, { id: s.roomId, name: s.roomName }])).values()].filter(r => scheduleSessions.some(s => s.roomId === r.id && dayKey(s.startTime, SCHEDULING_TIMEZONE) === day)).map(room => <div key={room.id}><h5 className="border-b pb-2 text-sm text-muted-foreground">{room.name}</h5><ul className="divide-y">{scheduleSessions.filter(s => s.roomId === room.id && dayKey(s.startTime, SCHEDULING_TIMEZONE) === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map(s => {
          const row = official ? undefined : draft?.validation.sessions.find(r => r.slotId === s.id)
          return <li key={s.id} onDragOver={event => { if (!busy && !official) event.preventDefault() }} onDrop={event => { event.preventDefault(); const from = assignments.find(a => assignmentKey(a) === event.dataTransfer.getData("text/plain")); if (from && !from.locked && !busy && !official) void move(from,s.id) }}><button ref={element => { if (element) rowButtons.current.set(s.id,element); else rowButtons.current.delete(s.id) }} type="button" disabled={busy || official || !draft && !workspace.published} aria-label={`${official ? "Currently approved" : "Edit"} ${s.roomName} · ${dayKey(s.startTime,SCHEDULING_TIMEZONE)} ${slotTime(s.startTime,SCHEDULING_TIMEZONE)} ${SCHEDULING_TIMEZONE_LABEL}`} onClick={() => { if (draft) setSelected(s.id); else void begin().then(() => setSelected(s.id)) }} className="ir-schedule-row"><span className="font-medium">{slotTime(s.startTime,SCHEDULING_TIMEZONE)} – {slotTime(s.endTime,SCHEDULING_TIMEZONE)}</span><span>{official ? scheduleAssignments.filter(a => a.slotId === s.id).map(a => name(a.memberId)).join(", ") || "No interviewers assigned" : draft ? assignments.some(a => a.slotId === s.id) ? assignments.filter(a => a.slotId === s.id).map((a,index) => <span key={a.memberId} draggable={!busy && !a.locked} onDragStart={event => event.dataTransfer.setData("text/plain",assignmentKey(a))}>{index ? ", " : ""}{name(a.memberId)}</span>) : "No interviewers assigned" : s.existingMemberIds.map(id => name(id)).join(", ") || "No interviewers assigned"}</span><span className={row?.unfilled || !official && draft?.validation.issues.some(i => i.slotId === s.id) ? "text-amber-800" : "text-muted-foreground"}>{row?.unfilled ? `${row.unfilled} needed` : !official && draft?.validation.issues.some(i => i.slotId === s.id) ? "Review conflict" : draft && !official ? "Ready" : workspace.published ? "Confirmed" : "Not assigned"}</span></button></li>
        })}</ul></div>)}</div></section>})}</div>

      {draft && <>
        {session && scene && <Sheet open={!!selected} onOpenChange={open => { if (!open && !busy) setSelected("") }}><SheetContent className="ir-slot-editor w-full overflow-y-auto sm:max-w-xl motion-reduce:animate-none motion-reduce:transition-none" onEscapeKeyDown={event => { if (busy) event.preventDefault() }} onPointerDownOutside={event => { if (busy) event.preventDefault() }} onCloseAutoFocus={event => { event.preventDefault(); rowButtons.current.get(session.id)?.focus() }}><SheetHeader className="pr-14"><SheetTitle>Interviewers · {sessionLabel(session.id)}</SheetTitle><SheetDescription>Changes save automatically. Confirm the full schedule before applicants can book.</SheetDescription></SheetHeader><div className="space-y-4 px-4 pb-6" aria-label="Edit selected session">
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
          {draft.validation.issues.filter(i => i.slotId === session.id).map((i,index) => <p key={index} className="text-sm text-destructive">{i.memberId ? `${name(i.memberId)}: ` : ""}{i.message}</p>)}
          <div className="flex flex-wrap items-end gap-3"><label className="ir-field">Interviewers Needed for this session<NativeSelect aria-label="Draft session interviewers needed" disabled={busy} value={session.required} onChange={e=>edit(assignments,requirements().map(r=>r.slotId===session.id?{...r,required:Number(e.target.value)}:r))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</NativeSelect></label><Button size="sm" variant="outline" disabled={busy} onClick={()=>generate("REGENERATE",[session.id])}>Regenerate selected session</Button></div>
          <label className="ir-field">Add interviewer<NativeSelect aria-label="Add interviewer" disabled={busy || assignments.filter(a=>a.slotId===session.id).length>=session.required} value="" onChange={e=>chooseInterviewer(e.target.value)}><option value="">{workspace.canOverrideAvailability?"Choose an interviewer":"Choose an available interviewer"}</option>{candidates().map(({m,reasons,allowed})=><option key={m.id} value={m.id} disabled={!allowed}>{m.name} · {reasons.length?reasons.map(r=>panelIssueMessages[r]??r).join(" "):"Available"}</option>)}</NativeSelect></label>
          {assignments.filter(a => a.slotId === session.id).map(a => <div key={assignmentKey(a)} className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-3"><strong className="text-sm">{name(a.memberId)}{a.locked ? " · Locked" : ""}</strong><div className="flex gap-1"><Button size="icon" variant="ghost" className="size-9" disabled={busy} aria-label={`${a.locked ? "Unlock" : "Lock"} ${name(a.memberId)}`} onClick={() => edit(assignments.map(p => assignmentKey(p) === assignmentKey(a) ? { ...p, locked: !p.locked } : p))}>{a.locked ? <LockKeyhole size={14}/> : <Unlock size={14}/>}</Button><Button size="icon" variant="ghost" className="size-9" disabled={busy || a.locked} aria-label={`Remove ${name(a.memberId)}`} onClick={() => edit(assignments.filter(p => assignmentKey(p) !== assignmentKey(a)))}><X size={14}/></Button></div>{a.availabilityOverrideId&&workspace.canOverrideAvailability&&<Button variant="ghost" size="sm" disabled={busy} onClick={()=>run(async()=>{if(dirty){setDraft(await savePanelProposalDraft({...scope,proposalId:draft.id,revision:draft.revision,assignments,requirements:requirements()}));setDirty(false)}await revokePanelAvailabilityOverride({clubId,overrideId:a.availabilityOverrideId!});accept(await getPanelProposalWorkspace(scope));setNotice("Override removed. Invalid sessions stop accepting new bookings; confirmed reservations are retained.");window.dispatchEvent(new Event("outclass:panels-changed"))})}>Remove availability override</Button>}<label className="ir-field">Replace interviewer<NativeSelect aria-label={`Replace ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e=>chooseInterviewer(e.target.value,a.memberId)}><option value="">Choose replacement</option>{candidates(a.memberId).filter(c=>c.m.id!==a.memberId).map(({m,reasons,allowed})=><option key={m.id} value={m.id} disabled={!allowed}>{m.name} · {reasons.length?reasons.map(r=>panelIssueMessages[r]??r).join(" "):"Available"}</option>)}</NativeSelect></label><label className="ir-field">Move to session<NativeSelect aria-label={`Move ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e => { if (e.target.value) void move(a,e.target.value) }}><option value="">Choose destination</option>{sessions.filter(s => s.id !== a.slotId).map(s => <option key={s.id} value={s.id}>{sessionLabel(s.id)}</option>)}</NativeSelect></label><label className="ir-field sm:col-span-3">Swap with proposed interviewer<NativeSelect aria-label={`Swap ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e => { const other = assignments.find(p => assignmentKey(p) === e.target.value); if (other) void edit(assignments.map(p => assignmentKey(p) === assignmentKey(a) ? { ...p,memberId:other.memberId,source:"MANUAL" } : assignmentKey(p) === assignmentKey(other) ? { ...p,memberId:a.memberId,source:"MANUAL" } : p)) }}><option value="">Choose an unlocked position</option>{assignments.filter(p => !p.locked && p.slotId !== a.slotId && p.memberId !== a.memberId).map(p => <option key={assignmentKey(p)} value={assignmentKey(p)}>{name(p.memberId)} · {sessionLabel(p.slotId)}</option>)}</NativeSelect></label></div>)}
          <details><summary className="cursor-pointer text-sm font-medium">Candidate availability and conflicts</summary><ul className="mt-3 space-y-2 text-xs">{scene.members.map(m => { const reasons = canProposeMember(scene, assignments.filter(a => !(a.slotId === session.id && a.memberId === m.id)),session.id,m.id,draft.document.options); return <li key={m.id}><strong>{m.name}</strong> · {m.role} · {reasons.length ? reasons.map(r => panelIssueMessages[r] ?? r).join(" ") : "Available for the entire interval and buffer"}</li> })}</ul></details>
        <Button variant="outline" disabled={busy} onClick={() => setSelected("")}>Done</Button></div></SheetContent></Sheet>}
        {!!draft.validation.workloads.length && <details><summary className="cursor-pointer text-sm font-medium">Proposed interviewer workloads</summary><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{draft.validation.workloads.map(w => <li key={w.memberId}>{name(w.memberId)} · {w.sessions} sessions · {w.minutes} minutes including buffers</li>)}</ul></details>}
      </>}
    </>}
    <Dialog open={!!availabilityOverride} onOpenChange={open=>{if(!open&&!busy)setAvailabilityOverride(null)}}><DialogContent><DialogHeader><DialogTitle>Assign despite availability?</DialogTitle><DialogDescription>This applies only to the selected session. The interviewer&apos;s own availability and participation response stay unchanged.</DialogDescription></DialogHeader>{availabilityOverride&&<div className="space-y-4"><p>{name(availabilityOverride.memberId)} · {sessionLabel(availabilityOverride.slotId)}</p><ul className="text-sm">{availabilityOverride.conditions.map(code=><li key={code}>{panelIssueMessages[code]??code}</li>)}</ul><label className="ir-field">Reason (optional)<textarea aria-label="Availability override reason" className="min-h-24 rounded border p-3" maxLength={1000} value={availabilityReason} onChange={e=>setAvailabilityReason(e.target.value)} /></label>{error&&<p role="alert">{error} Your confirmation is retained for retry.</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setAvailabilityOverride(null)}>Cancel</Button><Button disabled={busy} onClick={()=>run(async()=>{if(!draft)return;const current=dirty?await savePanelProposalDraft({...scope,proposalId:draft.id,revision:draft.revision,assignments,requirements:requirements()}):draft;setDraft(current);setDirty(false);await assignPanelAvailabilityOverride({...scope,proposalId:current.id,revision:current.revision,slotId:availabilityOverride.slotId,memberId:availabilityOverride.memberId,replaceMemberId:availabilityOverride.replaceMemberId,requestId:availabilityOverride.requestId,reason:availabilityReason});accept(await getPanelProposalWorkspace(scope));setSelected(availabilityOverride.slotId);setAvailabilityOverride(null);setNotice("Availability overridden for this assignment. Review and publish the panel separately.")})}>{busy?"Assigning…":"Assign anyway"}</Button></div></div>}</DialogContent></Dialog>
    <Dialog open={!!review} onOpenChange={open=>{if(!open&&!busy)setReview(null)}}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onOpenAutoFocus={event => { if (review && (review.unfilled > 0 || review.conflicts > 0)) { event.preventDefault(); approvalSummary.current?.focus() } }}><DialogHeader><DialogTitle>{workspace?.published?"Review panel schedule changes":"Final panel approval"}</DialogTitle><DialogDescription>Confirm the exact plan below. Returning to editing keeps your draft.</DialogDescription></DialogHeader>{review&&<div className="space-y-4">{error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error} Your approval stays open; reconnect and retry to check the result safely.</p>}<p className="font-semibold">{review.clubName} · {review.roundName}</p><dl ref={approvalSummary} tabIndex={-1} aria-label="Panel staffing validation" className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm">{[["Rooms",review.rooms],["Interview sessions",review.sessions],["Required positions",review.required],["Staffed positions",review.filled],["Unfilled positions",review.unfilled],["Hard conflicts",review.conflicts]].map(([label,value])=><div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl><Button variant="link" className="h-9 px-0" onClick={event => { comparisonOrigin.current = event.currentTarget; setComparisonOpen(true) }}>Review changes</Button>{review.unfilled>0&&<div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm text-amber-900">{review.overrideWarning}</p><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={busy||!review.canOverride} checked={override} onChange={e=>setOverride(e.target.checked)}/>I explicitly approve this safe understaffed schedule.</label>{override&&<label className="ir-field">Reason for understaffing approval<textarea aria-label="Understaffing approval reason" className="min-h-24 rounded-lg border bg-background p-3 text-sm" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}</div>}<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Return to editing</Button><Button disabled={busy||review.conflicts>0||review.unfilled>0&&(!override||reason.trim().length<10)} onClick={()=>run(async()=>{const result=await publishPanelSchedule({...scope,proposalId:review.proposalId,revision:review.revision,approvalToken:review.approvalToken,understaffedOverride:override,overrideReason:override?reason:undefined});if(!result.ok){setReview(null);accept(await getPanelProposalWorkspace(scope));throw new Error(result.error)}setReview(null);accept(await getPanelProposalWorkspace(scope));window.dispatchEvent(new Event("outclass:panels-changed")); setNotice("Interviewers confirmed. Schedule updates will be sent."); onApproved?.()})}>{busy?"Publishing…":"Approve interviewers"}</Button></div></div>}</DialogContent></Dialog>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); historyOrigin.current?.focus() }} className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Publication history</DialogTitle><DialogDescription>Approved versions and their audit history. Restoring creates a draft and requires separate approval.</DialogDescription></DialogHeader><PanelPublicationHistory published={workspace?.published} history={workspace?.history ?? []} name={name} busy={busy} hasDraft={!!draft} onRestore={version => { setHistoryOpen(false); void begin(version) }}/></DialogContent></Dialog>
    <Dialog open={comparisonOpen} onOpenChange={setComparisonOpen}><DialogContent onCloseAutoFocus={event => { event.preventDefault(); comparisonOrigin.current?.focus() }} className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Schedule changes</DialogTitle><DialogDescription>Currently approved assignments compared with the proposed schedule. Reviewing does not approve or publish changes.</DialogDescription></DialogHeader><PanelChangeList changes={review?.changes ?? changes} name={name}/>{draft && workspace?.published && (draft.document.options.breakMinutes !== workspace.published.document.options.breakMinutes || draft.document.options.maxConsecutiveMinutes !== workspace.published.document.options.maxConsecutiveMinutes) && <p className="text-sm">Duty rules: currently {workspace.published.document.options.maxConsecutiveMinutes ?? "no limit"} consecutive minutes, {workspace.published.document.options.breakMinutes}-minute break; proposed {draft.document.options.maxConsecutiveMinutes ?? "no limit"} consecutive minutes, {draft.document.options.breakMinutes}-minute break.</p>}{draft && <p className="text-sm">{draft.validation.sessions.reduce((n, row) => n + row.unfilled, 0)} proposed unfilled positions · {draft.validation.issues.length} validation conflicts</p>}<Button variant="outline" onClick={() => setComparisonOpen(false)}>Back to schedule</Button></DialogContent></Dialog>
  </section>
}
