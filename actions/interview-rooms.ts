"use server"

import { lockSchedulingPeople } from "@/utils/panel-publication"
import { isWriteContention, logContentionExhausted, retryTransactionConflict, TransactionConflictError } from "@/utils/club-write-transaction"
import { assertOfficialPanelConflicts } from "@/utils/official-panel-conflicts"
import { lockOperationalClub, assertClubOperational } from "@/lib/club-suspension";
import type { AppTransactionClient } from "@/utils/prisma";
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth, requireClubPermission } from "@/utils/auth"
import { hasPermission } from "@/lib/permissions"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { roomInputSchema, roomRenameSchema, roomExternalBookingSchema, roomSlots, overlaps, isPublishedBookingSlot, type RoomInput, type InterviewRoom, type RoomWorkspace, type ApplicantSchedule } from "@/lib/interview-rooms";
import { revalidatePath } from "next/cache"


import { syncBookingPanel } from "@/utils/interview-scheduling-access"
import { notifyInterviewBookingChange } from "@/utils/interview-assignment-notifications"
import { interviewBookingCoverage } from "@/utils/interview-booking"
import { boundedParse } from "@/lib/bounded-input"
import { ActionError, actionResult } from "@/lib/action-result";

const uuid = z.string().uuid()
const roomInclude = { slots: { include: { _count: { select: { bookings: true } } }, orderBy: { startTime: "asc" as const } } }
type StoredRoom = Prisma.InterviewRoomGetPayload<{ include: typeof roomInclude }>
function presentRoom(room: StoredRoom, applicant = false): InterviewRoom {
  return { id: room.id, clubId: room.clubId, roundId: room.roundId, name: room.name, location: room.location, kind: room.kind, timezone: room.timezone, duration: room.duration, buffer: room.buffer, isOpen: room.isOpen, panelMemberIds: applicant ? [] : room.panelMemberIds,
    ...(!applicant ? { externallyBookedAt: room.externallyBookedAt?.toISOString() ?? null, interviewersNeeded: room.interviewersNeeded, staffingRevision: room.staffingRevision, approvedPanelMemberIds: room.approvedPanelMemberIds } : {}),
    slots: room.slots.filter(s => !applicant || +s.startTime > Date.now() && (!s.panelScheduleVersionId || s.publishedPanelMemberIds.length>0)).map(s => ({ id: s.id, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(), capacity: s.capacity, booked: s._count.bookings, ...(!applicant ? { interviewersNeeded: s.interviewersNeeded, staffingRevision: s.staffingRevision, publishedPanelMemberIds:s.publishedPanelMemberIds,panelScheduleVersionId:s.panelScheduleVersionId } : {}) })) }
}
async function atomic<T>(fn: (tx: AppTransactionClient) => Promise<T>, freshReads=false): Promise<T> {
  try {
    // A deadlock (e.g. with a manual panel grant locking the same people in another order)
    // or a serialization failure rolls the whole transaction back; it is re-run from the start.
    return await retryTransactionConflict(() => prisma.$transaction(async tx => {
      // Fail fast under a burst instead of holding a pooled connection for a minute.
      await tx.$queryRaw`SELECT set_config('lock_timeout', '8000', true)`
      return fn(tx)
    }, { isolationLevel: freshReads?Prisma.TransactionIsolationLevel.ReadCommitted:Prisma.TransactionIsolationLevel.Serializable, timeout: 20000, maxWait: 10000 }))
  }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : ""
    if (error instanceof TransactionConflictError) logContentionExhausted("interview.rooms", error)
    if (error instanceof TransactionConflictError || code === "P2002") throw new ActionError("The schedule changed while saving. Reload the page and try again.")
    if (isWriteContention(error)) {
      logContentionExhausted("interview.rooms", error, "timeout")
      throw new ActionError("Many people are scheduling right now. Your current reservation is unchanged. Please try again.")
    }
    throw error
  }
}
export async function getRoomWorkspace(clubId: string): Promise<RoomWorkspace> {
  uuid.parse(clubId)
  const { membership } = await requireClubPermission(clubId, ["interviews.manage"])
  const [club, rounds, members, rooms, bookings, cycles] = await Promise.all([
    prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } }),
    prisma.pipelineRound.findMany({ where: { clubId, archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true, configuration: true, type: true, bookingPublishedAt: true, bookingPaused: true, bookingRevision: true, bookingCycleId: true, bookingAllowCancellation: true, bookingAllowRescheduling: true } }),
    prisma.clubMember.findMany({ where: { clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } } } }),
    prisma.interviewRoom.findMany({ where: { clubId }, include: roomInclude, orderBy: { createdAt: "desc" } }),
    prisma.interviewBooking.findMany({ where: { slot: { clubId, roomId: { not: null } } }, include: { slot: true, round: { select: { anonymousReview: true } }, application: { select: { round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } } }),
    prisma.recruitmentCycle.findMany({ where: { clubId, archivedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ])
  return { clubName: club.name, cycles, rounds: rounds.map(r=>({id:r.id,name:r.name,type:r.type,configuration:r.configuration,booking:{...r,bookingPublishedAt:r.bookingPublishedAt?.toISOString()??null}})), members: members.map(m => ({ id: m.id, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email })), rooms: rooms.map(r => presentRoom(r)), bookings: bookings.map(b => ({ id: b.id, slotId: b.slotId, roomId: b.slot.roomId!, roundId: b.roundId!, applicationId: b.applicationId, candidate: hasPermission(membership, "applicants.identify") && b.round?.anonymousReview === false && b.application.round.anonymousReview === false && b.application.student.studentProfile ? `${b.application.student.studentProfile.firstName} ${b.application.student.studentProfile.lastName}` : `Applicant ${b.applicationId.slice(-6)}`, startTime: b.slot.startTime.toISOString(), endTime: b.slot.endTime.toISOString(), location: b.slot.location })) }
}
async function createInterviewRoomCommand(raw: RoomInput) {
  const input = boundedParse(roomInputSchema, raw)
  const { user } = await requireClubPermission(input.clubId, ["interviews.manage"])
  const slots = roomSlots(input)
  const result = await atomic(async tx => {
    // Serialize competing room creation and overlap checks within this club.
    await lockOperationalClub(tx, input.clubId)
    const round = await tx.pipelineRound.findFirst({ where: { id: input.roundId, clubId: input.clubId, archivedAt: null } })
    if (!round) throw new ActionError("Choose a recruitment round from this club.")
    const panelIds = [...new Set(input.panelMemberIds)]
    if (await tx.clubMember.count({ where: { id: { in: panelIds }, clubId: input.clubId, status: "ACTIVE", user: { disabledAt: null } } }) !== panelIds.length) throw new ActionError("Choose interviewers who belong to this club.")
    const existing = await tx.interviewSlot.findMany({ where: { clubId: input.clubId, startTime: { lt: new Date(+slots[slots.length - 1].endTime + 3600000) }, endTime: { gt: new Date(+slots[0].startTime - 3600000) }, OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }, include: { room: true } })
    for (const slot of slots) for (const other of existing) {
      // Names are free-text labels; the location identifies the physical room.
      const sameRoom = other.location.trim().toLowerCase() === input.location.toLowerCase()
      const sharedPanel = other.room?.panelMemberIds.some(id => panelIds.includes(id))
      if ((sameRoom || sharedPanel) && overlaps(slot, other, Math.max(input.buffer, other.room?.buffer ?? 0))) throw new ActionError(sharedPanel ? "An interviewer already has an overlapping room schedule." : "This room or location already has overlapping interview slots.")
    }
    const room = await tx.interviewRoom.create({ data: { clubId: input.clubId, roundId: input.roundId, name: input.name, location: input.location, kind: input.kind, timezone: input.timezone, duration: input.duration, buffer: input.buffer, interviewersNeeded: input.interviewersNeeded ?? 2, panelMemberIds: panelIds, slots: { create: slots.map(s => ({ ...s, clubId: input.clubId, location: input.location })) } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: room.id, action: "interview.room.create" } })
    return { id: room.id, count: slots.length }
  })
  revalidatePath(`/club/${input.clubId}/workspace`)
  return result
}
async function setInterviewRoomOpenCommand(raw: { roomId: string; open: boolean }) {
  const input = z.object({ roomId: uuid, open: z.boolean() }).parse(raw)
  const room = await prisma.interviewRoom.findUnique({ where: { id: input.roomId } })
  if (!room) throw new ActionError("Room not found.")
  const { user } = await requireClubPermission(room.clubId, ["interviews.manage"])
  await atomic(async tx => {
    await authorizeClubTransaction(tx,room.clubId,user.id,["interviews.manage"])
    if (input.open) {
      const round = await tx.pipelineRound.findFirst({ where: { id: room.roundId, clubId: room.clubId, archivedAt: null } })
      if (!round) throw new ActionError("Archived rounds cannot reopen interview rooms.")
      const slots = await tx.interviewSlot.findMany({ where: { roomId: room.id, startTime: { gt: new Date() } } })
      const members=await tx.clubMember.findMany({where:{id:{in:[...new Set(slots.flatMap(s=>s.panelScheduleVersionId?s.publishedPanelMemberIds:room.approvedPanelMemberIds))]},clubId:room.clubId},select:{id:true,userId:true}})
      // Reopening adds these panelists' official commitments across clubs.
      await lockSchedulingPeople(tx,{exclusive:members.map(m=>m.userId)})
      await assertOfficialPanelConflicts(tx,members.map(m=>m.userId),slots.map(s=>({id:s.id,startTime:s.startTime.toISOString(),endTime:s.endTime.toISOString(),buffer:room.buffer,userIds:members.filter(m=>(s.panelScheduleVersionId?s.publishedPanelMemberIds:room.approvedPanelMemberIds).includes(m.id)).map(m=>m.userId)})))
      const others = await tx.interviewSlot.findMany({ where: { clubId: room.clubId, AND: [{ OR: [{ roomId: null }, { roomId: { not: room.id } }] }, { OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }] }, include: { room: true } })
      if (slots.some(s => others.some(o => (o.location.trim().toLowerCase() === room.location.trim().toLowerCase() || o.room?.panelMemberIds.some(id => room.panelMemberIds.includes(id))) && overlaps(s, o, Math.max(room.buffer, o.room?.buffer ?? 0))))) throw new ActionError("Another room now overlaps this schedule. Create a new time window instead.")
    }
    await tx.interviewRoom.update({ where: { id: room.id }, data: { isOpen: input.open } })
    const bookings = await tx.interviewBooking.findMany({ where: { slot: { roomId: room.id }, roundId: room.roundId } });
    for (const booking of bookings) {
      await tx.$queryRaw`SELECT id FROM "Application" WHERE id=${booking.applicationId} FOR UPDATE`;
      await syncBookingPanel(tx, booking.applicationId, room.roundId, user.id);
    }
    await tx.auditLog.create({ data: { actorId: user.id, clubId: room.clubId, targetId: room.id, action: input.open ? "interview.room.open" : "interview.room.close" } })
  })
  revalidatePath(`/club/${room.clubId}/workspace`)
}
/** Rename only. Slots keep their stored location, so confirmed reservations are unchanged. */
async function renameInterviewRoomCommand(raw: unknown) {
  const input = roomRenameSchema.parse(raw)
  const { user } = await requireAuth()
  const result = await atomic(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    // Names are free-text labels (duplicates allowed); overlap checks use location and panel, not name.
    await lockOperationalClub(tx, input.clubId)
    const room = await tx.interviewRoom.findFirst({ where: { id: input.roomId, clubId: input.clubId }, select: { id: true, name: true } })
    if (!room) throw new ActionError("Room unavailable.")
    if (room.name === input.name) return { name: room.name }
    await tx.interviewRoom.update({ where: { id: room.id }, data: { name: input.name } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: room.id, action: "interview.room.rename" } })
    return { name: input.name }
  })
  revalidatePath(`/club/${input.clubId}/workspace`)
  return result
}
/** Tracking only: records that the leader reserved the room in the school's system (UVA: 25Live). */
async function setInterviewRoomExternallyBookedCommand(raw: unknown) {
  const input = roomExternalBookingSchema.parse(raw)
  const { user } = await requireAuth()
  const result = await atomic(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    await lockOperationalClub(tx, input.clubId)
    const room = await tx.interviewRoom.findFirst({ where: { id: input.roomId, clubId: input.clubId }, select: { id: true, externallyBookedAt: true } })
    if (!room) throw new ActionError("Room unavailable.")
    if (!!room.externallyBookedAt === input.booked) return { externallyBookedAt: room.externallyBookedAt?.toISOString() ?? null }
    const externallyBookedAt = input.booked ? new Date() : null
    await tx.interviewRoom.update({ where: { id: room.id }, data: { externallyBookedAt } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: room.id, action: input.booked ? "interview.room.external_booking.mark" : "interview.room.external_booking.clear" } })
    return { externallyBookedAt: externallyBookedAt?.toISOString() ?? null }
  }, true)
  revalidatePath(`/club/${input.clubId}/workspace`)
  return result
}
export async function getApplicantSchedule(applicationId: string): Promise<ApplicantSchedule> {
  uuid.parse(applicationId)
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    const application = await tx.application.findFirst({ where: { id: applicationId, studentId: user.id }, include: { club: { select: { name: true, suspendedAt: true } }, round: { include: { bookingCycle: true } } } })
    if (!application || application.status !== "INTERVIEWING" || application.club.suspendedAt) throw new ActionError("An interview invitation is required to book a time.")
    const round = application.round
    const published = !!round.bookingPublishedAt && !round.archivedAt && !round.anonymousReview && ["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type) && round.bookingCycleId === application.recruitmentCycleId && !round.bookingCycle?.archivedAt
    const publicationState = !published ? "NOT_PUBLISHED" as const : round.bookingPaused ? "PAUSED" as const : "PUBLISHED" as const
    const booking = await tx.interviewBooking.findFirst({ where: { applicationId, roundId: round.id }, include: { slot: true } })
    const coverage = publicationState === "PUBLISHED" ? await interviewBookingCoverage(tx, application.clubId, round.id, application) : []
    const available = new Set(coverage.filter(s => s.bookable).map(s => s.slotId))
    const rooms = publicationState === "PUBLISHED" ? await tx.interviewRoom.findMany({ where: { clubId: application.clubId, roundId: round.id, isOpen: true }, include: roomInclude, orderBy: { createdAt: "asc" } }) : []
    // The student's interviews with other clubs (or other rounds). reserveInterview refuses an
    // overlapping time, so those times are left out up front instead of failing on submit.
    const elsewhere = publicationState === "PUBLISHED" ? await tx.interviewBooking.findMany({ where: { application: { studentId: user.id }, ...(booking ? { id: { not: booking.id } } : {}), slot: { endTime: { gt: new Date() } } }, select: { slot: { select: { startTime: true, endTime: true } } } }) : []
    let conflictingTimes = 0
    const bookable = rooms.map(r => presentRoom(r, true)).map(r => ({ ...r, slots: r.slots.filter(s => {
      if (!available.has(s.id) || !isPublishedBookingSlot(round.bookingSlots, s, r)) return false
      if (elsewhere.some(other => overlaps(s, other.slot))) { conflictingTimes++; return false }
      return true
    }) })).filter(r => r.slots.length)
    return { applicationId, clubName: application.club.name, roundName: round.name, publicationState, allowCancellation: round.bookingAllowCancellation, allowRescheduling: round.bookingAllowRescheduling, conflictingTimes, rooms: bookable, booking: booking ? { id: booking.id, applicationId, slotId: booking.slotId, roomId: booking.slot.roomId!, roundId: booking.roundId!, candidate: "You", startTime: booking.slot.startTime.toISOString(), endTime: booking.slot.endTime.toISOString(), location: booking.slot.location } : null }
  }, { timeout: 60000 })
}
async function reserveInterviewCommand(raw: { applicationId: string; slotId: string }) {
  const input = z.object({ applicationId: uuid, slotId: uuid }).parse(raw)
  const { user } = await requireAuth()
  const booking = await atomic(async tx => {
    const initial = await tx.application.findFirst({ where: { id: input.applicationId, studentId: user.id } });
    if (!initial) throw new ActionError("Application unavailable.");
    // Refuse before taking any lock on other people or sessions; re-checked under lock below.
    if (initial.status !== "INTERVIEWING") throw new ActionError("An interview invitation is required to book a time.")
    // Club-wide scheduling changes (panels, rooms, booking policy, membership) lock the
    // club row exclusively; a reservation only needs them excluded, so reservations in
    // one club no longer wait for each other here.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${initial.clubId} FOR SHARE`
    await assertClubOperational(tx, initial.clubId)
    // Bookability depends on the student's own commitments (changed here) and the target
    // session's official panel (read). The panel cannot change while the club row is held.
    const target = await tx.interviewSlot.findUnique({ where: { id: input.slotId }, include: { room: true } })
    const panelIds = target?.room && target.clubId === initial.clubId ? (target.panelScheduleVersionId ? target.publishedPanelMemberIds : target.room.approvedPanelMemberIds.filter(id => target.room!.panelMemberIds.includes(id))) : []
    const panelUsers = panelIds.length ? (await tx.clubMember.findMany({ where: { id: { in: panelIds }, clubId: initial.clubId }, select: { userId: true } })).map(m => m.userId) : []
    await lockSchedulingPeople(tx, { exclusive: [user.id], shared: panelUsers })
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
    const application = await tx.application.findFirst({ where: { id: input.applicationId, studentId: user.id } })
    if (!application || application.status !== "INTERVIEWING") throw new ActionError("An interview invitation is required to book a time.")
    // Capacity is read only after the session row is locked (concurrent reservations).
    await tx.$queryRaw`SELECT id FROM "InterviewSlot" WHERE id=${input.slotId} AND "clubId"=${application.clubId} FOR UPDATE`
    const slot = await tx.interviewSlot.findUnique({ where: { id: input.slotId }, include: { room: true, _count: { select: { bookings: true } } } })
    if (!slot?.room || slot.clubId !== application.clubId || slot.room.roundId !== application.roundId) throw new ActionError("Choose a slot for your invited club and round.")
    const existing = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: application.id, roundId: application.roundId } }, include: { slot: true } })
    if (existing?.slotId === slot.id) { await syncBookingPanel(tx, application.id, application.roundId, user.id); return { id: existing.id } }
    if (existing && +existing.slot.startTime <= Date.now()) throw new ActionError("This interview has already started. Contact the club to change it.")
    if (!slot.room.isOpen || +slot.startTime <= Date.now()) throw new ActionError("This slot is no longer available.")
    const round = await tx.pipelineRound.findUniqueOrThrow({ where: { id: application.roundId }, include: { bookingCycle: true } })
    if (!isPublishedBookingSlot(round.bookingSlots, slot, slot.room) || !round.bookingPublishedAt || round.bookingPaused || round.archivedAt || round.anonymousReview || !["INTERVIEW", "GROUP_INTERVIEW"].includes(round.type) || round.bookingCycleId !== application.recruitmentCycleId || round.bookingCycle?.archivedAt) throw new ActionError("Interview times aren’t open for your round right now.")
    if (existing && !round.bookingAllowRescheduling) throw new ActionError("This club does not allow self-service rescheduling. Your original reservation is retained; contact the club.")
    const coverage = await interviewBookingCoverage(tx, application.clubId, round.id, application)
    if (!coverage.some(s => s.slotId === slot.id && s.bookable)) throw new ActionError("This time can no longer provide an approved, fully staffed interview. Your current reservation is retained. Choose another time or contact the club.")
    await assertOfficialPanelConflicts(tx,[user.id],[{id:slot.id,startTime:slot.startTime.toISOString(),endTime:slot.endTime.toISOString(),buffer:slot.room.buffer}])
    if (slot._count.bookings >= slot.capacity) throw new ActionError("That time was just booked. Choose another slot.")
    const others = await tx.interviewBooking.findMany({ where: { application: { studentId: user.id }, ...(existing ? { id: { not: existing.id } } : {}), slot: { endTime: { gt: new Date() } } }, include: { slot: true } })
    if (others.some(b => overlaps(slot, b.slot))) throw new ActionError("You already have an interview at that time.")
    if (others.some(b => b.applicationId === application.id && b.roundId === null)) throw new ActionError("You already have an interview with this club. Contact the club before booking another time.")
    if (existing) {
      await notifyInterviewBookingChange(tx, existing)
      await tx.interviewBooking.delete({ where: { id: existing.id } })
    }
    const result = await tx.interviewBooking.create({ data: { ...input, roundId: application.roundId } })
    await syncBookingPanel(tx, application.id, application.roundId, user.id);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: application.clubId, targetId: result.id, action: existing ? "interview.booking.reschedule" : "interview.booking.create" } })
    return { id: result.id }
  },true)
  revalidatePath("/", "layout")
  return booking
}
async function cancelRoomBookingCommand(bookingId: string) {
  uuid.parse(bookingId)
  const { user } = await requireAuth()
  await atomic(async tx => {
    const initial = await tx.interviewBooking.findFirst({ where: { id: bookingId, application: { studentId: user.id } }, include: { slot: true } });
    if (!initial) throw new ActionError("We couldn’t find that interview.");
    await lockOperationalClub(tx, initial.slot.clubId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${initial.applicationId} FOR UPDATE`;
    const booking = await tx.interviewBooking.findFirst({ where: { id: bookingId, application: { studentId: user.id } }, include: { slot: true } })
    if (!booking) throw new ActionError("We couldn’t find that interview.")
    if (+booking.slot.startTime <= Date.now()) throw new ActionError("This interview has already started. Contact the club to change it.")
    const policy = booking.roundId ? await tx.pipelineRound.findUnique({ where: { id: booking.roundId } }) : null
    if (policy && !policy.bookingAllowCancellation) throw new ActionError("This club does not allow self-service cancellation. Contact the club; your reservation is retained.")
    await notifyInterviewBookingChange(tx, booking)
    await tx.interviewBooking.delete({ where: { id: bookingId } })
    if (booking.roundId) await syncBookingPanel(tx, booking.applicationId, booking.roundId, user.id);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: booking.slot.clubId, targetId: bookingId, action: "interview.booking.cancel" } })
  })
  revalidatePath("/", "layout")
}
export async function getBookingApplication(clubId: string, roundId: string) {
  if (!uuid.safeParse(clubId).success || !uuid.safeParse(roundId).success) return { status: "unavailable" as const }
  const { user } = await requireAuth()
  try {
    const app = await prisma.application.findFirst({ where: { clubId, roundId, studentId: user.id, status: "INTERVIEWING", round: { archivedAt: null } }, select: { id: true } })
    return app ? { status: "ready" as const, applicationId: app.id } : { status: "unavailable" as const }
  } catch (error) {
    console.error("Booking invitation lookup failed", { kind: error instanceof Error ? error.name : "Unknown" })
    return { status: "error" as const }
  }
}

/** Staffing metadata only. Never calls panel sync, approval or notification code. */
async function setInterviewStaffingRequirementCommand(raw: unknown) {
  const input = z.object({ clubId: uuid, roomId: uuid, slotId: uuid.optional(), revision: z.number().int().nonnegative(), needed: z.number().int().min(1).max(8).nullable() }).strict().parse(raw)
  if (!input.slotId && input.needed === null) throw new ActionError("Choose 1–8 interviewers for this room.")
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const room = await tx.interviewRoom.findFirst({ where: { id: input.roomId, clubId: input.clubId } })
    if (!room) throw new ActionError("Room unavailable.")
    if(await tx.interviewSlot.findFirst({where:{roomId:room.id,panelScheduleVersionId:{not:null},startTime:{gt:new Date()}}}))throw new ActionError("Edit staffing in a working panel revision and explicitly publish the changes.")
    const result = input.slotId
      ? await tx.interviewSlot.updateMany({ where: { id: input.slotId, roomId: room.id, clubId: input.clubId, staffingRevision: input.revision }, data: { interviewersNeeded: input.needed, staffingRevision: { increment: 1 } } })
      : await tx.interviewRoom.updateMany({ where: { id: room.id, clubId: input.clubId, staffingRevision: input.revision }, data: { interviewersNeeded: input.needed!, staffingRevision: { increment: 1 } } })
    if (result.count !== 1) throw new ActionError("Staffing requirement changed. Reload before saving.")
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, action: "interview.staffing.requirement", targetId: input.slotId ?? room.id, details: { needed: input.needed } } })
    return { revision: input.revision + 1 }
  })
}

export async function reserveInterview(...args: Parameters<typeof reserveInterviewCommand>) {
  return actionResult(() => reserveInterviewCommand(...args), "reserveInterview")
}

export async function cancelRoomBooking(...args: Parameters<typeof cancelRoomBookingCommand>) {
  return actionResult(() => cancelRoomBookingCommand(...args), "cancelRoomBooking")
}

export async function createInterviewRoom(...args: Parameters<typeof createInterviewRoomCommand>) {
  return actionResult(() => createInterviewRoomCommand(...args), "createInterviewRoom")
}

export async function setInterviewRoomOpen(...args: Parameters<typeof setInterviewRoomOpenCommand>) {
  return actionResult(() => setInterviewRoomOpenCommand(...args), "setInterviewRoomOpen")
}

export async function renameInterviewRoom(...args: Parameters<typeof renameInterviewRoomCommand>) {
  return actionResult(() => renameInterviewRoomCommand(...args), "renameInterviewRoom")
}

export async function setInterviewRoomExternallyBooked(...args: Parameters<typeof setInterviewRoomExternallyBookedCommand>) {
  return actionResult(() => setInterviewRoomExternallyBookedCommand(...args), "setInterviewRoomExternallyBooked")
}

export async function setInterviewStaffingRequirement(...args: Parameters<typeof setInterviewStaffingRequirementCommand>) {
  return actionResult(() => setInterviewStaffingRequirementCommand(...args), "setInterviewStaffingRequirement")
}
