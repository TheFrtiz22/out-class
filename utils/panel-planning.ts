import { SCHEDULING_TIMEZONE } from "@/lib/scheduling-config"
import { createHash } from "node:crypto"
import type { AppTransactionClient } from "@/utils/prisma"
import { intervalAvailability, localParts } from "@/lib/availability"
import { sessionsOverlap, MAX_PANEL_SESSIONS, type PanelBusyInterval, type PanelMember, type PanelScene, type PanelSession } from "@/lib/panel-proposals"
import { loadInterviewerPool } from "@/utils/interviewer-pool"
import { validAvailabilityOverrides } from "@/utils/interview-availability-overrides"

type Scope = { clubId: string; roundId: string }
export async function planningRound(tx: AppTransactionClient, scope: Scope) {
  const round = await tx.pipelineRound.findFirst({ where: { id: scope.roundId, clubId: scope.clubId, archivedAt: null }, include: { _count: { select: { interviewRooms: true } } } })
  if (!round || !(round.type === "INTERVIEW" || /interview/i.test(round.name) || round._count.interviewRooms)) throw new Error("Choose an active interview round from this club.")
  return round
}

/** Batch all sources once, then resolve every interval in memory. */
export async function loadPanelPlanningScene(tx: AppTransactionClient, scope: Scope, window?: { start: string; end: string }) {
  const round = await planningRound(tx, scope)
  const [rooms, pool, overrides] = await Promise.all([
    tx.interviewRoom.findMany({ where: { clubId: scope.clubId, roundId: scope.roundId }, include: { slots: { orderBy: { startTime: "asc" } } }, orderBy: { createdAt: "asc" } }),
    loadInterviewerPool(tx, scope.clubId, scope.roundId),
    validAvailabilityOverrides(tx, scope.clubId, scope.roundId),
  ])
  const now = Date.now()
  const future = rooms.filter(r => r.isOpen).flatMap(r => r.slots.filter(s => +s.startTime > now))
  const suggestedWindow = future.length ? {
    start: new Date(Math.min(...future.map(s => +s.startTime))).toISOString(),
    end: new Date(Math.max(...future.map(s => +s.endTime))).toISOString(),
  } : null
  const selected = window ?? suggestedWindow
  const slots = rooms.flatMap(r => r.slots.filter(s => selected && +s.startTime >= +new Date(selected.start) && +s.startTime < +new Date(selected.end)).map(s => ({ room: r, slot: s })))
  if (slots.length > MAX_PANEL_SESSIONS) throw new Error(`Choose a smaller window with at most ${MAX_PANEL_SESSIONS} sessions. No sessions were silently omitted.`)
  const sessions: PanelSession[] = slots.map(({ room, slot }) => ({
    id: slot.id, roomId: room.id, roomName: room.name, timezone: room.timezone,
    startTime: slot.startTime.toISOString(), endTime: slot.endTime.toISOString(), buffer: room.buffer,
    required: slot.interviewersNeeded ?? room.interviewersNeeded ?? 2,
    active: room.isOpen && +slot.startTime > now, roomRevision: room.staffingRevision, slotRevision: slot.staffingRevision,
    existingMemberIds: slot.panelScheduleVersionId ? slot.publishedPanelMemberIds : room.panelApprovedBy ? room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id)) : [],
  }))
  const replacementIds = new Set(sessions.filter(s => s.active).map(s => s.id))
  const userIds = [...new Set(pool.members.filter(m => m.eligible).map(m => m.userId))]
  const committed = new Map(userIds.map(userId => [userId, new Map<string, PanelBusyInterval>()]))
  const earliest = selected ? +new Date(selected.start) - 10 * 3600000 : now
  const latest = selected ? +new Date(selected.end) + 10 * 3600000 : now
  const interval = { startTime: { lt: new Date(latest) }, endTime: { gt: new Date(earliest) } }
  function add(userId: string, startTime: Date, endTime: Date, buffer: number) {
    const rows = committed.get(userId); if (!rows) return
    const key = `${startTime.toISOString()}:${endTime.toISOString()}`, old = rows.get(key)
    rows.set(key, { startTime: startTime.toISOString(), endTime: endTime.toISOString(), buffer: Math.max(buffer, old?.buffer ?? 0) })
  }
  if (userIds.length && selected) {
    const memberships = await tx.clubMember.findMany({ where: { userId: { in: userIds } }, select: { id: true, userId: true } })
    const byMembership = new Map(memberships.map(m => [m.id, m.userId]))
    const [approvedSlots, grants, applicantBookings] = await Promise.all([
      tx.interviewSlot.findMany({ where: { ...interval, room: { isOpen: true }, OR: [{ panelScheduleVersionId: { not: null }, publishedPanelMemberIds: { hasSome: memberships.map(m => m.id) } }, { panelScheduleVersionId: null, room: { panelApprovedBy: { not: null }, approvedPanelMemberIds: { hasSome: memberships.map(m => m.id) } } }] }, include: { room: true } }),
      tx.interviewPanelAssignment.findMany({ where: { revokedAt: null, member: { userId: { in: userIds } }, application: { bookings: { some: { slot: interval } } } }, include: {
        member: { select: { userId: true } }, application: { select: { bookings: { where: { slot: interval }, include: { slot: { include: { room: true } } } } } },
      } }),
      tx.interviewBooking.findMany({ where: { application: { studentId: { in: userIds } }, slot: interval }, include: { application: { select: { studentId: true } }, slot: { include: { room: true } } } }),
    ])
    for (const slot of approvedSlots) {
      const room = slot.room!
      if (room.clubId === scope.clubId && room.roundId === scope.roundId && replacementIds.has(slot.id)) continue
      for (const memberId of slot.panelScheduleVersionId ? slot.publishedPanelMemberIds : room.approvedPanelMemberIds.filter(id => room.panelMemberIds.includes(id))) {
        const userId = byMembership.get(memberId); if (userId) add(userId, slot.startTime, slot.endTime, room.buffer)
      }
    }
    for (const grant of grants) for (const booking of grant.application.bookings) {
      if (booking.roundId !== grant.roundId) continue
      const slot = booking.slot
      if (slot.panelScheduleVersionId && !slot.publishedPanelMemberIds.includes(grant.memberId)) continue
      if (grant.roundId === scope.roundId && slot.clubId === scope.clubId && replacementIds.has(slot.id)) {
        const session = sessions.find(s => s.id === slot.id)
        if (session && !session.existingMemberIds.includes(grant.memberId)) session.existingMemberIds.push(grant.memberId)
        continue
      }
      add(grant.member.userId, slot.startTime, slot.endTime, slot.room?.buffer ?? 0)
    }
    // A user's own applicant booking is always busy, even in a session being restaffed.
    for (const booking of applicantBookings) add(booking.application.studentId, booking.slot.startTime, booking.slot.endTime, booking.slot.room?.buffer ?? 0)
  }
  const partsCache = new Map<string, ReturnType<typeof localParts>>()
  const parts = (time: number | Date, zone: string) => { const key = `${zone}:${+time}`; let value = partsCache.get(key); if (!value) { value = localParts(time, zone); partsCache.set(key, value) } return value }
  const members: PanelMember[] = pool.members.map(m => {
    const commitments = [...(committed.get(m.userId)?.values() ?? [])], allowedSlotIds: string[] = [], blocks: Record<string, string[]> = {}
    if (m.eligible && m.evidenceAccess) for (const s of sessions) {
      const reasons: string[] = [], availability = intervalAvailability(m.availability, +new Date(s.startTime), +new Date(s.endTime) + s.buffer * 60000, parts)
      if (availability !== "available") reasons.push(availability === "unknown" ? "UNKNOWN_AVAILABILITY" : "UNAVAILABLE")
      if (commitments.some(c => sessionsOverlap(c, s))) reasons.push("OFFICIAL_COMMITMENT")
      if (reasons.length) blocks[s.id] = reasons; else allowedSlotIds.push(s.id)
    }
    return { id: m.id, name: m.name, role: m.role, eligible: m.eligible, confirmed: m.confirmed, evidenceAccess: m.evidenceAccess, commitments,
      availabilityOverrides: overrides.filter(o => o.memberId === m.id).map(o => ({ id: o.id, slotId: o.slotId, conditions: o.conditions })),
      baselineWorkloadMinutes: commitments.reduce((n, c) => n + (+new Date(c.endTime) - +new Date(c.startTime)) / 60000 + c.buffer, 0), allowedSlotIds, blocks }
  })
  const scene: PanelScene = { sessions, members }
  const source = { round: { id: round.id, archivedAt: round.archivedAt, type: round.type, anonymousReview: round.anonymousReview, configuration: round.configuration, panelScheduleRevision: round.panelScheduleRevision }, roles: pool.club,
    rooms: rooms.map(r => ({ id:r.id,name:r.name,location:r.location,kind:r.kind,timezone:r.timezone,duration:r.duration,buffer:r.buffer,isOpen:r.isOpen,panelApprovalRevision:r.panelApprovalRevision,panelApprovedBy:r.panelApprovedBy,panelMemberIds:r.panelMemberIds,approvedPanelMemberIds:r.approvedPanelMemberIds,slots:r.slots.map(s=>({id:s.id,capacity:s.capacity,panelScheduleVersionId:s.panelScheduleVersionId,publishedPanelMemberIds:s.publishedPanelMemberIds})) })),
    sessions, overrides, candidates: pool.members, commitments: [...committed].map(([userId, rows]) => ({ userId, rows: [...rows.values()].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)) })) }
  const fingerprint = createHash("sha256").update(JSON.stringify(source)).digest("hex")
  return { scene, fingerprint, publishedRevision: round.panelScheduleRevision, roundName: round.name, suggestedWindow, timezone: SCHEDULING_TIMEZONE, window: selected }
}

/** Strip all foreign-club intervals and workloads at the identifiable admin boundary. */
export function publicPanelScene(scene: PanelScene): PanelScene {
  return { sessions: scene.sessions, members: scene.members.map(({ commitments: _commitments, baselineWorkloadMinutes: _workload, ...member }) => member) }
}
