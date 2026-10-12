"use server"

import { z } from "zod"
import type { InterviewPanelProposal } from "@prisma/client"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { loadPanelPlanningScene, publicPanelScene } from "@/utils/panel-planning"
import { assignmentKey, generatePanelAssignments, panelAssignmentsSchema, panelDocumentSchema, panelOptionsSchema, panelScopeSchema, panelWindowSchema, sameSessionTime, validatePanelDocument, type PanelAssignment, type PanelDocument, type PanelProposalView, type PanelScene, type PanelValidation, type PanelWorkspace } from "@/lib/panel-proposals"

const changed = "The draft changed in another tab. Reload before editing again."
const editSchema = panelScopeSchema.extend({ proposalId: z.string().uuid(), revision: z.number().int().positive(), assignments: panelAssignmentsSchema }).strict()
const generateSchema = panelScopeSchema.extend({ revision: z.number().int().nonnegative(), window: panelWindowSchema, options: panelOptionsSchema, mode: z.enum(["REGENERATE", "FILL_MISSING"]), assignments: panelAssignmentsSchema.optional() }).strict()
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
  return { id: row.id, revision: row.revision, status: "UNPUBLISHED", document, validation: validation ?? validatePanelDocument(document, scene), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), createdBy: row.createdBy, modifiedBy: row.modifiedBy, stale: row.sourceFingerprint !== fingerprint }
}
async function savedProposal(tx: AppTransactionClient, scope: { clubId: string; roundId: string }) {
  return tx.interviewPanelProposal.findUnique({ where: { roundId_clubId: { roundId: scope.roundId, clubId: scope.clubId } } })
}
function editDocument(row: InterviewPanelProposal, assignments: PanelAssignment[], scene: PanelScene): PanelDocument {
  const document = panelDocumentSchema.parse(row.document), previous = new Map(document.assignments.map(a => [assignmentKey(a), a]))
  const slots = new Set(document.sessions.map(s => s.id)), members = new Set(scene.members.map(m => m.id))
  for (const a of assignments) {
    if (!slots.has(a.slotId) || !members.has(a.memberId) && !previous.has(assignmentKey(a))) throw new Error("Choose a session and interviewer from this club's draft.")
  }
  const edited = { ...document, assignments: assignments.map(a => ({ ...a, source: previous.get(assignmentKey(a))?.source ?? "MANUAL" as const })) }
  const validation = validatePanelDocument(edited, scene), additions = assignments.filter(a => !previous.has(assignmentKey(a)))
  const unsafe = validation.issues.filter(i => additions.some(a => a.slotId === i.slotId && (!i.memberId || a.memberId === i.memberId)))
  if (unsafe.length) throw new Error(unsafe[0].message)
  return edited
}
export async function getPanelProposalWorkspace(raw: unknown): Promise<PanelWorkspace> {
  const scope = panelScopeSchema.extend({ window: panelWindowSchema.optional() }).strict().parse(raw)
  return previewTransaction(scope.clubId, async tx => {
    const saved = await savedProposal(tx, scope)
    const document = saved ? panelDocumentSchema.parse(saved.document) : null
    const live = await loadPanelPlanningScene(tx, scope, document?.window ?? scope.window)
    return { roundId: scope.roundId, roundName: live.roundName, timezone: live.timezone, scene: publicPanelScene(live.scene), proposal: saved ? proposalView(saved, live.scene, live.fingerprint) : null, suggestedWindow: live.suggestedWindow, fingerprint: live.fingerprint }
  })
}
export async function generatePanelProposal(raw: unknown): Promise<PanelWorkspace> {
  const input = generateSchema.parse(raw)
  return previewTransaction(input.clubId, async (tx, actorId) => {
    const old = await savedProposal(tx, input)
    if ((old?.revision ?? 0) !== input.revision) throw new Error(changed)
    const oldDocument = old ? panelDocumentSchema.parse(old.document) : null
    if (oldDocument && (oldDocument.window.start !== input.window.start || oldDocument.window.end !== input.window.end)) throw new Error("Discard the existing draft before choosing a different window.")
    const live = await loadPanelPlanningScene(tx, input, input.window)
    if (!live.scene.sessions.some(s => s.active)) throw new Error("There are no upcoming, open sessions in this window.")
    const edited = old && input.assignments ? editDocument(old, input.assignments, live.scene) : oldDocument
    if (!old && input.assignments?.length) throw new Error("Generate a draft before editing positions.")
    const fixed = edited?.assignments.filter(a => input.mode === "FILL_MISSING" || a.locked) ?? []
    const fixedSlots = new Set(fixed.map(a => a.slotId))
    const baselines = new Map(edited?.sessions.map(s => [s.id, s]) ?? [])
    const sessions = live.scene.sessions.map(s => fixedSlots.has(s.id) ? baselines.get(s.id) ?? s : s)
    for (const s of edited?.sessions ?? []) if (fixedSlots.has(s.id) && !sessions.some(current => current.id === s.id)) sessions.push(s)
    const document: PanelDocument = { version: 1, window: input.window, options: input.options, sessions, assignments: edited?.assignments ?? [] }
    // A retained lock on a changed time is a visible conflict, never a premise for fresh assignments.
    const generationScene = { ...live.scene, sessions: live.scene.sessions.map(s => {
      const baseline = baselines.get(s.id)
      return fixedSlots.has(s.id) && baseline && !sameSessionTime(s, baseline) ? { ...s, active: false } : s
    }) }
    const generated = generatePanelAssignments(generationScene, document, input.mode)
    const validation = validatePanelDocument(generated.document, live.scene)
    validation.search = generated.validation.search; validation.warnings = generated.validation.warnings
    const values = { document: generated.document, validation, sourceFingerprint: live.fingerprint, modifiedBy: actorId }
    const row = old ? await tx.interviewPanelProposal.update({ where: { id: old.id }, data: { ...values, revision: { increment: 1 } } }) : await tx.interviewPanelProposal.create({ data: { clubId: input.clubId, roundId: input.roundId, createdBy: actorId, ...values } })
    await tx.auditLog.create({ data: { clubId: input.clubId, actorId, targetId: row.id, action: "interview.panel-proposal.generate", details: { mode: input.mode, revision: row.revision } } })
    return { roundId: input.roundId, roundName: live.roundName, timezone: live.timezone, scene: publicPanelScene(live.scene), proposal: proposalView(row, live.scene, live.fingerprint, validation), suggestedWindow: live.suggestedWindow, fingerprint: live.fingerprint }
  })
}
async function editPreview(raw: unknown, persist: boolean) {
  const input = editSchema.parse(raw)
  return previewTransaction(input.clubId, async (tx, actorId) => {
    const old = await savedProposal(tx, input)
    if (!old || old.id !== input.proposalId || old.revision !== input.revision) throw new Error(changed)
    const live = await loadPanelPlanningScene(tx, input, panelDocumentSchema.parse(old.document).window)
    const document = editDocument(old, input.assignments, live.scene), validation = validatePanelDocument(document, live.scene)
    let row = old
    if (persist) {
      row = await tx.interviewPanelProposal.update({ where: { id: old.id }, data: { document, validation, modifiedBy: actorId, revision: { increment: 1 } } })
      await tx.auditLog.create({ data: { clubId: input.clubId, actorId, targetId: row.id, action: "interview.panel-proposal.save", details: { revision: row.revision } } })
    }
    return { ...proposalView(row, live.scene, live.fingerprint, validation), document }
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
