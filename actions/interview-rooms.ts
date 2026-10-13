"use server"

import { panelPublicationLock } from "@/utils/panel-publication"
import { assertOfficialPanelConflicts } from "@/utils/official-panel-conflicts"
import { lockOperationalClub } from "@/lib/club-suspension";
import type { AppTransactionClient } from "@/utils/prisma";
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth, requireClubPermission } from "@/utils/auth"
import { hasPermission } from "@/lib/permissions"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { roomInputSchema, roomSlots, overlaps, type RoomInput, type InterviewRoom, type RoomBooking, type RoomWorkspace, type ApplicantSchedule } from "@/lib/interview-rooms"
import { revalidatePath } from "next/cache"
import { loadInterviewerPool } from "@/utils/interviewer-pool"
import { intervalAvailability } from "@/lib/availability"
import { syncBookingPanel } from "@/utils/interview-scheduling-access"
import { notifyInterviewBookingChange } from "@/utils/interview-assignment-notifications"

const uuid = z.string().uuid()
const roomInclude = { slots: { include: { _count: { select: { bookings: true } } }, orderBy: { startTime: "asc" as const } } }
type StoredRoom = Prisma.InterviewRoomGetPayload<{ include: typeof roomInclude }>
function presentRoom(room: StoredRoom, applicant = false): InterviewRoom {
  return { id: room.id, clubId: room.clubId, roundId: room.roundId, name: room.name, location: room.location, kind: room.kind, timezone: room.timezone, duration: room.duration, buffer: room.buffer, isOpen: room.isOpen, panelMemberIds: applicant ? [] : room.panelMemberIds,
    ...(!applicant ? { interviewersNeeded: room.interviewersNeeded, staffingRevision: room.staffingRevision, approvedPanelMemberIds: room.approvedPanelMemberIds } : {}),
    slots: room.slots.filter(s => !applicant || +s.startTime > Date.now() && (!s.panelScheduleVersionId || s.publishedPanelMemberIds.length>0)).map(s => ({ id: s.id, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(), capacity: s.capacity, booked: s._count.bookings, ...(!applicant ? { interviewersNeeded: s.interviewersNeeded, staffingRevision: s.staffingRevision, publishedPanelMemberIds:s.publishedPanelMemberIds,panelScheduleVersionId:s.panelScheduleVersionId } : {}) })) }
}
async function atomic<T>(fn: (tx: AppTransactionClient) => Promise<T>, freshReads=false): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: freshReads?Prisma.TransactionIsolationLevel.ReadCommitted:Prisma.TransactionIsolationLevel.Serializable }) }
    catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : ""
      if (code === "P2034" && attempt < 2) continue
      if (code === "P2034" || code === "P2002") throw new Error("The schedule changed while saving. Refresh and try again.")
      throw error
    }
  }
}
export async function getRoomWorkspace(clubId: string): Promise<RoomWorkspace> {
  uuid.parse(clubId)
  const { membership } = await requireClubPermission(clubId, ["interviews.manage"])
  const [club, rounds, members, rooms, bookings] = await Promise.all([
    prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true } }),
    prisma.pipelineRound.findMany({ where: { clubId, archivedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true, configuration: true, type: true } }),
    prisma.clubMember.findMany({ where: { clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } } } }),
    prisma.interviewRoom.findMany({ where: { clubId }, include: roomInclude, orderBy: { createdAt: "desc" } }),
    prisma.interviewBooking.findMany({ where: { slot: { clubId, roomId: { not: null } } }, include: { slot: true, round: { select: { anonymousReview: true } }, application: { select: { round: { select: { anonymousReview: true } }, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } } }),
  ])
  return { clubName: club.name, rounds, members: members.map(m => ({ id: m.id, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email })), rooms: rooms.map(r => presentRoom(r)), bookings: bookings.map(b => ({ id: b.id, slotId: b.slotId, roomId: b.slot.roomId!, roundId: b.roundId!, applicationId: b.applicationId, candidate: hasPermission(membership, "applicants.identify") && b.round?.anonymousReview === false && b.application.round.anonymousReview === false && b.application.student.studentProfile ? `${b.application.student.studentProfile.firstName} ${b.application.student.studentProfile.lastName}` : `Applicant ${b.applicationId.slice(-6)}`, startTime: b.slot.startTime.toISOString(), endTime: b.slot.endTime.toISOString(), location: b.slot.location })) }
}
export async function createInterviewRoom(raw: RoomInput) {
  const input = roomInputSchema.parse(raw)
  const { user } = await requireClubPermission(input.clubId, ["interviews.manage"])
  const slots = roomSlots(input)
  const result = await atomic(async tx => {
    // Serialize competing room creation and overlap checks within this club.
    await lockOperationalClub(tx, input.clubId)
    const round = await tx.pipelineRound.findFirst({ where: { id: input.roundId, clubId: input.clubId, archivedAt: null } })
    if (!round) throw new Error("Choose a recruitment round from this club.")
    const panelIds = [...new Set(input.panelMemberIds)]
    if (await tx.clubMember.count({ where: { id: { in: panelIds }, clubId: input.clubId, status: "ACTIVE", user: { disabledAt: null } } }) !== panelIds.length) throw new Error("Choose interviewers who belong to this club.")
    const existing = await tx.interviewSlot.findMany({ where: { clubId: input.clubId, startTime: { lt: new Date(+slots[slots.length - 1].endTime + 3600000) }, endTime: { gt: new Date(+slots[0].startTime - 3600000) }, OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }, include: { room: true } })
    for (const slot of slots) for (const other of existing) {
      const sameRoom = other.location.trim().toLowerCase() === input.location.toLowerCase() || other.room?.name.trim().toLowerCase() === input.name.toLowerCase()
      const sharedPanel = other.room?.panelMemberIds.some(id => panelIds.includes(id))
      if ((sameRoom || sharedPanel) && overlaps(slot, other, Math.max(input.buffer, other.room?.buffer ?? 0))) throw new Error(sharedPanel ? "An interviewer already has an overlapping room schedule." : "This room or location already has overlapping interview slots.")
    }
    const room = await tx.interviewRoom.create({ data: { clubId: input.clubId, roundId: input.roundId, name: input.name, location: input.location, kind: input.kind, timezone: input.timezone, duration: input.duration, buffer: input.buffer, interviewersNeeded: input.interviewersNeeded ?? 2, panelMemberIds: panelIds, slots: { create: slots.map(s => ({ ...s, clubId: input.clubId, location: input.location })) } } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: room.id, action: "interview.room.create" } })
    return { id: room.id, count: slots.length }
  })
  revalidatePath(`/club/${input.clubId}/workspace`)
  return result
}
export async function setInterviewRoomOpen(raw: { roomId: string; open: boolean }) {
  const input = z.object({ roomId: uuid, open: z.boolean() }).parse(raw)
  const room = await prisma.interviewRoom.findUnique({ where: { id: input.roomId } })
  if (!room) throw new Error("Room not found.")
  const { user } = await requireClubPermission(room.clubId, ["interviews.manage"])
  await atomic(async tx => {
    await panelPublicationLock(tx)
    await authorizeClubTransaction(tx,room.clubId,user.id,["interviews.manage"])
    if (input.open) {
      const round = await tx.pipelineRound.findFirst({ where: { id: room.roundId, clubId: room.clubId, archivedAt: null } })
      if (!round) throw new Error("Archived rounds cannot reopen interview rooms.")
      const slots = await tx.interviewSlot.findMany({ where: { roomId: room.id, startTime: { gt: new Date() } } })
      const members=await tx.clubMember.findMany({where:{id:{in:[...new Set(slots.flatMap(s=>s.panelScheduleVersionId?s.publishedPanelMemberIds:room.approvedPanelMemberIds))]},clubId:room.clubId},select:{id:true,userId:true}})
      await assertOfficialPanelConflicts(tx,members.map(m=>m.userId),slots.map(s=>({id:s.id,startTime:s.startTime.toISOString(),endTime:s.endTime.toISOString(),buffer:room.buffer,userIds:members.filter(m=>(s.panelScheduleVersionId?s.publishedPanelMemberIds:room.approvedPanelMemberIds).includes(m.id)).map(m=>m.userId)})))
      const others = await tx.interviewSlot.findMany({ where: { clubId: room.clubId, AND: [{ OR: [{ roomId: null }, { roomId: { not: room.id } }] }, { OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }] }, include: { room: true } })
      if (slots.some(s => others.some(o => (o.location.trim().toLowerCase() === room.location.trim().toLowerCase() || o.room?.name.toLowerCase() === room.name.toLowerCase() || o.room?.panelMemberIds.some(id => room.panelMemberIds.includes(id))) && overlaps(s, o, Math.max(room.buffer, o.room?.buffer ?? 0))))) throw new Error("Another room now overlaps this schedule. Create a new time window instead.")
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
export async function getApplicantSchedule(applicationId: string): Promise<ApplicantSchedule> {
  uuid.parse(applicationId)
  const { user } = await requireAuth()
  const application = await prisma.application.findFirst({ where: { id: applicationId, studentId: user.id }, include: { club: { select: { name: true } }, round: { select: { name: true } } } })
  if (!application || application.status !== "INTERVIEWING") throw new Error("An interview invitation is required to book a time.")
  const [rooms, booking] = await Promise.all([
    prisma.interviewRoom.findMany({ where: { clubId: application.clubId, roundId: application.roundId, isOpen: true }, include: roomInclude, orderBy: { createdAt: "asc" } }),
    prisma.interviewBooking.findFirst({ where: { applicationId, roundId: application.roundId }, include: { slot: true } }),
  ])
  return { applicationId, clubName: application.club.name, roundName: application.round.name, rooms: rooms.map(r => presentRoom(r, true)).filter(r => r.slots.length), booking: booking ? { id: booking.id, applicationId, slotId: booking.slotId, roomId: booking.slot.roomId!, roundId: booking.roundId!, candidate: "You", startTime: booking.slot.startTime.toISOString(), endTime: booking.slot.endTime.toISOString(), location: booking.slot.location } : null }
}
export async function reserveInterview(raw: { applicationId: string; slotId: string }) {
  const input = z.object({ applicationId: uuid, slotId: uuid }).parse(raw)
  const { user } = await requireAuth()
  const booking = await atomic(async tx => {
    await panelPublicationLock(tx)
    const initial = await tx.application.findFirst({ where: { id: input.applicationId, studentId: user.id } });
    if (!initial) throw new Error("Application unavailable.");
    await lockOperationalClub(tx, initial.clubId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${input.applicationId} FOR UPDATE`;
    const application = await tx.application.findFirst({ where: { id: input.applicationId, studentId: user.id } })
    if (!application || application.status !== "INTERVIEWING") throw new Error("An interview invitation is required to book a time.")
    const slot = await tx.interviewSlot.findUnique({ where: { id: input.slotId }, include: { room: true, _count: { select: { bookings: true } } } })
    if (!slot?.room || slot.clubId !== application.clubId || slot.room.roundId !== application.roundId) throw new Error("Choose a slot for your invited club and round.")
    const existing = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: application.id, roundId: application.roundId } }, include: { slot: true } })
    if (existing?.slotId === slot.id) { await syncBookingPanel(tx, application.id, application.roundId, user.id); return { id: existing.id } }
    if (existing && +existing.slot.startTime <= Date.now()) throw new Error("This interview has already started. Contact the club to change it.")
    if (!slot.room.isOpen || +slot.startTime <= Date.now()) throw new Error("This slot is no longer available.")
    if(slot.panelScheduleVersionId){
      const version=await tx.interviewPanelScheduleVersion.findUnique({where:{id:slot.panelScheduleVersionId}})
      const pool=await loadInterviewerPool(tx,application.clubId,application.roundId)
      if(!version||!await tx.clubMember.findFirst({where:{userId:version.publishedBy,clubId:application.clubId,isOwner:true,status:"ACTIVE",user:{disabledAt:null}}})||!pool.members.some(m=>slot.publishedPanelMemberIds.includes(m.id)&&m.userId!==user.id&&m.eligible&&m.confirmed&&m.evidenceAccess&&intervalAvailability(m.availability,+slot.startTime,+slot.endTime+slot.room!.buffer*60000)==="available"))throw new Error("This published session has no qualified interviewer available to host your interview. Choose another time or contact the club.")
      const direct=await tx.interviewPanelAssignment.findMany({where:{applicationId:application.id,roundId:application.roundId,bookingManaged:false,revokedAt:{not:null}}})
      if(slot.publishedPanelMemberIds.every(id=>direct.some(g=>g.memberId===id)))throw new Error("This session cannot provide authorized interview access. Contact the club.")
    }
    await assertOfficialPanelConflicts(tx,[user.id],[{id:slot.id,startTime:slot.startTime.toISOString(),endTime:slot.endTime.toISOString(),buffer:slot.room.buffer}])
    if (slot._count.bookings >= slot.capacity) throw new Error("That time was just booked. Choose another slot.")
    const others = await tx.interviewBooking.findMany({ where: { application: { studentId: user.id }, ...(existing ? { id: { not: existing.id } } : {}), slot: { endTime: { gt: new Date() } } }, include: { slot: true } })
    if (others.some(b => overlaps(slot, b.slot))) throw new Error("You already have an interview at that time.")
    if (others.some(b => b.applicationId === application.id && b.roundId === null)) throw new Error("You already have a legacy booking with this club. Contact the club before booking another time.")
    if (existing) {
      await notifyInterviewBookingChange(tx, existing)
      await tx.interviewBooking.delete({ where: { id: existing.id } })
    }
    const result = await tx.interviewBooking.create({ data: { ...input, roundId: application.roundId } })
    await syncBookingPanel(tx, application.id, application.roundId, user.id);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: application.clubId, targetId: result.id, action: existing ? "interview.booking.reschedule" : "interview.booking.create" } })
    return { id: result.id }
  },true)
  revalidatePath("/")
  return booking
}
export async function cancelRoomBooking(bookingId: string) {
  uuid.parse(bookingId)
  const { user } = await requireAuth()
  await atomic(async tx => {
    const initial = await tx.interviewBooking.findFirst({ where: { id: bookingId, application: { studentId: user.id } }, include: { slot: true } });
    if (!initial) throw new Error("Booking not found.");
    await lockOperationalClub(tx, initial.slot.clubId);
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${initial.applicationId} FOR UPDATE`;
    const booking = await tx.interviewBooking.findFirst({ where: { id: bookingId, application: { studentId: user.id } }, include: { slot: true } })
    if (!booking) throw new Error("Booking not found.")
    if (+booking.slot.startTime <= Date.now()) throw new Error("This interview has already started. Contact the club to change it.")
    await notifyInterviewBookingChange(tx, booking)
    await tx.interviewBooking.delete({ where: { id: bookingId } })
    if (booking.roundId) await syncBookingPanel(tx, booking.applicationId, booking.roundId, user.id);
    await tx.auditLog.create({ data: { actorId: user.id, clubId: booking.slot.clubId, targetId: bookingId, action: "interview.booking.cancel" } })
  })
  revalidatePath("/")
}
export async function getBookingApplication(clubId: string, roundId: string) {
  uuid.parse(clubId); uuid.parse(roundId)
  const { user } = await requireAuth()
  const app = await prisma.application.findFirst({ where: { clubId, roundId, studentId: user.id, status: "INTERVIEWING" }, select: { id: true } })
  if (!app) throw new Error("This booking link is for applicants invited to this recruitment round. Sign in with your applicant account or check with the club.")
  return { applicationId: app.id }
}

/** Staffing metadata only. Never calls panel sync, approval or notification code. */
export async function setInterviewStaffingRequirement(raw: unknown) {
  const input = z.object({ clubId: uuid, roomId: uuid, slotId: uuid.optional(), revision: z.number().int().nonnegative(), needed: z.number().int().min(1).max(8).nullable() }).strict().parse(raw)
  if (!input.slotId && input.needed === null) throw new Error("Choose 1–8 interviewers for this room.")
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const room = await tx.interviewRoom.findFirst({ where: { id: input.roomId, clubId: input.clubId } })
    if (!room) throw new Error("Room unavailable.")
    if(await tx.interviewSlot.findFirst({where:{roomId:room.id,panelScheduleVersionId:{not:null},startTime:{gt:new Date()}}}))throw new Error("Edit staffing in a working panel revision and explicitly publish the changes.")
    const result = input.slotId
      ? await tx.interviewSlot.updateMany({ where: { id: input.slotId, roomId: room.id, clubId: input.clubId, staffingRevision: input.revision }, data: { interviewersNeeded: input.needed, staffingRevision: { increment: 1 } } })
      : await tx.interviewRoom.updateMany({ where: { id: room.id, clubId: input.clubId, staffingRevision: input.revision }, data: { interviewersNeeded: input.needed!, staffingRevision: { increment: 1 } } })
    if (result.count !== 1) throw new Error("Staffing requirement changed. Reload before saving.")
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, action: "interview.staffing.requirement", targetId: input.slotId ?? room.id, details: { needed: input.needed } } })
    return { revision: input.revision + 1 }
  })
}
