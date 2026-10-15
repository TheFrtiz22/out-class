import { demoStore, demoMember } from "./store"
import { interviewCapabilities } from "@/lib/interview-access"
import { hasPermission } from "@/lib/permissions"
import { overlaps, bookingSlotSnapshot, type BookingSettings } from "@/lib/interview-rooms"
import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { panelDocumentSchema, panelDraftScene, validatePanelDocument, generatePanelAssignments, canProposeMember, availabilityOverrideConditions, assignmentKey, type PanelWorkspace, type PanelProposalView, type PanelPublishedView, type PanelDocument, type PanelAssignment, type PanelScene } from "@/lib/panel-proposals"
export type DemoBookingFlow = {
  settings: Record<string, BookingSettings>
  publishedSlots: Record<string, ReturnType<typeof bookingSlotSnapshot>[]>
  panels: Record<string, { draft: PanelProposalView | null; published: PanelPublishedView | null; history: PanelPublishedView[] }>
  availability: Record<string, { confirmed: boolean; state: "available" | "unknown" | "unavailable" }>
  overrides: { id: string; slotId: string; memberId: string; roundId: string; clubId: string; createdBy: string; createdAt: string; startTime: string; endTime: string; buffer: number; duration: number; conditions: string[]; reason?: string; revokedAt: string | null }[]
  notices: { id: string; userId: string; clubId: string; title: string; body: string; href: string; createdAt: Date }[]
  publicationReceipts: Record<string, { clubId: string; roundId: string; proposalId: string; revision: number; actorId: string; publicationId: string; version: number }>
}
export const defaultBookingSettings = (): BookingSettings => ({ bookingPublishedAt: null, bookingPaused: false, bookingRevision: 0, bookingCycleId: null, bookingAllowCancellation: true, bookingAllowRescheduling: true })
export const emptyDemoBookingFlow = (): DemoBookingFlow => ({ settings: {}, publishedSlots: {}, panels: {}, availability: {}, overrides: [], notices: [], publicationReceipts: {} })
function manager(clubId: string) { const s = demoStore.get(), m = demoMember(); if (s.perspective.role !== "leader" || m.clubId !== clubId || !hasPermission(m, "interviews.manage")) throw Error("Interview scheduling access required."); return { s, m } }
function panelState(roundId: string) {
  const saved = demoStore.get().bookingFlow.panels[roundId] ?? { draft: null, published: null, history: [] }
  const document = (d: PanelDocument): PanelDocument => ({ ...d, window: { start: new Date(d.window.start).toISOString(), end: new Date(d.window.end).toISOString() }, sessions: d.sessions.map(s => ({ ...s, startTime: new Date(s.startTime).toISOString(), endTime: new Date(s.endTime).toISOString() })) })
  const published = (p: PanelPublishedView): PanelPublishedView => ({ ...p, document: document(p.document), publishedAt: new Date(p.publishedAt).toISOString() })
  return { ...saved, draft: saved.draft ? { ...saved.draft, document: document(saved.draft.document), createdAt: new Date(saved.draft.createdAt).toISOString(), updatedAt: new Date(saved.draft.updatedAt).toISOString() } : null, published: saved.published ? published(saved.published) : null, history: saved.history.map(published) }
}
export function demoBookingSettings(roundId: string) { return demoStore.get().bookingFlow.settings[roundId] ?? defaultBookingSettings() }
export function demoBookingNotice(userId: string, clubId: string, id: string, title: string, body: string, href: string) { demoStore.mutate(s => { if (!s.bookingFlow.notices.some(n => n.id === id)) s.bookingFlow.notices.push({ id, userId, clubId, title, body, href, createdAt: new Date() }) }) }
export function demoPanelScene(clubId: string, roundId: string, window?: { start: string; end: string }): PanelScene {
  const s = demoStore.get(), club = s.clubs.find(c => c.id === clubId), round = club?.rounds.find(r => r.id === roundId)
  if (!round || round.archivedAt || !["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type!)) throw Error("Choose an active interview round.")
  const sessions = s.interviewRooms.filter(r => r.clubId === clubId && r.roundId === roundId).flatMap(r => r.slots.filter(slot => +new Date(slot.startTime) > Date.now() && (!window || +new Date(slot.startTime) >= +new Date(window.start) && +new Date(slot.startTime) < +new Date(window.end))).map(slot => ({ id: slot.id, roomId: r.id, roomName: r.name, timezone: r.timezone, startTime: new Date(slot.startTime).toISOString(), endTime: new Date(slot.endTime).toISOString(), buffer: r.buffer, required: slot.interviewersNeeded ?? r.interviewersNeeded ?? 2, active: r.isOpen, roomRevision: r.staffingRevision ?? 0, slotRevision: slot.staffingRevision ?? 0, existingMemberIds: slot.panelScheduleVersionId ? slot.publishedPanelMemberIds ?? [] : r.panelApprovedBy ? r.approvedPanelMemberIds ?? [] : [] })))
  const members = s.memberships.filter(m => m.clubId === clubId).map(m => {
    const p = s.students.find(u => u.id === m.userId)!, own = s.bookingFlow.availability[`${roundId}:${m.id}`] ?? { confirmed: m.id !== s.memberships.find(v => v.clubId === s.clubs[0].id && v.isOwner)?.id, state: "available" as const }
    const blocks: Record<string, string[]> = {}, allowedSlotIds: string[] = []
    for (const slot of sessions) { const reasons = []; if (own.state !== "available") reasons.push(own.state === "unknown" ? "UNKNOWN_AVAILABILITY" : "UNAVAILABLE"); if (s.interviewRooms.some(r => r.clubId !== clubId || r.roundId !== roundId ? r.isOpen && r.slots.some(other => (other.publishedPanelMemberIds ?? r.approvedPanelMemberIds ?? []).some(id => s.memberships.find(x => x.id === id)?.userId === m.userId) && overlaps(slot, other, Math.max(slot.buffer, r.buffer))) : false)) reasons.push("OFFICIAL_COMMITMENT"); if (reasons.length) blocks[slot.id] = reasons; else allowedSlotIds.push(slot.id) }
    const availabilityOverrides = s.bookingFlow.overrides.filter(o => o.clubId === clubId && o.roundId === roundId && o.memberId === m.id && !o.revokedAt && s.memberships.some(author => author.clubId === clubId && author.userId === o.createdBy && interviewCapabilities(author).overrideAvailability) && sessions.some(slot => slot.id === o.slotId && slot.startTime === new Date(o.startTime).toISOString() && slot.endTime === new Date(o.endTime).toISOString() && slot.buffer === o.buffer && s.interviewRooms.find(r => r.id === slot.roomId)?.duration === o.duration)).map(o => ({ id: o.id, slotId: o.slotId, conditions: o.conditions }))
    return { id: m.id, name: `${p.profile.firstName} ${p.profile.lastName}`, role: m.role, eligible: m.status === "ACTIVE", confirmed: own.confirmed, evidenceAccess: interviewCapabilities(m).participate, allowedSlotIds, blocks, availabilityOverrides }
  })
  return { sessions, members }
}
export async function getPanelProposalWorkspace(input: { clubId: string; roundId: string; window?: { start: string; end: string } }): Promise<PanelWorkspace> {
  const { s, m } = manager(input.clubId), state = panelState(input.roundId), scene = demoPanelScene(input.clubId, input.roundId, state.draft?.document.window ?? input.window)
  const suggestedWindow = scene.sessions.length ? { start: scene.sessions[0].startTime, end: scene.sessions.at(-1)!.endTime } : null
  const draft = state.draft ? { ...state.draft, validation: validatePanelDocument(state.draft.document, panelDraftScene(state.draft.document, scene)) } : null
  return { clubName: s.clubs[0].name, roundName: s.clubs[0].rounds.find(r => r.id === input.roundId)!.name, roundId: input.roundId, timezone: SCHEDULING_TIMEZONE, scene, proposal: draft, published: state.published, history: state.history, canPublish: interviewCapabilities(m).manageGrants, canOverrideAvailability: interviewCapabilities(m).overrideAvailability, suggestedWindow, fingerprint: "demo-local" }
}
async function saveDocument(input: { clubId: string; roundId: string; revision: number }, document: PanelDocument) {
  const { m } = manager(input.clubId), state = panelState(input.roundId)
  if ((state.draft?.revision ?? 0) !== input.revision) throw Error("Draft changed. Reload before saving.")
  const draft: PanelProposalView = { id: state.draft?.id ?? crypto.randomUUID(), document, revision: input.revision + 1, basePublishedVersion: state.published?.version ?? 0, status: "UNPUBLISHED", approvalToken: null, createdAt: state.draft?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: m.userId, modifiedBy: m.userId, stale: false, validation: validatePanelDocument(document, panelDraftScene(document, demoPanelScene(input.clubId, input.roundId, document.window))) }
  demoStore.mutate(s => { s.bookingFlow.panels[input.roundId] = { ...state, draft } }); return draft
}
export async function generatePanelProposal(input: { clubId: string; roundId: string; revision: number; window: { start: string; end: string }; options: PanelDocument["options"]; mode: "REGENERATE" | "FILL_MISSING"; assignments?: PanelAssignment[] }) {
  manager(input.clubId); const scene = demoPanelScene(input.clubId, input.roundId, input.window), old = panelState(input.roundId).draft
  const document = panelDocumentSchema.parse({ version: 1, window: input.window, options: input.options, sessions: scene.sessions, assignments: input.assignments ?? old?.document.assignments ?? [] })
  await saveDocument(input, generatePanelAssignments(scene, document, input.mode).document); return getPanelProposalWorkspace(input)
}
export async function previewPanelProposalEdits(input: { clubId: string; roundId: string; proposalId: string; revision: number; assignments: PanelAssignment[]; requirements?: { slotId: string; required: number }[] }) {
  manager(input.clubId); const draft = panelState(input.roundId).draft
  if (!draft || draft.id !== input.proposalId || draft.revision !== input.revision) throw Error("Draft changed. Reload before editing.")
  const assignments = input.assignments.map(({ availabilityOverrideId: _untrusted, ...a }) => { const old = draft.document.assignments.find(p => assignmentKey(p) === assignmentKey(a)); return { ...a, ...(old?.availabilityOverrideId ? { availabilityOverrideId: old.availabilityOverrideId } : {}) } })
  const document = panelDocumentSchema.parse({ ...draft.document, assignments, sessions: draft.document.sessions.map(s => ({ ...s, required: input.requirements?.find(r => r.slotId === s.id)?.required ?? s.required })) }), validation = validatePanelDocument(document, panelDraftScene(document, demoPanelScene(input.clubId, input.roundId, document.window)))
  if (validation.issues.some(i => !draft.document.assignments.some(a => a.slotId === i.slotId && a.memberId === i.memberId))) throw Error(validation.issues[0].message)
  return { ...draft, document, validation }
}
export async function savePanelProposalDraft(input: Parameters<typeof previewPanelProposalEdits>[0]) { const edited = await previewPanelProposalEdits(input); return saveDocument(input, edited.document) }
export async function discardPanelProposal(input: { clubId: string; roundId: string; proposalId: string; revision: number }) { manager(input.clubId); const old = panelState(input.roundId); if (old.draft?.id !== input.proposalId || old.draft.revision !== input.revision) throw Error("Draft changed."); demoStore.mutate(s => { s.bookingFlow.panels[input.roundId] = { ...old, draft: null } }); return { discarded: true } }
export async function assignPanelAvailabilityOverride(input: { clubId: string; roundId: string; proposalId: string; revision: number; slotId: string; memberId: string; requestId: string; replaceMemberId?: string; reason?: string }) {
  const { s, m } = manager(input.clubId); if (!interviewCapabilities(m).overrideAvailability) throw Error("Only the current president can override availability.")
  const draft = panelState(input.roundId).draft; if (!draft || draft.id !== input.proposalId) throw Error("Reload draft.")
  const prior = s.bookingFlow.overrides.find(o => o.id === input.requestId); if (prior && prior.createdBy === m.userId && !prior.revokedAt && draft.document.assignments.some(a => a.availabilityOverrideId === prior.id)) return { saved: true }
  if (prior || draft.revision !== input.revision) throw Error("Override request changed.")
  const scene = panelDraftScene(draft.document, demoPanelScene(input.clubId, input.roundId, draft.document.window)), slot = scene.sessions.find(s => s.id === input.slotId)!
  const old = draft.document.assignments.find(a => a.slotId === input.slotId && a.memberId === input.replaceMemberId)
  if (input.replaceMemberId && (!old || old.locked)) throw Error("Choose an unlocked position.")
  const without = draft.document.assignments.filter(a => a !== old), reasons = canProposeMember(scene, without, input.slotId, input.memberId, draft.document.options)
  if (!slot || !reasons.length || reasons.some(r => !availabilityOverrideConditions.includes(r as typeof availabilityOverrideConditions[number])) || without.filter(a => a.slotId === slot.id).length >= slot.required) throw Error("Eligibility, access and official conflicts cannot be overridden.")
  demoStore.mutate(s => { s.bookingFlow.overrides.push({ id: input.requestId, clubId: input.clubId, roundId: input.roundId, memberId: input.memberId, slotId: slot.id, createdBy: m.userId, createdAt: new Date().toISOString(), startTime: slot.startTime, endTime: slot.endTime, buffer: slot.buffer, duration: s.interviewRooms.find(r => r.id === slot.roomId)!.duration, conditions: reasons, reason: input.reason, revokedAt: null }); s.interviewFoundation.audit.push({ action: "interview.availability.override", actorId: m.userId, targetId: input.requestId }) })
  await saveDocument(input, { ...draft.document, assignments: [...without, { slotId: slot.id, memberId: input.memberId, source: "MANUAL", locked: false, availabilityOverrideId: input.requestId }] }); return { saved: true }
}
export async function revokePanelAvailabilityOverride(input: { clubId: string; overrideId: string }) { const { m } = manager(input.clubId); if (!interviewCapabilities(m).overrideAvailability) throw Error("Only the current president can revoke overrides."); demoStore.mutate(s => { const row = s.bookingFlow.overrides.find(o => o.id === input.overrideId && o.clubId === input.clubId); if (!row) throw Error("Override unavailable."); row.revokedAt ??= new Date().toISOString() }); return { revoked: true } }
export async function revalidatePanelDraft(input: { clubId: string; roundId: string; revision: number }) { const draft = panelState(input.roundId).draft; if (!draft) return { ok: false as const, error: "Reload draft." }; const saved = await saveDocument(input, draft.document); return { ok: true as const, value: { revision: saved.revision } } }
export async function reviewPanelPublication(input: { clubId: string; roundId: string; revision: number }) {
  const { m } = manager(input.clubId), state = await getPanelProposalWorkspace(input), draft = state.proposal
  if (!interviewCapabilities(m).manageGrants || !draft || draft.revision !== input.revision || draft.validation.issues.length) return { ok: false as const, error: draft?.validation.issues[0]?.message ?? "Current owner approval is required." }
  const ready = { ...draft, revision: draft.revision + 1, approvalToken: crypto.randomUUID(), status: "READY_FOR_APPROVAL" as const }; demoStore.mutate(s => { s.bookingFlow.panels[input.roundId].draft = ready })
  return { ok: true as const, value: { proposalId: ready.id, revision: ready.revision, approvalToken: ready.approvalToken!, clubName: state.clubName!, roundName: state.roundName, rooms: new Set(draft.document.sessions.map(s => s.roomId)).size, sessions: draft.document.sessions.length, required: draft.validation.required, filled: draft.validation.filled, unfilled: draft.validation.required - draft.validation.filled, conflicts: 0, canOverride: true, overrideWarning: null, changes: [], previousVersion: state.published?.version ?? 0 } }
}
export async function publishPanelSchedule(input: { clubId: string; roundId: string; proposalId: string; revision: number; approvalToken: string }) {
  const { s, m } = manager(input.clubId), state = panelState(input.roundId), current = await getPanelProposalWorkspace(input), draft = current.proposal
  const receipt = s.bookingFlow.publicationReceipts[input.approvalToken]
  if (interviewCapabilities(m).manageGrants && receipt?.actorId === m.userId && receipt.clubId === input.clubId && receipt.roundId === input.roundId && receipt.proposalId === input.proposalId && receipt.revision === input.revision) return { ok: true as const, value: { publicationId: receipt.publicationId, version: receipt.version, idempotent: true } }
  if (!interviewCapabilities(m).manageGrants || !draft || draft.id !== input.proposalId || draft.revision !== input.revision || draft.approvalToken !== input.approvalToken || draft.validation.issues.length || draft.validation.filled < draft.validation.required) return { ok: false as const, error: "Approve a current, fully staffed panel first." }
  const version: PanelPublishedView = { id: crypto.randomUUID(), version: (state.published?.version ?? 0) + 1, previousVersion: state.published?.version ?? 0, status: "PUBLISHED", document: draft.document, changes: [], publishedAt: new Date().toISOString(), author: "Sample president", understaffedOverride: false, overrideReason: null, notifications: {} }
  demoStore.mutate(s => { s.bookingFlow.publicationReceipts[input.approvalToken] = { clubId: input.clubId, roundId: input.roundId, proposalId: input.proposalId, revision: input.revision, actorId: m.userId, publicationId: version.id, version: version.version }; s.bookingFlow.panels[input.roundId] = { draft: null, published: version, history: [version, ...state.history.map(v => ({ ...v, status: "SUPERSEDED" as const }))] }; for (const session of draft.document.sessions) { const room = s.interviewRooms.find(r => r.id === session.roomId)!, slot = room.slots.find(slot => slot.id === session.id)!; slot.panelScheduleVersionId = version.id; slot.publishedPanelMemberIds = draft.document.assignments.filter(a => a.slotId === session.id).map(a => a.memberId); slot.interviewersNeeded = session.required; room.panelApprovedBy = m.userId } })
  for (const memberId of new Set(draft.document.assignments.map(a => a.memberId))) { const member = s.memberships.find(m => m.id === memberId)!; demoBookingNotice(member.userId, input.clubId, `panel-schedule:${version.id}:${memberId}`, "Interview panel schedule updated", "Your approved interview assignments are available.", `/settings/interviews?clubId=${input.clubId}&roundId=${input.roundId}`) }
  return { ok: true as const, value: { publicationId: version.id, version: version.version, idempotent: false } }
}
export async function beginPanelScheduleRevision(input: { clubId: string; roundId: string; publishedVersion: number }) { manager(input.clubId); const state = panelState(input.roundId); if (state.published?.version !== input.publishedVersion || state.draft) return { ok: false as const, error: "Reload the published schedule." }; const saved = await saveDocument({ ...input, revision: 0 }, state.published.document); return { ok: true as const, value: { proposalId: saved.id } } }
export function demoBookingCoverage(clubId: string, roundId: string, studentId?: string) {
  const scene = demoPanelScene(clubId, roundId), s = demoStore.get(), official = panelState(roundId).published, assignments = official?.document.assignments ?? scene.sessions.flatMap(slot => slot.existingMemberIds.map(memberId => ({ slotId: slot.id, memberId, locked: false, source: "EXISTING" as const })))
  const app = studentId ? s.applications.find(a => a.clubId === clubId && a.roundId === roundId && a.studentId === studentId) : null
  const revoked = app ? s.interviewFoundation.assignments.filter(g => g.applicationId === app.id && g.roundId === roundId && !g.bookingManaged && g.revokedAt) : []
  const adjusted = { ...scene, members: scene.members.map(m => studentId && s.memberships.find(v => v.id === m.id)?.userId === studentId || revoked.some(g => g.memberId === m.id) ? { ...m, evidenceAccess: false } : m) }
  const validation = validatePanelDocument({ version: 1, window: { start: new Date().toISOString(), end: new Date(Date.now() + 1).toISOString() }, options: official?.document.options ?? { maxConsecutiveMinutes: null, breakMinutes: 15 }, sessions: scene.sessions, assignments }, adjusted)
  return validation.sessions.filter(row => scene.sessions.some(slot => slot.id === row.slotId && slot.active)).map(row => ({ slotId: row.slotId, bookable: row.status === "FULLY_STAFFED", reasons: [`${row.unfilled} unfilled interviewer positions.`, ...validation.issues.filter(i => i.slotId === row.slotId).map(i => i.message)] }))
}
export async function getInterviewBookingPublication(input: { clubId: string; roundId: string }) { manager(input.clubId); return { slots: demoBookingCoverage(input.clubId, input.roundId) } }
export async function setInterviewBookingPublication(input: { clubId: string; roundId: string; revision: number; action: "PUBLISH" | "PAUSE" | "POLICY"; cycleId: string | null; allowCancellation: boolean; allowRescheduling: boolean }) {
  const { s } = manager(input.clubId), old = demoBookingSettings(input.roundId); if (input.cycleId) throw Error("The isolated sample uses applications without a cycle."); if (old.bookingRevision !== input.revision) throw Error("Booking settings changed.")
  if (input.action === "PUBLISH") { const rows = demoBookingCoverage(input.clubId, input.roundId); if (!rows.length || rows.some(r => !r.bookable)) throw Error("Approve fully staffed future sessions before publishing booking.") }
  const settings = { ...old, bookingRevision: old.bookingRevision + 1, bookingAllowCancellation: input.allowCancellation, bookingAllowRescheduling: input.allowRescheduling, ...(input.action === "PUBLISH" ? { bookingPublishedAt: old.bookingPublishedAt ?? new Date().toISOString(), bookingPaused: false } : input.action === "PAUSE" ? { bookingPaused: true } : {}) }; demoStore.mutate(s => { s.bookingFlow.settings[input.roundId] = settings; if(input.action === "PUBLISH")s.bookingFlow.publishedSlots[input.roundId]=s.interviewRooms.filter(r=>r.clubId===input.clubId&&r.roundId===input.roundId&&r.isOpen).flatMap(r=>r.slots.filter(slot=>+new Date(slot.startTime)>Date.now()).map(slot=>bookingSlotSnapshot(slot,r))) })
  if (input.action === "PUBLISH") for (const app of s.applications.filter(a => a.clubId === input.clubId && a.roundId === input.roundId && a.status === "INTERVIEWING")) demoBookingNotice(app.studentId, input.clubId, `booking-published:${app.id}:${input.roundId}`, "Book your interview", "Choose a time for your invited interview round.", `/interviews/book?clubId=${input.clubId}&roundId=${input.roundId}`)
  return { revision: settings.bookingRevision }
}
