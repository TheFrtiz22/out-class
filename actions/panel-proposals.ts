"use server"

import { activePanelPublication, panelPublicationViews, draftApprovalReset, publicationDocument } from "@/utils/panel-publication"
import { interviewCapabilities } from "@/lib/interview-access"
import { z } from "zod"
import type { InterviewPanelProposal } from "@prisma/client"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { loadPanelPlanningScene, publicPanelScene } from "@/utils/panel-planning"
import { assignmentKey, generatePanelAssignments, panelAssignmentsSchema, panelDocumentSchema, panelOptionsSchema, panelScopeSchema, panelWindowSchema, panelDraftScene, sameSessionTime, validatePanelDocument, type PanelAssignment, type PanelDocument, type PanelProposalView, type PanelScene, type PanelValidation, type PanelWorkspace } from "@/lib/panel-proposals"
import { boundedParse } from "@/lib/bounded-input"

const changed = "The draft changed in another tab. Reload before editing again."
const editSchema = panelScopeSchema.extend({ proposalId: z.string().uuid(), revision: z.number().int().positive(), assignments: panelAssignmentsSchema, requirements: z.array(z.object({slotId:z.string().uuid(),required:z.number().int().min(1).max(8)}).strict()).max(500).optional() }).strict()
const generateSchema = panelScopeSchema.extend({ revision: z.number().int().nonnegative(), window: panelWindowSchema, options: panelOptionsSchema, mode: z.enum(["REGENERATE", "FILL_MISSING"]), assignments: panelAssignmentsSchema.optional(), selectedSlotIds:z.array(z.string().uuid()).min(1).max(500).optional() }).strict()
async function previewTransaction<T>(clubId: string, work: (tx: AppTransactionClient, actorId: string) => Promise<T>): Promise<T> {
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["interviews.manage"])
    await tx.$queryRaw`SELECT set_config('outclass.panel_proposal_mode', 'unpublished', true)`
    return work(tx, user.id)
  }, { timeout: 60000, isolationLevel: "Serializable" })
}
function proposalView(row: InterviewPanelProposal, scene: PanelScene, fingerprint: string, validation?: PanelValidation): PanelProposalView {
  const document = panelDocumentSchema.parse(row.document)
  return { id: row.id, revision: row.revision, status: row.status === "READY_FOR_APPROVAL" ? "READY_FOR_APPROVAL" : "UNPUBLISHED", basePublishedVersion:row.basePublishedVersion,approvalToken:row.approvalToken, document, validation: validation ?? validatePanelDocument(document, panelDraftScene(document,scene)), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), createdBy: row.createdBy, modifiedBy: row.modifiedBy, stale: row.sourceFingerprint !== fingerprint }
}
async function savedProposal(tx: AppTransactionClient, scope: { clubId: string; roundId: string }) {
  return tx.interviewPanelProposal.findUnique({ where: { roundId_clubId: { roundId: scope.roundId, clubId: scope.clubId } } })
}
function editDocument(row: InterviewPanelProposal, assignments: PanelAssignment[], scene: PanelScene, requirements?: {slotId:string;required:number}[]): PanelDocument {
  const document = panelDocumentSchema.parse(row.document), previous = new Map(document.assignments.map(a => [assignmentKey(a), a]))
  const slots = new Set(document.sessions.map(s => s.id)), members = new Set(scene.members.map(m => m.id))
  for (const a of assignments) {
    if (!slots.has(a.slotId) || !members.has(a.memberId) && !previous.has(assignmentKey(a))) throw new Error("Choose a session and interviewer from this club's draft.")
  }
  if(requirements && (new Set(requirements.map(r=>r.slotId)).size!==requirements.length || requirements.some(r=>!slots.has(r.slotId)))) throw new Error("Choose unique staffing requirements from this draft.")
  // A closed room's session is only ever un-staffed, so its staffing requirement stays as published.
  const closed=new Set(scene.sessions.filter(s=>s.unstaffOnly).map(s=>s.id))
  if(requirements?.some(r=>closed.has(r.slotId)&&r.required!==document.sessions.find(s=>s.id===r.slotId)?.required)) throw new Error("This room is closed. Its interviewers can only be removed; its staffing requirement can't change.")
  const targets=new Map(requirements?.map(r=>[r.slotId,r.required])??[])
  const edited = { ...document, sessions: document.sessions.map(s=>({...s,required:targets.get(s.id)??s.required,originalRequired:s.originalRequired??s.required})), assignments: assignments.map(({ availabilityOverrideId: _untrusted, ...a }) => {
    const prior = previous.get(assignmentKey(a))
    return { ...a, source: prior?.source ?? "MANUAL" as const, ...(prior?.availabilityOverrideId ? { availabilityOverrideId: prior.availabilityOverrideId } : {}) }
  }) }
  const validation = validatePanelDocument(edited, panelDraftScene(edited,scene)), additions = assignments.filter(a => !previous.has(assignmentKey(a)))
  const unsafe = validation.issues.filter(i => additions.some(a => a.slotId === i.slotId && (!i.memberId || a.memberId === i.memberId)))
  if (unsafe.length) throw new Error(unsafe[0].message)
  return edited
}
export async function getPanelProposalWorkspace(raw: unknown): Promise<PanelWorkspace> {
  const scope = panelScopeSchema.extend({ window: panelWindowSchema.optional() }).strict().parse(raw)
  return previewTransaction(scope.clubId, async (tx,actorId) => {
    const saved = await savedProposal(tx, scope)
    const document = saved ? panelDocumentSchema.parse(saved.document) : null
    const live = await loadPanelPlanningScene(tx, scope, document?.window ?? scope.window)
    const history=await panelPublicationViews(tx,{clubId:scope.clubId,roundId:scope.roundId}),club=await tx.club.findUniqueOrThrow({where:{id:scope.clubId},select:{name:true}})
    const member=await tx.clubMember.findUnique({where:{userId_clubId:{userId:actorId,clubId:scope.clubId}}})
    return { clubName:club.name,canPublish:interviewCapabilities(member).manageGrants,canOverrideAvailability:interviewCapabilities(member).overrideAvailability,published:history.find(v=>v.status==="PUBLISHED")??null,history, roundId: scope.roundId, roundName: live.roundName, timezone: live.timezone, scene: publicPanelScene(live.scene), proposal: saved ? proposalView(saved, live.scene, live.fingerprint) : null, suggestedWindow: live.suggestedWindow, fingerprint: live.fingerprint }
  })
}
export async function generatePanelProposal(raw: unknown): Promise<PanelWorkspace> {
  const input = boundedParse(generateSchema, raw)
  return previewTransaction(input.clubId, async (tx, actorId) => {
    const old = await savedProposal(tx, input)
    if ((old?.revision ?? 0) !== input.revision) throw new Error(changed)
    const active=await activePanelPublication(tx,input)
    if(old && old.basePublishedVersion!==(active?.version??0))throw new Error("A newer panel schedule was published. Reload and open a fresh revision.")
    const oldDocument = old ? panelDocumentSchema.parse(old.document) : null
    if (oldDocument && (oldDocument.window.start !== input.window.start || oldDocument.window.end !== input.window.end)) throw new Error("Discard the existing draft before choosing a different window.")
    const live = await loadPanelPlanningScene(tx, input, input.window)
    if (!live.scene.sessions.some(s => s.active || s.unstaffOnly)) throw new Error(old ? "There are no upcoming, open sessions in this window. Discard this draft or reopen a room." : "There are no upcoming, open sessions in this window.")
    const edited = old && input.assignments ? editDocument(old, input.assignments, live.scene) : oldDocument
    if (!old && input.assignments?.length) throw new Error("Generate a draft before editing positions.")
    const selected=input.selectedSlotIds?new Set(input.selectedSlotIds):null
    if(selected&&([...selected].some(id=>!live.scene.sessions.some(s=>s.id===id))||selected.size!==input.selectedSlotIds!.length))throw new Error("Choose unique existing sessions to regenerate.")
    // Every regeneration rebuilds the draft against current sessions, so closing or reopening a room, or
    // adding, removing or passing a time, never strands it. Positions on sessions that are gone, past, or
    // booked in a closed room leave the draft; their published panels stay exactly as they are.
    const liveSessions = new Map(live.scene.sessions.map(s => [s.id, s]))
    const baselines = new Map(edited?.sessions.map(s => [s.id, s]) ?? [])
    const planned = edited?.assignments.filter(a => liveSessions.get(a.slotId)?.active) ?? []
    const fixed = planned.filter(a => input.mode === "FILL_MISSING" || a.locked || selected && !selected.has(a.slotId))
    const fixedSlots = new Set(fixed.map(a => a.slotId))
    // A closed session keeps the interviewers the draft already kept for it (or, when it has just closed,
    // its published ones). Nobody new is added and regeneration never empties it; only a leader's edit does.
    const official = publicationDocument(active)
    const closedPositions: PanelAssignment[] = live.scene.sessions.filter(s => s.unstaffOnly).flatMap(s => baselines.get(s.id)?.unstaffOnly
      ? edited!.assignments.filter(a => a.slotId === s.id && s.existingMemberIds.includes(a.memberId))
      : s.existingMemberIds.map(memberId => { const prior = official?.assignments.find(a => a.slotId === s.id && a.memberId === memberId); return { slotId: s.id, memberId, locked: false, source: "EXISTING" as const, ...(prior?.availabilityOverrideId ? { availabilityOverrideId: prior.availabilityOverrideId } : {}) } }))
    const sessions = live.scene.sessions.filter(s => s.active || s.unstaffOnly).map(s => {
      const baseline = baselines.get(s.id)
      if (s.active && fixedSlots.has(s.id) && baseline && !sameSessionTime(s, baseline)) return baseline
      return s.unstaffOnly ? { ...s, originalRequired: s.required } : { ...s, originalRequired: s.required, required: baseline?.originalRequired !== undefined && !baseline.unstaffOnly ? baseline.required : s.required }
    })
    const document: PanelDocument = { version: 1, window: input.window, options: input.options, sessions: sessions.filter(s => !s.unstaffOnly), assignments: planned }
    // A retained lock on a changed time is a visible conflict, never a premise for fresh assignments.
    const adjusted=panelDraftScene(document,live.scene)
    const generationScene = { ...adjusted, sessions: adjusted.sessions.filter(s => !s.unstaffOnly).map(s => {
      const baseline = baselines.get(s.id)
      return selected && !selected.has(s.id) || fixedSlots.has(s.id) && baseline && !sameSessionTime(s, baseline) ? { ...s, active: false } : s
    }) }
    const generated = generatePanelAssignments(generationScene, {...document,assignments:document.assignments.map(a=>selected&&!selected.has(a.slotId)?{...a,locked:true}:a)}, input.mode)
    if(selected)generated.document.assignments=generated.document.assignments.map(a=>!selected.has(a.slotId)?{...a,locked:document.assignments.find(old=>assignmentKey(old)===assignmentKey(a))?.locked??a.locked}:a)
    const order = (a: PanelAssignment, b: PanelAssignment) => a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0
    generated.document = { ...generated.document, sessions, assignments: [...generated.document.assignments, ...closedPositions].sort(order) }
    // Locked positions on sessions that were removed, ended or closed cannot be kept; say how many left.
    const kept = new Set(generated.document.assignments.map(assignmentKey)), droppedLockedPositions = edited?.assignments.filter(a => a.locked && !kept.has(assignmentKey(a))).length ?? 0
    const validation = validatePanelDocument(generated.document, panelDraftScene(generated.document,live.scene))
    validation.search = generated.validation.search; validation.warnings = generated.validation.warnings
    const values = { ...draftApprovalReset,basePublishedVersion:active?.version??0, document: generated.document, validation, sourceFingerprint: live.fingerprint, modifiedBy: actorId }
    const row = old ? await tx.interviewPanelProposal.update({ where: { id: old.id }, data: { ...values, revision: { increment: 1 } } }) : await tx.interviewPanelProposal.create({ data: { clubId: input.clubId, roundId: input.roundId, createdBy: actorId, ...values } })
    await tx.auditLog.create({ data: { clubId: input.clubId, actorId, targetId: row.id, action: "interview.panel-proposal.generate", details: { mode: input.mode, revision: row.revision } } })
    return { roundId: input.roundId, roundName: live.roundName, timezone: live.timezone, scene: publicPanelScene(live.scene), proposal: proposalView(row, live.scene, live.fingerprint, validation), suggestedWindow: live.suggestedWindow, fingerprint: live.fingerprint, droppedLockedPositions }
  })
}
async function editPreview(raw: unknown, persist: boolean) {
  const input = boundedParse(editSchema, raw)
  return previewTransaction(input.clubId, async (tx, actorId) => {
    const old = await savedProposal(tx, input)
    if (!old || old.id !== input.proposalId || old.revision !== input.revision) throw new Error(changed)
    const live = await loadPanelPlanningScene(tx, input, panelDocumentSchema.parse(old.document).window)
    const document = editDocument(old, input.assignments, live.scene,input.requirements), validation = validatePanelDocument(document, panelDraftScene(document,live.scene))
    let row = old
    if (persist) {
      row = await tx.interviewPanelProposal.update({ where: { id: old.id }, data: { ...draftApprovalReset,document, validation, modifiedBy: actorId, revision: { increment: 1 } } })
      await tx.auditLog.create({ data: { clubId: input.clubId, actorId, targetId: row.id, action: "interview.panel-proposal.save", details: { revision: row.revision } } })
    }
    return { ...proposalView(row, live.scene, live.fingerprint, validation), status:"UNPUBLISHED" as const,approvalToken:null,document }
  })
}
export async function previewPanelProposalEdits(raw: unknown) { return editPreview(raw, false) }
export async function savePanelProposalDraft(raw: unknown) { return editPreview(raw, true) }
export async function discardPanelProposal(raw: unknown) {
  const input = panelScopeSchema.extend({ proposalId: z.string().uuid(), revision: z.number().int().positive() }).strict().parse(raw)
  return previewTransaction(input.clubId, async (tx, actorId) => {
    const old = await savedProposal(tx, input)
    if (!old || old.id !== input.proposalId || old.revision !== input.revision) throw new Error(changed)
    await tx.interviewPanelProposal.delete({ where: { id: old.id } })
    await tx.auditLog.create({ data: { clubId: input.clubId, actorId, targetId: old.id, action: "interview.panel-proposal.discard" } })
    return { discarded: true }
  })
}
