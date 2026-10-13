import { z } from "zod"
import { overlaps } from "@/lib/interview-rooms"

export const MAX_PANEL_SESSIONS = 500
export const MAX_PANEL_ASSIGNMENTS = MAX_PANEL_SESSIONS * 8
const id = z.string().uuid()
export const panelScopeSchema = z.object({ clubId: id, roundId: id }).strict()
export const panelWindowSchema = z.object({ start: z.string().datetime(), end: z.string().datetime() }).strict()
  .refine(v => +new Date(v.end) > +new Date(v.start) && +new Date(v.end) - +new Date(v.start) <= 366 * 86400000, "Choose a scheduling window of up to one year.")
export const panelOptionsSchema = z.object({
  maxConsecutiveMinutes: z.number().int().min(15).max(480).nullable().default(null),
  breakMinutes: z.number().int().min(5).max(60).default(15),
}).strict()
export const panelAssignmentSchema = z.object({
  slotId: id, memberId: id, locked: z.boolean(), source: z.enum(["AUTO", "MANUAL", "EXISTING"]),
}).strict()
export const panelAssignmentsSchema = z.array(panelAssignmentSchema).max(MAX_PANEL_ASSIGNMENTS)
  .refine(rows => new Set(rows.map(a => `${a.slotId}:${a.memberId}`)).size === rows.length, "An interviewer can appear only once in each session.")
export const panelSessionSchema = z.object({
  id, roomId: id, roomName: z.string().max(100), timezone: z.string().max(100),
  startTime: z.string().datetime(), endTime: z.string().datetime(), buffer: z.number().int().min(0).max(60),
  required: z.number().int().min(1).max(8), active: z.boolean(),
  roomRevision: z.number().int().nonnegative(), slotRevision: z.number().int().nonnegative(),
  existingMemberIds: z.array(id).max(1000), originalRequired: z.number().int().min(1).max(8).optional(),
}).strict()
export const panelDocumentSchema = z.object({
  version: z.literal(1), window: panelWindowSchema, options: panelOptionsSchema,
  sessions: z.array(panelSessionSchema).max(MAX_PANEL_SESSIONS), assignments: panelAssignmentsSchema,
}).strict().superRefine((document, ctx) => {
  const sessions = new Set(document.sessions.map(s => s.id))
  if (sessions.size !== document.sessions.length || document.assignments.some(a => !sessions.has(a.slotId))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose unique sessions from this proposal." })
})
export type PanelAssignment = z.infer<typeof panelAssignmentSchema>
export type PanelSession = z.infer<typeof panelSessionSchema>
export type PanelOptions = z.infer<typeof panelOptionsSchema>
export type PanelDocument = z.infer<typeof panelDocumentSchema>
export type PanelBusyInterval = { startTime: string; endTime: string; buffer: number }
export type PanelMember = {
  id: string; name: string; role: string; eligible: boolean; confirmed: boolean; evidenceAccess: boolean
  allowedSlotIds: string[]; blocks: Record<string, string[]>; maxConsecutiveMinutes?: number | null
  // Server-only inputs. Never return other clubs' commitment intervals to clients.
  commitments?: PanelBusyInterval[]; baselineWorkloadMinutes?: number
}
export type PanelScene = { sessions: PanelSession[]; members: PanelMember[] }
export type PanelIssue = { slotId: string; memberId?: string; code: string; message: string }
export type PanelStatus = "FULLY_STAFFED" | "PARTIALLY_STAFFED" | "UNFILLED" | "CONFLICT_DETECTED"
export const panelStatusLabels: Record<PanelStatus, string> = {
  FULLY_STAFFED: "Fully Staffed", PARTIALLY_STAFFED: "Partially Staffed", UNFILLED: "Unfilled", CONFLICT_DETECTED: "Conflict Detected",
}
export const panelIssueMessages: Record<string, string> = {
  MEMBER_REMOVED: "This interviewer is no longer a member of this club.",
  INELIGIBLE: "This member is not eligible for this round.",
  UNCONFIRMED: "Participation has not been confirmed for this round.",
  NO_INTERVIEW_ACCESS: "Identified interview access permissions are not enabled for this member.",
  UNKNOWN_AVAILABILITY: "Availability is unknown for part of this interview or its buffer.",
  UNAVAILABLE: "Confirmed availability does not cover the entire interview and following buffer.",
  OFFICIAL_COMMITMENT: "Another official commitment overlaps this interview or its required buffer.",
  SESSION_UNAVAILABLE: "This session was removed, closed, archived, or has already started.",
  SESSION_CHANGED: "The session time or buffer changed. Unlock and regenerate, or remove this proposal.",
  DOUBLE_BOOKED: "This interviewer is proposed in overlapping sessions, including required buffers.",
  CONSECUTIVE_LIMIT: "This duty block exceeds the consecutive-interview limit, including buffers and official commitments.",
  OVERSTAFFED: "Proposed positions exceed the session's staffing requirement. Remove or unlock extra positions.",
  DUPLICATE: "An interviewer is proposed more than once in this session.",
}
export type PanelValidation = {
  status: PanelStatus; filled: number; required: number; percentage: number; issues: PanelIssue[]
  sessions: { slotId: string; status: PanelStatus; proposed: number; filled: number; required: number; unfilled: number; reasons: string[] }[]
  workloads: { memberId: string; sessions: number; minutes: number }[]
  search?: { nodes: number; limited: boolean; coverageUpperBound: number }
  warnings: string[]
}
export type PanelProposalView = { id: string; revision: number; status: "UNPUBLISHED" | "READY_FOR_APPROVAL"; basePublishedVersion?: number; approvalToken?: string | null; document: PanelDocument; validation: PanelValidation; createdAt: string; updatedAt: string; createdBy: string; modifiedBy: string; stale: boolean }
export type PanelWorkspace = {
  roundId: string; roundName: string; timezone: string; scene: PanelScene; proposal: PanelProposalView | null
  suggestedWindow: { start: string; end: string } | null; fingerprint: string
  clubName?: string; canPublish?: boolean; published?: PanelPublishedView | null; history?: PanelPublishedView[]
}
export const assignmentKey = (a: Pick<PanelAssignment, "slotId" | "memberId">) => `${a.slotId}:${a.memberId}`
export const sameSessionTime = (a: PanelSession, b: PanelSession) => a.startTime === b.startTime && a.endTime === b.endTime && a.buffer === b.buffer && a.roomId === b.roomId
export const sessionMinutes = (s: PanelSession) => (+new Date(s.endTime) - +new Date(s.startTime)) / 60000 + s.buffer

export function memberBlockReasons(member: PanelMember | undefined, session: PanelSession): string[] {
  if (!member) return ["MEMBER_REMOVED"]
  const reasons: string[] = []
  if (!session.active) reasons.push("SESSION_UNAVAILABLE")
  if (!member.eligible) reasons.push("INELIGIBLE")
  if (!member.confirmed) reasons.push("UNCONFIRMED")
  if (!member.evidenceAccess) reasons.push("NO_INTERVIEW_ACCESS")
  reasons.push(...(member.blocks[session.id] ?? []))
  if (member.eligible && member.confirmed && member.evidenceAccess && !member.allowedSlotIds.includes(session.id) && !reasons.length) reasons.push("UNAVAILABLE")
  return [...new Set(reasons)]
}
export function sessionsOverlap(a: PanelBusyInterval, b: PanelBusyInterval) { return overlaps(a, b, Math.max(a.buffer, b.buffer)) }

/** Which sessions participate in an overlong duty block, including private commitments. */
function longDutySessions(member: PanelMember, sessions: PanelSession[], options: PanelOptions): Set<string> {
  const limit = member.maxConsecutiveMinutes ?? options.maxConsecutiveMinutes
  if (limit === null || limit === undefined) return new Set()
  const intervals = [
    ...(member.commitments ?? []).map(s => ({ start: +new Date(s.startTime), end: +new Date(s.endTime) + s.buffer * 60000, id: "" })),
    ...sessions.map(s => ({ start: +new Date(s.startTime), end: +new Date(s.endTime) + s.buffer * 60000, id: s.id })),
  ].sort((a, b) => a.start - b.start || a.end - b.end)
  const invalid = new Set<string>(); let start = 0, end = 0, ids: string[] = []
  const finish = () => { if (end - start > limit * 60000) ids.forEach(id => { if (id) invalid.add(id) }) }
  for (const interval of intervals) {
    if (!ids.length || interval.start - end >= options.breakMinutes * 60000) {
      finish(); start = interval.start; end = interval.end; ids = [interval.id]
    } else { end = Math.max(end, interval.end); ids.push(interval.id) }
  }
  finish(); return invalid
}

export function canProposeMember(scene: PanelScene, assignments: PanelAssignment[], slotId: string, memberId: string, options: PanelOptions): string[] {
  const session = scene.sessions.find(s => s.id === slotId), member = scene.members.find(m => m.id === memberId)
  if (!session) return ["SESSION_UNAVAILABLE"]
  const reasons = memberBlockReasons(member, session)
  const other = assignments.filter(a => a.memberId === memberId).flatMap(a => { const s = scene.sessions.find(s => s.id === a.slotId); return s ? [s] : [] })
  if (other.some(s => s.id === slotId)) reasons.push("DUPLICATE")
  if (other.some(s => s.id !== slotId && sessionsOverlap(s, session))) reasons.push("DOUBLE_BOOKED")
  if (member && longDutySessions(member, [...other, session], options).size) reasons.push("CONSECUTIVE_LIMIT")
  return [...new Set(reasons)]
}

export function validatePanelDocument(document: PanelDocument, scene: PanelScene): PanelValidation {
  const sessions = new Map(scene.sessions.map(s => [s.id, s])), baselines = new Map(document.sessions.map(s => [s.id, s]))
  const members = new Map(scene.members.map(m => [m.id, m])), issues: PanelIssue[] = [], seen = new Set<string>()
  const add = (slotId: string, memberId: string | undefined, code: string) => { if (!issues.some(i => i.slotId === slotId && i.memberId === memberId && i.code === code)) issues.push({ slotId, ...(memberId ? { memberId } : {}), code, message: panelIssueMessages[code] ?? code }) }
  for (const a of document.assignments) {
    const session = sessions.get(a.slotId), baseline = baselines.get(a.slotId), key = assignmentKey(a)
    if (seen.has(key)) add(a.slotId, a.memberId, "DUPLICATE"); seen.add(key)
    if (!session || !session.active || !baseline) add(a.slotId, a.memberId, "SESSION_UNAVAILABLE")
    if (session && baseline && !sameSessionTime(session, baseline)) add(a.slotId, a.memberId, "SESSION_CHANGED")
    if (session) memberBlockReasons(members.get(a.memberId), session).forEach(code => add(a.slotId, a.memberId, code))
  }
  for (const memberId of new Set(document.assignments.map(a => a.memberId))) {
    const own = document.assignments.filter(a => a.memberId === memberId)
    const duty = own.flatMap(a => { const s = sessions.get(a.slotId) ?? baselines.get(a.slotId); return s ? [s] : [] })
    for (let i = 0; i < duty.length; i++) for (let j = i + 1; j < duty.length; j++) if (duty[i].id !== duty[j].id && sessionsOverlap(duty[i], duty[j])) { add(duty[i].id, memberId, "DOUBLE_BOOKED"); add(duty[j].id, memberId, "DOUBLE_BOOKED") }
    const member = members.get(memberId)
    if (member) longDutySessions(member, duty, document.options).forEach(slotId => add(slotId, memberId, "CONSECUTIVE_LIMIT"))
  }
  const rows = document.sessions.map(baseline => {
    const session = sessions.get(baseline.id) ?? { ...baseline, active: false }, proposed = document.assignments.filter(a => a.slotId === baseline.id)
    if (proposed.length > session.required) add(session.id, undefined, "OVERSTAFFED")
    const filled = Math.min(session.required, proposed.filter(a => !issues.some(i => i.slotId === a.slotId && i.memberId === a.memberId)).length)
    const unfilled = session.required - filled, conflict = issues.some(i => i.slotId === session.id)
    const reasons: string[] = []
    if (unfilled) {
      const qualified = scene.members.filter(m => memberBlockReasons(m, session).length === 0)
      if (!session.active) reasons.push("Session unavailable.")
      if (!qualified.length) reasons.push("No eligible, confirmed interviewer covers the full interval and buffer without an official conflict.")
      else if (qualified.length < session.required) reasons.push(`${qualified.length} qualifying interviewer${qualified.length === 1 ? "" : "s"} for ${session.required} required positions.`)
      else reasons.push("Available interviewers are needed elsewhere in this window, exceed a duty limit, or occupy fixed positions.")
      if (proposed.some(a => a.locked && issues.some(i => i.slotId === a.slotId && i.memberId === a.memberId))) reasons.push("Fix or unlock conflicting locked positions.")
    }
    return { slotId: session.id, status: (conflict ? "CONFLICT_DETECTED" : filled === session.required ? "FULLY_STAFFED" : filled ? "PARTIALLY_STAFFED" : "UNFILLED") as PanelStatus, proposed: proposed.length, filled, required: session.required, unfilled, reasons }
  })
  const required = rows.reduce((n, s) => n + s.required, 0), filled = rows.reduce((n, s) => n + s.filled, 0)
  const status: PanelStatus = issues.length ? "CONFLICT_DETECTED" : required && filled === required ? "FULLY_STAFFED" : filled ? "PARTIALLY_STAFFED" : "UNFILLED"
  return { status, filled, required, percentage: required ? Math.round(filled / required * 100) : 0, issues, sessions: rows, workloads: [...members.values()].flatMap(m => {
    const own = document.assignments.filter(a => a.memberId === m.id), minutes = own.reduce((n, a) => { const s = sessions.get(a.slotId) ?? baselines.get(a.slotId); return n + (s ? sessionMinutes(s) : 0) }, 0)
    return own.length ? [{ memberId: m.id, sessions: own.length, minutes }] : []
  }), warnings: [] }
}

const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
/** Deterministic, bounded whole-window search. The only output is proposal data. */
export function generatePanelAssignments(scene: PanelScene, document: PanelDocument, mode: "REGENERATE" | "FILL_MISSING", nodeBudget = 30000) {
  const active = scene.sessions.filter(s => s.active).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime) || compareText(a.roomId, b.roomId) || compareText(a.id, b.id))
  const searchBudget = Math.min(nodeBudget, Math.max(100, Math.floor(2_000_000 / Math.max(1, active.length * scene.members.length))))
  const fixed = document.assignments.filter(a => mode === "FILL_MISSING" || a.locked)
  const sessions = new Map(scene.sessions.map(s => [s.id, s])), members = new Map(scene.members.map(m => [m.id, m]))
  const staticAllowed = new Map(active.map(s => [s.id, new Set(scene.members.filter(m => memberBlockReasons(m, s).length === 0).map(m => m.id))]))
  const conflicts = new Map<string, Set<string>>()
  const bounds = new Map(scene.sessions.map(s => [s.id, { start: +new Date(s.startTime), end: +new Date(s.endTime), buffer: s.buffer * 60000 }]))
  const durations = new Map(scene.sessions.map(s => [s.id, sessionMinutes(s)]))
  for (const s of scene.sessions) {
    const a = bounds.get(s.id)!
    conflicts.set(s.id, new Set(scene.sessions.filter(other => { const b = bounds.get(other.id)!; const gap = Math.max(a.buffer, b.buffer); return a.start < b.end + gap && b.start < a.end + gap }).map(other => other.id)))
  }
  function index(assigned: PanelAssignment[]) {
    const blocked = new Map<string, Set<string>>()
    const duty = new Map<string, PanelSession[]>(), loads = new Map<string, number>(), rooms = new Map<string, Set<string>>()
    for (const a of assigned) {
      const s = sessions.get(a.slotId); if (!s) continue
      if (!blocked.has(a.memberId)) blocked.set(a.memberId, new Set())
      conflicts.get(s.id)?.forEach(id => blocked.get(a.memberId)!.add(id))
      if (!duty.has(a.memberId)) duty.set(a.memberId, []); duty.get(a.memberId)!.push(s)
      loads.set(a.memberId, (loads.get(a.memberId) ?? 0) + durations.get(s.id)!)
      if (!rooms.has(a.memberId)) rooms.set(a.memberId, new Set()); rooms.get(a.memberId)!.add(s.roomId)
    }
    return { duty, loads, rooms, blocked }
  }
  function fits(memberId: string, slotId: string, state: ReturnType<typeof index>) {
    if (!staticAllowed.get(slotId)?.has(memberId)) return false
    const s = sessions.get(slotId)!, m = members.get(memberId)!
    const own = state.duty.get(memberId) ?? []
    return !state.blocked.get(memberId)?.has(slotId) && !longDutySessions(m, [...own, s], document.options).size
  }
  const fixedState = index(fixed)
  const base = new Map(active.map(s => [s.id, scene.members.filter(m => fits(m.id, s.id, fixedState)).map(m => m.id).sort(compareText)]))
  const free = new Map(active.map(s => [s.id, Math.max(0, s.required - fixed.filter(a => a.slotId === s.id).length)]))
  const fixedValid = validatePanelDocument({ ...document, assignments: fixed }, scene).filled
  const potential = new Map(active.map(s => [s.id, Math.min(free.get(s.id)!, base.get(s.id)!.length)]))
  let maxDeficit = 0
  for (const boundary of new Set(active.map(s => +new Date(s.startTime)))) {
    const group = active.filter(s => +new Date(s.startTime) <= boundary && +new Date(s.endTime) + s.buffer * 60000 > boundary)
    const demand = group.reduce((n, s) => n + potential.get(s.id)!, 0), available = new Set(group.flatMap(s => base.get(s.id)!))
    maxDeficit = Math.max(maxDeficit, demand - available.size)
  }
  const upper = fixedValid + [...potential.values()].reduce((a, b) => a + b, 0) - maxDeficit
  function scores(slotId: string, state: ReturnType<typeof index>) {
    const s = sessions.get(slotId)!, duration = durations.get(slotId)!
    return (memberId: string) => {
      const load = (members.get(memberId)!.baselineWorkloadMinutes ?? 0) + (state.loads.get(memberId) ?? 0), previous = state.rooms.get(memberId)
      return [2 * load * duration + duration * duration, Number(!s.existingMemberIds.includes(memberId)) + Number(!!previous?.size && !previous.has(s.roomId))] as const
    }
  }
  function candidates(slotId: string, state: ReturnType<typeof index>, available = base.get(slotId)!.filter(memberId => fits(memberId, slotId, state))) {
    const score = scores(slotId, state)
    return available.sort((a, b) => {
      const ca = score(a), cb = score(b)
      return ca[0] - cb[0] || ca[1] - cb[1] || members.get(a)!.allowedSlotIds.length - members.get(b)!.allowedSlotIds.length || compareText(a, b)
    })
  }
  function choose(remaining: Map<string, number>, assigned: PanelAssignment[]) {
    const state = index(assigned)
    let best: { slotId: string; n: number; candidates: string[] } | undefined
    for (const [slotId, n] of remaining) {
      if (n <= 0) continue
      const available = base.get(slotId)!.filter(memberId => fits(memberId, slotId, state))
      const next = { slotId, n, candidates: available }
      if (!best || available.length - n < best.candidates.length - best.n || available.length - n === best.candidates.length - best.n && (available.length < best.candidates.length || available.length === best.candidates.length && compareText(slotId, best.slotId) < 0)) best = next
    }
    if (best) best.candidates = candidates(best.slotId, state, best.candidates)
    return best
  }
  // Establish a feasible incumbent, using every session's constraints before choosing a position.
  const greedy = [...fixed], remaining = new Map(free)
  while (remaining.size) {
    const next = choose(remaining, greedy); if (!next) break
    if (!next.candidates.length) { remaining.delete(next.slotId); continue }
    greedy.push({ slotId: next.slotId, memberId: next.candidates[0], locked: false, source: "AUTO" })
    if (next.n === 1) remaining.delete(next.slotId); else remaining.set(next.slotId, next.n - 1)
  }
  let best = [...greedy], bestCount = fixedValid + greedy.length - fixed.length, nodes = 0, limited = false
  const assigned = [...fixed]
  function search(rest: Map<string, number>) {
    if (bestCount >= upper) return
    if (++nodes > searchBudget) { limited = true; return }
    const count = fixedValid + assigned.length - fixed.length
    if (count > bestCount) { best = [...assigned]; bestCount = count }
    if (count + [...rest.values()].reduce((a, b) => a + b, 0) <= bestCount) return
    const next = choose(rest, assigned); if (!next) return
    const child = new Map(rest)
    if (next.n === 1) child.delete(next.slotId); else child.set(next.slotId, next.n - 1)
    for (const memberId of next.candidates) {
      assigned.push({ slotId: next.slotId, memberId, locked: false, source: "AUTO" }); search(child); assigned.pop()
      if (limited || bestCount >= upper) return
    }
    const skipped = new Map(rest); skipped.delete(next.slotId); search(skipped)
  }
  search(new Map(free))
  // Coverage is preserved while improving workload balance and then continuity.
  const fixedKeys = new Set(fixed.map(assignmentKey))
  for (let pass = 0; pass < 8; pass++) {
    let improved = false
    for (let i = 0; i < best.length; i++) {
      const old = best[i]; if (fixedKeys.has(assignmentKey(old)) || !base.has(old.slotId)) continue
      const without = best.filter((_, j) => i !== j), state = index(without), score = scores(old.slotId, state), oldCost = score(old.memberId)
      for (const memberId of candidates(old.slotId, state)) {
        const replacement = { ...old, memberId }, nextCost = score(memberId)
        if (nextCost[0] < oldCost[0] || nextCost[0] === oldCost[0] && nextCost[1] < oldCost[1]) { best[i] = replacement; improved = true; break }
      }
    }
    if (!improved) break
  }
  best.sort((a, b) => compareText(a.slotId, b.slotId) || compareText(a.memberId, b.memberId))
  const result = { ...document, assignments: best }, validation = validatePanelDocument(result, scene)
  validation.search = { nodes, limited, coverageUpperBound: upper }
  if (limited) validation.warnings.push("The whole-window search reached its budget. This is the best feasible proposal found; review unfilled positions and locks.")
  return { document: result, validation }
}

export type PanelScheduleChange = { kind: "ADDED" | "REMOVED" | "REASSIGNED" | "ROOM_CHANGED" | "TIME_CHANGED" | "REQUIREMENT_CHANGED"; memberId?: string; before?: PanelSession; after?: PanelSession }
export type PanelPublishedView = { id: string; version: number; previousVersion: number; status: "PUBLISHED" | "SUPERSEDED"; document: PanelDocument; changes: PanelScheduleChange[]; publishedAt: string; author: string; understaffedOverride: boolean; overrideReason: string | null; notifications: Record<string, number> }
export type PanelApprovalReview = { proposalId: string; revision: number; approvalToken: string; clubName: string; roundName: string; rooms: number; sessions: number; required: number; filled: number; unfilled: number; conflicts: number; canOverride: boolean; overrideWarning: string | null; changes: PanelScheduleChange[]; previousVersion: number }
export const publishedPanelDocumentSchema = panelDocumentSchema.innerType().extend({ sessions: z.array(panelSessionSchema).max(5000), assignments: z.array(panelAssignmentSchema).max(40000) }).superRefine((d, ctx) => {
  const slots = new Set(d.sessions.map(s => s.id))
  if (slots.size !== d.sessions.length || d.assignments.some(a => !slots.has(a.slotId)) || new Set(d.assignments.map(assignmentKey)).size !== d.assignments.length) ctx.addIssue({code: z.ZodIssueCode.custom, message: "Invalid published session references."})
})
export function panelDraftScene(document: PanelDocument, scene: PanelScene): PanelScene {
  const required = new Map(document.sessions.map(s => [s.id, s.required]))
  return { ...scene, sessions: scene.sessions.map(s => ({ ...s, required: required.get(s.id) ?? s.required })) }
}
export function panelScheduleChanges(before: PanelDocument | null, after: PanelDocument): PanelScheduleChange[] {
  const oldSessions = new Map(before?.sessions.map(s => [s.id, s]) ?? []), newSessions = new Map(after.sessions.map(s => [s.id, s]))
  const changes: PanelScheduleChange[] = []
  for (const memberId of new Set([...(before?.assignments ?? []),...after.assignments].map(a => a.memberId))) {
    const old = (before?.assignments ?? []).filter(a => a.memberId === memberId).map(a => oldSessions.get(a.slotId)!).filter(Boolean)
    const next = after.assignments.filter(a => a.memberId === memberId).map(a => newSessions.get(a.slotId)!).filter(Boolean)
    const removed = old.filter(s => !next.some(n => n.id === s.id && sameSessionTime(n,s)))
    const added = next.filter(s => !old.some(n => n.id === s.id && sameSessionTime(n,s)))
    for (const from of removed) {
      const i = added.findIndex(to => to.id === from.id || to.startTime === from.startTime && to.endTime === from.endTime)
      const to = added.length ? added.splice(i >= 0 ? i : 0,1)[0] : undefined
      changes.push({ kind: to ? to.roomId !== from.roomId && to.startTime === from.startTime && to.endTime === from.endTime ? "ROOM_CHANGED" : to.id === from.id ? "TIME_CHANGED" : "REASSIGNED" : "REMOVED",memberId,before:from,...(to?{after:to}:{}) })
    }
    added.forEach(to => changes.push({kind:"ADDED",memberId,after:to}))
  }
  for (const s of after.sessions) { const old = oldSessions.get(s.id); if (old && old.required !== s.required) changes.push({kind:"REQUIREMENT_CHANGED",before:old,after:s}) }
  return changes
}
export function mergePanelPublication(previous: PanelDocument | null, proposal: PanelDocument): PanelDocument {
  const replaced = new Set(proposal.sessions.map(s=>s.id))
  return { ...proposal, sessions: [...(previous?.sessions.filter(s=>!replaced.has(s.id)) ?? []), ...proposal.sessions], assignments: [...(previous?.assignments.filter(a=>!replaced.has(a.slotId)) ?? []), ...proposal.assignments] }
}
