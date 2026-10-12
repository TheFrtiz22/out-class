"use client"

import { useEffect, useRef, useState } from "react"
import { LockKeyhole, Unlock, X } from "lucide-react"
import { getPanelProposalWorkspace, generatePanelProposal, previewPanelProposalEdits, savePanelProposalDraft, discardPanelProposal } from "@/actions/panel-proposals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { LoadingState } from "@/components/ui/loading-state"
import { assignmentKey, canProposeMember, panelIssueMessages, panelStatusLabels, type PanelAssignment, type PanelOptions, type PanelProposalView, type PanelWorkspace } from "@/lib/panel-proposals"
import { dayKey, slotTime, zonedInstant } from "@/lib/interview-rooms"
import { addDays } from "@/lib/availability"

export function PanelPreviewWorkspace({ clubId, roundId, autoStart = false }: { clubId: string; roundId: string; autoStart?: boolean }) {
  const [workspace, setWorkspace] = useState<PanelWorkspace | null>(null), [draft, setDraft] = useState<PanelProposalView | null>(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState(""), [dirty, setDirty] = useState(false)
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [selected, setSelected] = useState("")
  const [options, setOptions] = useState<PanelOptions>({ maxConsecutiveMinutes: null, breakMinutes: 15 })
  const initial = useRef<Promise<PanelWorkspace> | null>(null)
  const scope = { clubId, roundId }
  const accept = (value: PanelWorkspace) => {
    setWorkspace(value); setDraft(value.proposal); setDirty(false)
    const window = value.proposal?.document.window ?? value.suggestedWindow
    if (window) { setStart(dayKey(window.start, value.timezone)); setEnd(dayKey(new Date(+new Date(window.end) - 1), value.timezone)) }
    if (value.proposal) setOptions(value.proposal.document.options)
    setSelected(value.proposal?.document.sessions[0]?.id ?? value.scene.sessions[0]?.id ?? "")
  }
  useEffect(() => {
    let current = true
    initial.current ??= getPanelProposalWorkspace({ clubId, roundId }).then(async value => {
      if (autoStart && !value.proposal && value.suggestedWindow) return generatePanelProposal({ clubId, roundId, revision: 0, window: value.suggestedWindow, options: { maxConsecutiveMinutes: null, breakMinutes: 15 }, mode: "REGENERATE" })
      return value
    })
    initial.current.then(value => { if (current) accept(value) }).catch(() => { if (current) setError("Could not load the panel draft. Reload to check your permissions and current schedule.") }).finally(() => { if (current) setBusy(false) })
    return () => { current = false }
  // Each scope gets a keyed workspace; sharing the promise also prevents duplicate Strict Mode generation.
  }, [clubId, roundId, autoStart])
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", unload)
    return () => window.removeEventListener("beforeunload", unload)
  }, [dirty, busy])
  async function run(work: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError(""); setNotice("")
    try { await work() } catch { setError("Could not apply this change. Check availability, conflicts, and staffing limits. Reload if another administrator changed the draft.") } finally { setBusy(false) }
  }
  async function generate(mode: "REGENERATE" | "FILL_MISSING") {
    if (!workspace) return
    await run(async () => {
      const window = draft?.document.window ?? { start: new Date(zonedInstant(start, "00:00", workspace.timezone)).toISOString(), end: new Date(zonedInstant(addDays(end, 1), "00:00", workspace.timezone)).toISOString() }
      accept(await generatePanelProposal({ ...scope, window, options, revision: draft?.revision ?? 0, mode, ...(draft ? { assignments: draft.document.assignments } : {}) }))
      setNotice("Unpublished proposal saved. Review staffing and conflicts below.")
    })
  }
  async function edit(assignments: PanelAssignment[]) {
    if (!draft) return
    await run(async () => { const value = await previewPanelProposalEdits({ ...scope, proposalId: draft.id, revision: draft.revision, assignments }); setDraft(value); setDirty(true); setNotice("Change validated. Save Draft to keep it.") })
  }
  const sessions = draft?.document.sessions ?? workspace?.scene.sessions ?? []
  const rooms = [...new Map(sessions.map(s => [s.roomId, { id: s.roomId, name: s.roomName }])).values()]
  const times = [...new Set(sessions.map(s => s.startTime))].sort()
  const assignments = draft?.document.assignments ?? []
  const session = sessions.find(s => s.id === selected), scene = workspace?.scene
  const name = (id: string) => scene?.members.find(m => m.id === id)?.name ?? "Former member"
  const sessionLabel = (id: string) => { const s = sessions.find(s => s.id === id); return s ? `${s.roomName} · ${dayKey(s.startTime, s.timezone)} ${slotTime(s.startTime, s.timezone)} ${s.timezone}` : "Removed session" }
  const move = (from: PanelAssignment, slotId: string) => edit(assignments.map(a => assignmentKey(a) === assignmentKey(from) ? { ...a, slotId, source: "MANUAL" } : a))
  return <section className="min-w-0 space-y-5" aria-label="Review Panel Assignments" data-saving={busy} data-unsaved={dirty}>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="ir-eyebrow">Panel planning · {workspace?.roundName ?? "Interview"}</p><h3 className="oc-section-heading mt-2">Review Panel Assignments</h3><p className="mt-2 text-sm text-muted-foreground">Plan staffing across your existing rooms and sessions.</p></div><span className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Unpublished Draft</span></header>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error} <Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => accept(await getPanelProposalWorkspace(scope)))}>Reload draft</Button></p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    {!workspace && busy ? <LoadingState label="Preparing panel planning…" rows={3}/> : workspace && <>
      <div className="flex flex-wrap items-end gap-3"><label className="ir-field">From<Input aria-label="Panel window from" type="date" disabled={busy || !!draft} value={start} onChange={e => setStart(e.target.value)}/></label><label className="ir-field">Through<Input aria-label="Panel window through" type="date" disabled={busy || !!draft} value={end} onChange={e => setEnd(e.target.value)}/></label><p className="pb-2 text-xs text-muted-foreground">{workspace.timezone}</p><label className="ir-field">Maximum consecutive duty<NativeSelect aria-label="Maximum consecutive duty" disabled={busy} value={options.maxConsecutiveMinutes ?? "none"} onChange={e => setOptions({ ...options, maxConsecutiveMinutes: e.target.value === "none" ? null : Number(e.target.value) })}><option value="none">No configured limit</option>{[30,60,90,120,180,240,480].map(n => <option key={n} value={n}>{n} minutes</option>)}</NativeSelect></label><label className="ir-field">Break resets duty<NativeSelect aria-label="Break resets duty" disabled={busy} value={options.breakMinutes} onChange={e => setOptions({ ...options, breakMinutes: Number(e.target.value) })}>{[5,10,15,30,60].map(n => <option key={n} value={n}>{n} minutes</option>)}</NativeSelect></label></div>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !start || !end} onClick={() => generate("REGENERATE")}>{busy ? "Working…" : draft ? "Regenerate unlocked" : "Auto-Fill"}</Button>{draft && <><Button variant="outline" disabled={busy} onClick={() => generate("FILL_MISSING")}>Fill missing positions</Button><Button variant="outline" disabled={busy || !dirty} onClick={() => run(async () => { setDraft(await savePanelProposalDraft({ ...scope, proposalId: draft.id, revision: draft.revision, assignments })); setDirty(false); setNotice("Draft saved.") })}>Save Draft</Button><Button variant="ghost" disabled={busy} onClick={() => run(async () => { await discardPanelProposal({ ...scope, proposalId: draft.id, revision: draft.revision }); accept(await getPanelProposalWorkspace(scope)); setNotice("Draft discarded.") })}>Discard Draft</Button></>}<Button disabled variant="secondary" title="Approval and publication will be available in Phase 3.">Finalize Panels</Button></div>
      <p className="text-xs text-muted-foreground">Finalization requires the Phase 3 approval workflow. {draft ? `Revision ${draft.revision} · ${dirty ? "Unsaved edits" : "Draft saved"}.` : "Generate a draft to begin editing."} Changes to duty limits take effect when you regenerate or fill missing positions.</p>
      {draft && <>
        <div aria-live="polite" className="rounded-xl border bg-muted/30 p-4"><strong>{draft.validation.percentage}% staffed · {panelStatusLabels[draft.validation.status]}</strong><p className="mt-1 text-sm text-muted-foreground">{draft.validation.filled} of {draft.validation.required} required positions covered.</p>{draft.stale && <p className="mt-2 text-sm text-amber-800">The schedule, eligibility, or availability changed since generation. Review conflicts and regenerate unlocked positions.</p>}{draft.validation.warnings.map(w => <p key={w} className="mt-2 text-sm text-amber-800">{w}</p>)}</div>
        <div className="max-w-full overflow-x-auto rounded-xl border" tabIndex={0} aria-label="Panel schedule, scroll horizontally for all rooms"><table className="w-full border-collapse text-sm"><thead className="bg-muted"><tr><th className="min-w-36 p-3 text-left">Interview time</th>{rooms.map(r => <th key={r.id} className="min-w-60 p-3 text-left">{r.name}</th>)}</tr></thead><tbody>{times.map(time => <tr key={time} className="border-t"><th className="p-3 text-left align-top font-medium">{dayKey(time, workspace.timezone)}<span className="mt-1 block text-muted-foreground">{slotTime(time, workspace.timezone)}</span></th>{rooms.map(room => <td key={room.id} className="p-2 align-top">{sessions.filter(s => s.startTime === time && s.roomId === room.id).map(s => { const row = draft.validation.sessions.find(r => r.slotId === s.id)!; return <div key={s.id} className={`space-y-2 rounded-lg border p-3 ${selected === s.id ? "border-primary bg-primary/5" : ""}`} onDragOver={e => { if (!busy) e.preventDefault() }} onDrop={e => { e.preventDefault(); const key = e.dataTransfer.getData("text/plain"), from = assignments.find(a => assignmentKey(a) === key); if (from && !from.locked && !busy) void move(from, s.id) }}><button className="w-full text-left" disabled={busy} aria-label={`Edit ${sessionLabel(s.id)}`} onClick={() => setSelected(s.id)}><strong>{row.proposed}/{row.required} proposed</strong><span className="mt-1 block text-xs text-muted-foreground">{panelStatusLabels[row.status]} · {slotTime(s.endTime,workspace.timezone)} end{s.buffer ? ` + ${s.buffer}m buffer` : ""}</span><span className="mt-1 block text-xs text-muted-foreground">{s.existingMemberIds.length} officially assigned</span></button>{assignments.filter(a => a.slotId === s.id).map(a => <div key={assignmentKey(a)} draggable={!busy && !a.locked} onDragStart={e => e.dataTransfer.setData("text/plain", assignmentKey(a))} className="flex items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5"><span>{name(a.memberId)}</span><div className="flex shrink-0"><Button size="icon" variant="ghost" className="size-8" disabled={busy} aria-label={`${a.locked ? "Unlock" : "Lock"} ${name(a.memberId)} in ${sessionLabel(s.id)}`} onClick={() => edit(assignments.map(p => assignmentKey(p) === assignmentKey(a) ? { ...p, locked: !p.locked } : p))}>{a.locked ? <LockKeyhole size={14}/> : <Unlock size={14}/>}</Button><Button size="icon" variant="ghost" className="size-8" disabled={busy} aria-label={`Remove ${name(a.memberId)} from ${sessionLabel(s.id)}`} onClick={() => edit(assignments.filter(p => assignmentKey(p) !== assignmentKey(a)))}><X size={14}/></Button></div></div>)}{row.unfilled > 0 && <p className="text-xs text-amber-800">{row.unfilled} unfilled position{row.unfilled === 1 ? "" : "s"}</p>}{draft.validation.issues.filter(i => i.slotId === s.id).map(i => <p key={`${i.memberId}:${i.code}`} className="text-xs text-destructive">{i.memberId ? `${name(i.memberId)}: ` : ""}{i.message}</p>)}{row.reasons.map(reason => <p key={reason} className="text-xs text-muted-foreground">{reason}</p>)}</div> })}</td>)}</tr>)}</tbody></table></div>
        {session && scene && <aside className="space-y-4 rounded-xl border p-4" aria-label="Edit selected session"><h4 className="font-semibold">{sessionLabel(session.id)}</h4><p className="text-xs text-muted-foreground">Add, replace, or move interviewers here. Drag unlocked names between cells, or use the controls below. Availability checks cover the full interview and buffer.</p>
          <label className="ir-field">Add interviewer<NativeSelect aria-label="Add interviewer" disabled={busy || assignments.filter(a => a.slotId === session.id).length >= (scene.sessions.find(s => s.id === session.id)?.required ?? session.required)} value="" onChange={e => { if (e.target.value) void edit([...assignments, { slotId: session.id, memberId: e.target.value, locked: false, source: "MANUAL" }]) }}><option value="">Choose an available interviewer</option>{scene.members.map(m => { const reasons = canProposeMember(scene, assignments, session.id, m.id, draft.document.options); return <option key={m.id} value={m.id} disabled={!!reasons.length}>{m.name}{reasons.length ? ` · ${panelIssueMessages[reasons[0]]}` : " · Available"}</option> })}</NativeSelect></label>
          {assignments.filter(a => a.slotId === session.id).map(a => <div key={assignmentKey(a)} className="grid gap-3 rounded-lg bg-muted/30 p-3 sm:grid-cols-3"><strong className="text-sm">{name(a.memberId)}{a.locked ? " · Locked" : ""}</strong><label className="ir-field">Replace interviewer<NativeSelect aria-label={`Replace ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e => { if (e.target.value) void edit(assignments.map(p => assignmentKey(p) === assignmentKey(a) ? { ...p, memberId: e.target.value, source: "MANUAL" } : p)) }}><option value="">Choose replacement</option>{scene.members.filter(m => m.id !== a.memberId).map(m => <option key={m.id} value={m.id} disabled={!!canProposeMember(scene, assignments.filter(p => assignmentKey(p) !== assignmentKey(a)), session.id,m.id,draft.document.options).length}>{m.name}</option>)}</NativeSelect></label><label className="ir-field">Move to session<NativeSelect aria-label={`Move ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e => { if (e.target.value) void move(a,e.target.value) }}><option value="">Choose destination</option>{sessions.filter(s => s.id !== a.slotId).map(s => <option key={s.id} value={s.id}>{sessionLabel(s.id)}</option>)}</NativeSelect></label><label className="ir-field sm:col-span-3">Swap with proposed interviewer<NativeSelect aria-label={`Swap ${name(a.memberId)}`} disabled={busy || a.locked} value="" onChange={e => { const other = assignments.find(p => assignmentKey(p) === e.target.value); if (other) void edit(assignments.map(p => assignmentKey(p) === assignmentKey(a) ? { ...p,memberId:other.memberId,source:"MANUAL" } : assignmentKey(p) === assignmentKey(other) ? { ...p,memberId:a.memberId,source:"MANUAL" } : p)) }}><option value="">Choose an unlocked position</option>{assignments.filter(p => !p.locked && p.slotId !== a.slotId && p.memberId !== a.memberId).map(p => <option key={assignmentKey(p)} value={assignmentKey(p)}>{name(p.memberId)} · {sessionLabel(p.slotId)}</option>)}</NativeSelect></label></div>)}
          <details><summary className="cursor-pointer text-sm font-medium">Candidate availability and conflicts</summary><ul className="mt-3 space-y-2 text-xs">{scene.members.map(m => { const reasons = canProposeMember(scene, assignments.filter(a => !(a.slotId === session.id && a.memberId === m.id)),session.id,m.id,draft.document.options); return <li key={m.id}><strong>{m.name}</strong> · {m.role} · {reasons.length ? reasons.map(r => panelIssueMessages[r] ?? r).join(" ") : "Available for the entire interval and buffer"}</li> })}</ul></details>
        </aside>}
        {!!draft.validation.workloads.length && <details><summary className="cursor-pointer text-sm font-medium">Proposed interviewer workloads</summary><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{draft.validation.workloads.map(w => <li key={w.memberId}>{name(w.memberId)} · {w.sessions} sessions · {w.minutes} minutes including buffers</li>)}</ul></details>}
      </>}
    </>}
  </section>
}
