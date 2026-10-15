import type { AppTransactionClient } from "@/utils/prisma"
import { loadPanelPlanningScene } from "@/utils/panel-planning"
import { validatePanelDocument, panelOptionsSchema, sameSessionTime, type PanelAssignment, type PanelSession } from "@/lib/panel-proposals"
/** One current staffing gate for publication, applicant reads and reservation confirmation. */
export async function interviewBookingCoverage(tx: AppTransactionClient, clubId: string, roundId: string, applicant?: { id: string; studentId: string }) {
  const live = await loadPanelPlanningScene(tx, { clubId, roundId })
  const slots = await tx.interviewSlot.findMany({ where: { clubId, room: { roundId, isOpen: true }, startTime: { gt: new Date() } }, include: { room: true, panelScheduleVersion: true } })
  const owners = await tx.clubMember.findMany({ where: { clubId, isOwner: true, status: "ACTIVE", user: { disabledAt: null } }, select: { userId: true } })
  const revocations = applicant ? await tx.interviewPanelAssignment.findMany({ where: { applicationId: applicant.id, roundId, bookingManaged: false, revokedAt: { not: null } } }) : []
  const assignments: PanelAssignment[] = []
  const approved = new Set<string>()
  for (const slot of slots) {
    const room = slot.room!, publisher = slot.panelScheduleVersion?.publishedBy ?? room.panelApprovedBy
    if (!publisher || !owners.some(o => o.userId === publisher)) continue
    const ids = slot.panelScheduleVersionId ? slot.publishedPanelMemberIds : room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id))
    const snapshot = slot.panelScheduleVersion?.document as { assignments?: PanelAssignment[]; sessions?: PanelSession[] } | undefined
    if (slot.panelScheduleVersionId && !snapshot?.sessions?.some(s => s.id === slot.id && sameSessionTime(s, { ...s, roomId: room.id, startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString(), buffer: room.buffer }) && s.required === (slot.interviewersNeeded ?? room.interviewersNeeded))) continue
    approved.add(slot.id)
    for (const memberId of ids) {
      const old = snapshot?.assignments?.find(a => a.slotId === slot.id && a.memberId === memberId)
      assignments.push({ slotId: slot.id, memberId, locked: false, source: "EXISTING", ...(old?.availabilityOverrideId ? { availabilityOverrideId: old.availabilityOverrideId } : {}) })
    }
  }
  const scene = { ...live.scene, members: live.scene.members.map(m => revocations.some(g => g.memberId === m.id) ? { ...m, evidenceAccess: false } : m) }
  // Self-review is never an authorized panel position for this applicant.
  if (applicant) {
    const self = await tx.clubMember.findMany({ where: { clubId, userId: applicant.studentId }, select: { id: true } })
    scene.members = scene.members.map(m => self.some(s => s.id === m.id) ? { ...m, evidenceAccess: false } : m)
  }
  const active = await tx.interviewPanelScheduleVersion.findFirst({ where: { clubId, roundId, status: "PUBLISHED" }, orderBy: { version: "desc" } })
  const parsedOptions = panelOptionsSchema.safeParse((active?.document as { options?: unknown } | undefined)?.options)
  const validation = validatePanelDocument({ version: 1, window: live.window ?? { start: new Date().toISOString(), end: new Date(Date.now() + 1).toISOString() }, options: parsedOptions.success ? parsedOptions.data : { maxConsecutiveMinutes: null, breakMinutes: 15 }, sessions: scene.sessions, assignments }, scene)
  return validation.sessions.filter(row => slots.some(s => s.id === row.slotId)).map(row => ({ slotId: row.slotId, bookable: approved.has(row.slotId) && row.unfilled === 0 && row.status === "FULLY_STAFFED", reasons: [
    ...(!approved.has(row.slotId) ? ["Panel approval is required."] : []),
    ...(row.unfilled ? [`${row.unfilled} unfilled interviewer position${row.unfilled === 1 ? "" : "s"}.`] : []),
    ...validation.issues.filter(i => i.slotId === row.slotId).map(i => i.message),
  ] }))
}
