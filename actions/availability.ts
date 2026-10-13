"use server"

import { z } from "zod"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { organizationRoles } from "@/lib/organization-authorization"
import { sessionsOverlap, panelWindowSchema } from "@/lib/panel-proposals"
import { loadPanelPlanningScene } from "@/utils/panel-planning"
import { loadInterviewerPool } from "@/utils/interviewer-pool"
import { availabilityResponse, availabilityHref, addDays, availabilitySaveSchema, emptySchedule, interviewerEligible, intervalAvailability, localDateSchema, localParts, monday, parseSchedule, timezoneSchema, weekCells, type AvailabilityDocument, type AvailabilityOverview, type AvailabilityRound, type AvailabilitySchedule } from "@/lib/availability"

const id = z.string().uuid()
const scopeSchema = z.object({ clubId: id, roundId: id }).strict()
const changed = "Availability changed in another tab. Reload before saving again."
async function accountLock(tx: AppTransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`
  const user = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } })
  if (!user || user.disabledAt) throw new Error("Account unavailable.")
}
async function roundFor(tx: AppTransactionClient, clubId: string, roundId: string) {
  const round = await tx.pipelineRound.findFirst({ where: { id: roundId, clubId, archivedAt: null }, include: { _count: { select: { interviewRooms: true } } } })
  if (!round || !(round.type === "INTERVIEW" || /interview/i.test(round.name) || round._count.interviewRooms)) throw new Error("Choose an active interview round from this club.")
  return round
}
function document(value: { schedule: unknown; revision: number } | null, accountId: string): AvailabilityDocument {
  return value ? { accountId, schedule: parseSchedule(value.schedule), revision: value.revision } : { accountId, schedule: emptySchedule(), revision: 0 }
}
export async function getMyAvailability(): Promise<{ document: AvailabilityDocument; rounds: AvailabilityRound[] }> {
  const { user } = await requireAuth()
  const [saved, memberships] = await Promise.all([
    prisma.userAvailability.findUnique({ where: { userId: user.id } }),
    prisma.clubMember.findMany({ where: { userId: user.id, status: "ACTIVE", club: { suspendedAt: null } }, include: {
      club: { select: { name: true, interviewerRoles: true, pipelineRounds: { where: { archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true, type: true, _count: { select: { interviewRooms: true } } } } } },
      interviewParticipation: { select: { roundId: true, eligibilityOverride: true, confirmedAt: true, requestedAt: true, declinedAt: true } },
    } }),
  ])
  const rounds = memberships.flatMap(member => member.club.pipelineRounds.flatMap(round => {
    const participation = member.interviewParticipation.find(p => p.roundId === round.id)
    return (round.type === "INTERVIEW" || /interview/i.test(round.name) || round._count.interviewRooms) && interviewerEligible(member, member.club.interviewerRoles, participation?.eligibilityOverride)
      ? [{ id: round.id, clubId: member.clubId, clubName: member.club.name, name: round.name, confirmed: !!participation?.confirmedAt, response: availabilityResponse(participation), requested: !!participation?.requestedAt }] : []
  }))
  return { document: document(saved, user.id), rounds }
}
export async function saveMyAvailability(raw: unknown): Promise<AvailabilityDocument> {
  const input = availabilitySaveSchema.parse(raw), { user } = await requireAuth()
  if (input.accountId && input.accountId !== user.id) throw new Error("Account changed. Reload your availability before saving.")
  return prisma.$transaction(async tx => {
    await accountLock(tx, user.id)
    const old = await tx.userAvailability.findUnique({ where: { userId: user.id } })
    if ((old?.revision ?? 0) !== input.revision) throw new Error(changed)
    const saved = await tx.userAvailability.upsert({ where: { userId: user.id }, create: { userId: user.id, schedule: input.schedule }, update: { schedule: input.schedule, revision: { increment: 1 } } })
    return document(saved, user.id)
  })
}
export async function getMyRoundAvailability(raw: unknown) {
  const scope = scopeSchema.parse(raw), { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, scope.clubId, user.id, [], { readOnly: true })
    const round = await roundFor(tx, scope.clubId, scope.roundId)
    const club = await tx.club.findUniqueOrThrow({ where: { id: scope.clubId }, select: { name: true, interviewerRoles: true } })
    const participation = await tx.interviewRoundParticipation.findUnique({ where: { memberId_roundId: { memberId: member.id, roundId: round.id } } })
    if (!interviewerEligible(member, club.interviewerRoles, participation?.eligibilityOverride)) throw new Error("You are not eligible for this interview round.")
    const global = document(await tx.userAvailability.findUnique({ where: { userId: user.id } }), user.id)
    const firstSlot = await tx.interviewSlot.findFirst({ where: { clubId: scope.clubId, room: { roundId: round.id }, startTime: { gt: new Date() } }, orderBy: { startTime: "asc" }, select: { startTime: true } })
    return { preferredWeek: firstSlot ? monday(localParts(firstSlot.startTime, participation?.availability ? parseSchedule(participation.availability).timezone : global.schedule.timezone).date) : undefined, document: { accountId: user.id, schedule: participation?.availability ? parseSchedule(participation.availability) : global.schedule, revision: participation?.revision ?? 0 }, global: global.schedule, confirmed: !!participation?.confirmedAt, declined: !!participation?.declinedAt, name: `${club.name} · ${round.name}` }
  })
}
export async function saveMyRoundAvailability(raw: unknown) {
  const input = availabilitySaveSchema.extend({ clubId: id, roundId: id, confirm: z.boolean() }).parse(raw), { user } = await requireAuth()
  if (input.accountId && input.accountId !== user.id) throw new Error("Account changed. Reload your availability before saving.")
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, input.clubId, user.id, [])
    const round = await roundFor(tx, input.clubId, input.roundId)
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { interviewerRoles: true } })
    const key = { memberId: member.id, roundId: round.id }
    const old = await tx.interviewRoundParticipation.findUnique({ where: { memberId_roundId: key } })
    if (!interviewerEligible(member, club.interviewerRoles, old?.eligibilityOverride)) throw new Error("You are not eligible for this interview round.")
    if ((old?.revision ?? 0) !== input.revision) throw new Error(changed)
    if (input.confirm && !input.schedule.weeklySubmitted && !Object.keys(input.schedule.exceptions).length) throw new Error("Submit your availability before confirming participation. You can explicitly save an empty week.")
    const confirmedAt = input.confirm ? new Date() : null
    const saved = await tx.interviewRoundParticipation.upsert({ where: { memberId_roundId: key }, create: { ...key, clubId: input.clubId, availability: input.schedule, confirmedAt, declinedAt: null }, update: { availability: input.schedule, confirmedAt, declinedAt: null, revision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: saved.id, action: input.confirm ? "interview.participation.confirm" : "interview.participation.save" } })
    return { document: { accountId: user.id, schedule: parseSchedule(saved.availability), revision: saved.revision }, confirmed: !!saved.confirmedAt }
  })
}
export async function getInterviewerEligibility(clubId: string) {
  id.parse(clubId); const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, clubId, user.id, ["members.manage"], { readOnly: true })
    const [club, members, rounds] = await Promise.all([
      tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { interviewerRoles: true, interviewerEligibilityRevision: true } }),
      tx.clubMember.findMany({ where: { clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, accessRole: true, interviewerEligible: true, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } }, interviewParticipation: { select: { roundId: true, eligibilityOverride: true, confirmedAt: true } } } }),
      tx.pipelineRound.findMany({ where: { clubId, archivedAt: null }, select: { id: true, name: true, type: true, _count: { select: { interviewRooms: true } } }, orderBy: { order: "asc" } }),
    ])
    return { roles: club.interviewerRoles, revision: club.interviewerEligibilityRevision, members: members.map(m => ({ id: m.id, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email, role: m.accessRole, override: m.interviewerEligible, rounds: m.interviewParticipation.map(p => ({ id: p.roundId, override: p.eligibilityOverride, confirmed: !!p.confirmedAt })) })), rounds: rounds.filter(r => r.type === "INTERVIEW" || /interview/i.test(r.name) || r._count.interviewRooms).map(r => ({ id: r.id, name: r.name })) }
  })
}
/** One atomic bulk operation. Scheduling eligibility never changes permissions. */
export async function setInterviewerEligibility(raw: unknown) {
  const input = z.object({ clubId: id, revision: z.number().int().nonnegative(), roles: z.array(z.enum(organizationRoles)).max(5).optional(), roundId: id.optional(), targets: z.array(z.object({ memberId: id, eligible: z.boolean().nullable() }).strict()).max(1000).default([]) }).strict().parse(raw)
  if (new Set(input.targets.map(t => t.memberId)).size !== input.targets.length || (input.roundId && input.roles)) throw new Error("Choose unique members and one eligibility scope.")
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["members.manage"])
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId } })
    if (club.interviewerEligibilityRevision !== input.revision) throw new Error("Eligibility changed. Reload members before saving.")
    if (input.roundId) await roundFor(tx, input.clubId, input.roundId)
    const targets = await tx.clubMember.findMany({ where: { id: { in: input.targets.map(t => t.memberId) }, clubId: input.clubId, status: "ACTIVE", user: { disabledAt: null } } })
    if (targets.length !== input.targets.length) throw new Error("Select active members of this club.")
    for (const target of input.targets) {
      if (input.roundId) {
        const key = { memberId: target.memberId, roundId: input.roundId }
        await tx.interviewRoundParticipation.upsert({ where: { memberId_roundId: key }, create: { ...key, clubId: input.clubId, eligibilityOverride: target.eligible }, update: { eligibilityOverride: target.eligible, confirmedAt: null, revision: { increment: 1 } } })
      } else {
        await tx.clubMember.update({ where: { id: target.memberId }, data: { interviewerEligible: target.eligible } })
        // Eligibility changes require fresh attestation, without touching live assignments.
        await tx.interviewRoundParticipation.updateMany({ where: { memberId: target.memberId, clubId: input.clubId }, data: { confirmedAt: null, revision: { increment: 1 } } })
      }
    }
    if (input.roles) {
      await tx.interviewRoundParticipation.updateMany({ where: { clubId: input.clubId, member: { interviewerEligible: null } }, data: { confirmedAt: null, revision: { increment: 1 } } })
    }
    await tx.club.update({ where: { id: input.clubId }, data: { ...(input.roles ? { interviewerRoles: [...new Set(input.roles)] } : {}), interviewerEligibilityRevision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, action: "interview.eligibility.change", targetId: input.roundId ?? input.clubId, details: { roles: input.roles, roundId: input.roundId, targets: input.targets } } })
    return { revision: club.interviewerEligibilityRevision + 1 }
  }, { timeout: 15000 })
}
const overviewSchema = z.object({ clubId: id, week: localDateSchema, timezone: timezoneSchema, roundId: id.optional(), role: z.enum(organizationRoles).optional() }).strict()
/** Club-scoped projection. Raw schedules/snapshots never leave this admin boundary. */
export async function getAvailabilityOverview(raw: unknown): Promise<AvailabilityOverview> {
  const input = overviewSchema.parse(raw), { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"], { readOnly: true })
    if (input.roundId) await roundFor(tx, input.clubId, input.roundId)
    const [club, members, planning] = await Promise.all([
      tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { interviewerRoles: true } }),
      tx.clubMember.findMany({ where: { clubId: input.clubId, status: "ACTIVE", user: { disabledAt: null }, ...(input.role ? { accessRole: input.role } : {}) }, include: { user: { select: { email: true, disabledAt: true, studentProfile: { select: { firstName: true, lastName: true } }, availability: true } }, interviewParticipation: { where: { clubId: input.clubId, roundId: input.roundId ?? "" } } } }),
      input.roundId ? loadPanelPlanningScene(tx, { clubId: input.clubId, roundId: input.roundId }, { start: new Date(+new Date(`${monday(input.week)}T00:00:00Z`) - 86400000).toISOString(), end: new Date(+new Date(`${addDays(monday(input.week), 7)}T00:00:00Z`) + 86400000).toISOString() }) : null,
    ])
    const week = monday(input.week), cells = weekCells(week, input.timezone)
    const cache = new Map<string, ReturnType<typeof localParts>>()
    const parts = (time: number | Date, zone: string) => { const key = `${zone}:${+time}`; let p = cache.get(key); if (!p) { p = localParts(time, zone); cache.set(key, p) } return p }
    const eligible = members.filter(m => interviewerEligible(m, club.interviewerRoles, m.interviewParticipation[0]?.eligibilityOverride))
    const schedules = new Map<string, AvailabilitySchedule | null>()
    const candidates = new Map(planning?.scene.members.map(member => [member.id, member]) ?? [])
    const projected = eligible.map(m => {
      const participation = m.interviewParticipation[0], candidate = candidates.get(m.id)
      const raw = input.roundId ? participation?.availability : m.user.availability?.schedule
      const schedule = raw ? parseSchedule(raw) : null
      const confirmed = !!participation?.confirmedAt
      const submitted = !!schedule && (schedule.weeklySubmitted || Object.keys(schedule.exceptions).length > 0)
      schedules.set(m.id, input.roundId && !confirmed ? null : schedule)
      const available = cells.map(day => day.map(cell => {
        const start = cell.start, end = cell.end
        if (start === null || end === null) return false
        if (planning && (!candidate?.evidenceAccess || candidate.commitments?.some(commitment => sessionsOverlap(commitment, { startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString(), buffer: 0 })))) return false
        return intervalAvailability(schedules.get(m.id) ?? null, start, end, parts) === "available"
      }))
      return { id: m.id, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email, role: m.accessRole, submitted, confirmed, response: availabilityResponse(participation), canRemind: !!participation?.requestedAt && !participation.confirmedAt && !participation.declinedAt && Date.now() - +(participation.lastReminderAt ?? participation.requestedAt) >= 86400000, available }
    })
    // Without a round, slot staffing is deliberately omitted: global declarations aren't round confirmations.
    const coverage = planning ? planning.scene.sessions.filter(s => { const date = parts(+new Date(s.startTime), input.timezone).date; return date >= week && date < addDays(week, 7) }).map(s => ({ id: s.id, roomId: s.roomId, roomName: s.roomName, startTime: s.startTime, endTime: s.endTime, buffer: s.buffer, required: s.required, assigned: s.existingMemberIds.length, active: s.active, availableMemberIds: planning.scene.members.filter(m => m.allowedSlotIds.includes(s.id) && eligible.some(e => e.id === m.id)).map(m => m.id) })) : []
    return { week, timezone: input.timezone, members: projected, cells, slots: coverage }
  }, { timeout: 20000 })
}
/** Read-only input for a future panel proposal; never assigns or publishes. */
export async function getEligibleInterviewerPool(raw: unknown) {
  const input = scopeSchema.extend({ start: z.string().datetime(), end: z.string().datetime() }).parse(raw), { user } = await requireAuth()
  const start = +new Date(input.start), end = +new Date(input.end)
  if (end <= start || end - start > 7 * 86400000) throw new Error("Choose a session of up to seven days.")
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"], { readOnly: true })
    await roundFor(tx, input.clubId, input.roundId)
    const pool = await loadInterviewerPool(tx, input.clubId, input.roundId)
    return pool.members.filter(m => m.eligible && m.confirmed && intervalAvailability(m.availability, start, end) === "available").map(m => ({ memberId: m.id, evidenceAccess: m.evidenceAccess }))
  }, { timeout: 15000 })
}

/** Collection changes never write proposals, official panels or applicant bookings. */
export async function requestRoundAvailability(raw: unknown) {
  const input = scopeSchema.extend({ memberIds: z.array(id).min(1).max(1000), reminder: z.boolean().default(false) }).parse(raw)
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const round = await roundFor(tx, input.clubId, input.roundId)
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { name: true } })
    const pool = await loadInterviewerPool(tx, input.clubId, input.roundId)
    const targets = pool.members.filter(m => input.memberIds.includes(m.id))
    if (new Set(input.memberIds).size !== input.memberIds.length || targets.length !== input.memberIds.length || targets.some(m => !m.eligible)) throw new Error("Select eligible active interviewers from this club and round.")
    let sent = 0
    const now = new Date()
    for (const member of targets) {
      const key = { memberId: member.id, roundId: input.roundId }
      const old = await tx.interviewRoundParticipation.findUnique({ where: { memberId_roundId: key } })
      if (old?.confirmedAt || old?.declinedAt) continue
      if (input.reminder ? !old?.requestedAt || +now - +(old.lastReminderAt ?? old.requestedAt) < 86400000 : !!old?.requestedAt) continue
      const sequence = input.reminder ? (old?.reminderSequence ?? 0) + 1 : 0
      const saved = await tx.interviewRoundParticipation.upsert({ where: { memberId_roundId: key }, create: { ...key, clubId: input.clubId, requestedAt: now }, update: { ...(input.reminder ? { lastReminderAt: now, reminderSequence: sequence } : { requestedAt: now }), revision: { increment: 1 } } })
      await tx.userNotification.create({ data: { userId: member.userId, clubId: input.clubId, type: "INTERVIEW", eventKey: `availability-request:${saved.id}:${sequence}`, title: `${input.reminder ? "Reminder: " : ""}Availability requested · ${club.name}`, body: `Submit availability or decline participation for ${round.name}. Your global schedule will be prefilled.`, href: availabilityHref(input.clubId, input.roundId) } })
      sent++
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: input.roundId, action: input.reminder ? "interview.availability.remind" : "interview.availability.request", details: { sent } } })
    return { sent }
  }, { timeout: 20000 })
}

export async function declineRoundParticipation(raw: unknown) {
  const input = scopeSchema.extend({ revision: z.number().int().nonnegative(), accountId: id }).parse(raw), { user } = await requireAuth()
  if (input.accountId !== user.id) throw new Error("Account changed. Reload before responding.")
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, input.clubId, user.id, [])
    await roundFor(tx, input.clubId, input.roundId)
    const club = await tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { interviewerRoles: true } })
    const key = { memberId: member.id, roundId: input.roundId }
    const old = await tx.interviewRoundParticipation.findUnique({ where: { memberId_roundId: key } })
    if (!interviewerEligible(member, club.interviewerRoles, old?.eligibilityOverride)) throw new Error("You are not eligible for this interview round.")
    if ((old?.revision ?? 0) !== input.revision) throw new Error(changed)
    const saved = await tx.interviewRoundParticipation.upsert({ where: { memberId_roundId: key }, create: { ...key, clubId: input.clubId, declinedAt: new Date() }, update: { declinedAt: new Date(), confirmedAt: null, revision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: saved.id, action: "interview.participation.decline" } })
    return { revision: saved.revision }
  })
}

/** Round-wide coverage for inline room/session staffing; never one query per row. */
export async function getRoundStaffingCoverage(raw: unknown) {
  const scope = scopeSchema.extend({ window: panelWindowSchema.optional() }).parse(raw), { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    const actor = await authorizeClubTransaction(tx, scope.clubId, user.id, ["interviews.manage"], { readOnly: true })
    const planning = await loadPanelPlanningScene(tx, scope, scope.window)
    const proposal = await tx.interviewPanelProposal.findUnique({ where: { roundId_clubId: { roundId: scope.roundId, clubId: scope.clubId } }, select: { status: true } })
    return {
      myEligible: !!planning.scene.members.find(m => m.id === actor.id)?.eligible,
      eligible: planning.scene.members.filter(m => m.eligible).length,
      confirmed: planning.scene.members.filter(m => m.eligible && m.confirmed).length,
      state: planning.publishedRevision > 0 || planning.scene.sessions.some(s => s.existingMemberIds.length) ? proposal ? "Published · saved draft" : "Published" : proposal ? "Saved unpublished draft" : "No panel draft",
      slots: planning.scene.sessions.map(s => ({ id: s.id, roomId: s.roomId, roomName: s.roomName, startTime: s.startTime, endTime: s.endTime, buffer: s.buffer, active: s.active, required: s.required, assigned: s.existingMemberIds.length, availableMemberIds: planning.scene.members.filter(m => m.allowedSlotIds.includes(s.id)).map(m => m.id) })),
    }
  }, { timeout: 20000 })
}
