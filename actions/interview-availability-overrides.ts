"use server"
import { z } from "zod"
import { requireAuth } from "@/utils/auth"
import { prisma } from "@/utils/prisma"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { interviewCapabilities } from "@/lib/interview-access"
import { panelPublicationLock, draftApprovalReset } from "@/utils/panel-publication"
import { loadPanelPlanningScene } from "@/utils/panel-planning"
import { availabilityOverrideConditions, canProposeMember, panelScopeSchema, panelDocumentSchema, validatePanelDocument, panelDraftScene } from "@/lib/panel-proposals"

export async function assignPanelAvailabilityOverride(raw: unknown) {
  const input = panelScopeSchema.extend({ proposalId: z.string().uuid(), revision: z.number().int().positive(), slotId: z.string().uuid(), memberId: z.string().uuid(), requestId: z.string().uuid(), replaceMemberId: z.string().uuid().optional(), reason: z.string().trim().max(1000).optional() }).strict().parse(raw)
  const { user } = await requireAuth({ verifyEmail: true })
  return prisma.$transaction(async tx => {
    await panelPublicationLock(tx)
    const actor = await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    if (!interviewCapabilities(actor).overrideAvailability) throw new Error("Only the club's currently authorized president can override availability.")
    const proposal = await tx.interviewPanelProposal.findFirst({ where: { id: input.proposalId, clubId: input.clubId, roundId: input.roundId } })
    if (!proposal) throw new Error("Reload the current panel draft.")
    const document = panelDocumentSchema.parse(proposal.document)
    const prior = await tx.interviewAvailabilityOverride.findUnique({ where: { id: input.requestId } })
    if (prior) {
      if (prior.createdBy !== user.id || prior.clubId !== input.clubId || prior.roundId !== input.roundId || prior.slotId !== input.slotId || prior.memberId !== input.memberId || prior.revokedAt || !document.assignments.some(a => a.availabilityOverrideId === prior.id)) throw new Error("This override request is no longer current. Reload the draft.")
      return { saved: true }
    }
    if (proposal.revision !== input.revision) throw new Error("The draft changed in another tab. Reload before assigning.")
    if (input.replaceMemberId) {
      const old = document.assignments.find(a => a.slotId === input.slotId && a.memberId === input.replaceMemberId)
      if (!old || old.locked) throw new Error("Choose an unlocked existing position to replace.")
      document.assignments = document.assignments.filter(a => a !== old)
    }
    const live = await loadPanelPlanningScene(tx, input, document.window), scene = panelDraftScene(document, live.scene)
    const session = scene.sessions.find(s => s.id === input.slotId)
    if (!session || !document.sessions.some(s => s.id === session.id)) throw new Error("Choose a current session in this draft.")
    const reasons = canProposeMember(scene, document.assignments, input.slotId, input.memberId, document.options)
    if (!reasons.length || reasons.some(r => !availabilityOverrideConditions.includes(r as typeof availabilityOverrideConditions[number])) || document.assignments.filter(a => a.slotId === session.id).length >= session.required) throw new Error("This assignment cannot be overridden. Check eligibility, access, staffing and official conflicts.")
    const room = await tx.interviewRoom.findUniqueOrThrow({ where: { id: session.roomId } })
    await tx.$queryRaw`SELECT set_config('outclass.override_actor',${user.id},true)`
    await tx.interviewAvailabilityOverride.create({ data: { id: input.requestId, clubId: input.clubId, roundId: input.roundId, slotId: session.id, memberId: input.memberId, createdBy: user.id, startTime: new Date(session.startTime), endTime: new Date(session.endTime), duration: room.duration, buffer: session.buffer, conditions: reasons, reason: input.reason || null } })
    const updated = { ...document, assignments: [...document.assignments, { slotId: session.id, memberId: input.memberId, source: "MANUAL" as const, locked: false, availabilityOverrideId: input.requestId }] }
    const current = await loadPanelPlanningScene(tx, input, document.window)
    const validation = validatePanelDocument(updated, panelDraftScene(updated, current.scene))
    if (validation.issues.some(i => i.slotId === session.id && i.memberId === input.memberId)) throw new Error("The session changed while confirming. Reload and review the assignment.")
    await tx.interviewPanelProposal.update({ where: { id: proposal.id }, data: { ...draftApprovalReset, document: updated, validation, sourceFingerprint: current.fingerprint, modifiedBy: user.id, revision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, action: "interview.availability.override", targetId: input.requestId, details: { memberId: input.memberId, slotId: session.id, roundId: input.roundId, conditions: reasons, reason: input.reason || null } } })
    return { saved: true }
  }, { isolationLevel: "ReadCommitted", timeout: 60000 })
}

export async function revokePanelAvailabilityOverride(raw: unknown) {
  const input = z.object({ clubId: z.string().uuid(), overrideId: z.string().uuid() }).strict().parse(raw)
  const { user } = await requireAuth({ verifyEmail: true })
  return prisma.$transaction(async tx => {
    await panelPublicationLock(tx)
    const actor = await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    if (!interviewCapabilities(actor).overrideAvailability) throw new Error("Only the club's currently authorized president can remove availability overrides.")
    const row = await tx.interviewAvailabilityOverride.findFirst({ where: { id: input.overrideId, clubId: input.clubId } })
    if (!row) throw new Error("Override unavailable.")
    if (row.revokedAt) return { revoked: true }
    await tx.$queryRaw`SELECT set_config('outclass.override_actor',${user.id},true)`
    await tx.interviewAvailabilityOverride.update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: row.id, action: "interview.availability.override.revoke" } })
    return { revoked: true }
  })
}
