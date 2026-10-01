"use server"
import type { AppTransactionClient } from "@/utils/prisma";
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth, requireClubPermission } from "@/utils/auth"
import { hasPermission } from "@/lib/permissions"
import { roomInputSchema, roomSlots, overlaps, type RoomInput, type InterviewRoom, type RoomBooking, type RoomWorkspace, type ApplicantSchedule } from "@/lib/interview-rooms"
import { revalidatePath } from "next/cache"

const uuid = z.string().uuid()
const roomInclude = { slots: { include: { _count: { select: { bookings: true } } }, orderBy: { startTime: "asc" as const } } }
type StoredRoom = Prisma.InterviewRoomGetPayload<{ include: typeof roomInclude }>
function presentRoom(room: StoredRoom, applicant = false): InterviewRoom {
  return { id: room.id, clubId: room.clubId, roundId: room.roundId, name: room.name, location: room.location, kind: room.kind, timezone: room.timezone, duration: room.duration, buffer: room.buffer, isOpen: room.isOpen, panelMemberIds: applicant ? [] : room.panelMemberIds,
    slots: room.slots.filter(s => !applicant || +s.startTime > Date.now()).map(s => ({ id: s.id, startTime: s.startTime.toISOString(), endTime: s.endTime.toISOString(), capacity: s.capacity, booked: s._count.bookings })) }
}
async function atomic<T>(fn: (tx: AppTransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }) }
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
    prisma.pipelineRound.findMany({ where: { clubId }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    prisma.clubMember.findMany({ where: { clubId, status: "ACTIVE", user: { disabledAt: null } }, select: { id: true, user: { select: { email: true, studentProfile: { select: { firstName: true, lastName: true } } } } } }),
    prisma.interviewRoom.findMany({ where: { clubId }, include: roomInclude, orderBy: { createdAt: "desc" } }),
    prisma.interviewBooking.findMany({ where: { slot: { clubId, roomId: { not: null } } }, include: { slot: true, round: { select: { anonymousReview: true } }, application: { select: { student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } } }),
  ])
  return { clubName: club.name, rounds, members: members.map(m => ({ id: m.id, name: m.user.studentProfile ? `${m.user.studentProfile.firstName} ${m.user.studentProfile.lastName}` : m.user.email })), rooms: rooms.map(r => presentRoom(r)), bookings: bookings.map(b => ({ id: b.id, slotId: b.slotId, roomId: b.slot.roomId!, roundId: b.roundId!, applicationId: b.applicationId, candidate: hasPermission(membership, "applicants.identify") && !b.round?.anonymousReview && b.application.student.studentProfile ? `${b.application.student.studentProfile.firstName} ${b.application.student.studentProfile.lastName}` : `Applicant ${b.applicationId.slice(-6)}`, startTime: b.slot.startTime.toISOString(), endTime: b.slot.endTime.toISOString(), location: b.slot.location })) }
}
export async function createInterviewRoom(raw: RoomInput) {
  const input = roomInputSchema.parse(raw)
  const { user } = await requireClubPermission(input.clubId, ["interviews.manage"])
  const slots = roomSlots(input)
  const result = await atomic(async tx => {
    // Serialize competing room creation and overlap checks within this club.
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${input.clubId} FOR UPDATE`
    const round = await tx.pipelineRound.findFirst({ where: { id: input.roundId, clubId: input.clubId } })
    if (!round) throw new Error("Choose a recruitment round from this club.")
    const panelIds = [...new Set(input.panelMemberIds)]
    if (await tx.clubMember.count({ where: { id: { in: panelIds }, clubId: input.clubId, status: "ACTIVE", user: { disabledAt: null } } }) !== panelIds.length) throw new Error("Choose interviewers who belong to this club.")
    const existing = await tx.interviewSlot.findMany({ where: { clubId: input.clubId, startTime: { lt: new Date(+slots[slots.length - 1].endTime + 3600000) }, endTime: { gt: new Date(+slots[0].startTime - 3600000) }, OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }, include: { room: true } })
    for (const slot of slots) for (const other of existing) {
      const sameRoom = other.location.trim().toLowerCase() === input.location.toLowerCase() || other.room?.name.trim().toLowerCase() === input.name.toLowerCase()
      const sharedPanel = other.room?.panelMemberIds.some(id => panelIds.includes(id))
      if ((sameRoom || sharedPanel) && overlaps(slot, other, Math.max(input.buffer, other.room?.buffer ?? 0))) throw new Error(sharedPanel ? "An interviewer already has an overlapping room schedule." : "This room or location already has overlapping interview slots.")
    }
    const room = await tx.interviewRoom.create({ data: { clubId: input.clubId, roundId: input.roundId, name: input.name, location: input.location, kind: input.kind, timezone: input.timezone, duration: input.duration, buffer: input.buffer, panelMemberIds: panelIds, slots: { create: slots.map(s => ({ ...s, clubId: input.clubId, location: input.location })) } } })
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
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${room.clubId} FOR UPDATE`
    if (input.open) {
      const slots = await tx.interviewSlot.findMany({ where: { roomId: room.id, startTime: { gt: new Date() } } })
      const others = await tx.interviewSlot.findMany({ where: { clubId: room.clubId, AND: [{ OR: [{ roomId: null }, { roomId: { not: room.id } }] }, { OR: [{ roomId: null }, { room: { isOpen: true } }, { bookings: { some: {} } }] }] }, include: { room: true } })
      if (slots.some(s => others.some(o => (o.location.trim().toLowerCase() === room.location.trim().toLowerCase() || o.room?.name.toLowerCase() === room.name.toLowerCase() || o.room?.panelMemberIds.some(id => room.panelMemberIds.includes(id))) && overlaps(s, o, Math.max(room.buffer, o.room?.buffer ?? 0))))) throw new Error("Another room now overlaps this schedule. Create a new time window instead.")
    }
    await tx.interviewRoom.update({ where: { id: room.id }, data: { isOpen: input.open } })
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
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    const application = await tx.application.findFirst({ where: { id: input.applicationId, studentId: user.id } })
    if (!application || application.status !== "INTERVIEWING") throw new Error("An interview invitation is required to book a time.")
    const slot = await tx.interviewSlot.findUnique({ where: { id: input.slotId }, include: { room: true, _count: { select: { bookings: true } } } })
    if (!slot?.room || slot.clubId !== application.clubId || slot.room.roundId !== application.roundId) throw new Error("Choose a slot for your invited club and round.")
    const existing = await tx.interviewBooking.findUnique({ where: { applicationId_roundId: { applicationId: application.id, roundId: application.roundId } }, include: { slot: true } })
    if (existing?.slotId === slot.id) return { id: existing.id }
    if (existing && +existing.slot.startTime <= Date.now()) throw new Error("This interview has already started. Contact the club to change it.")
    if (!slot.room.isOpen || +slot.startTime <= Date.now()) throw new Error("This slot is no longer available.")
    if (slot._count.bookings >= slot.capacity) throw new Error("That time was just booked. Choose another slot.")
    const others = await tx.interviewBooking.findMany({ where: { application: { studentId: user.id }, ...(existing ? { id: { not: existing.id } } : {}), slot: { endTime: { gt: new Date() } } }, include: { slot: true } })
    if (others.some(b => overlaps(slot, b.slot))) throw new Error("You already have an interview at that time.")
    if (others.some(b => b.applicationId === application.id && b.roundId === null)) throw new Error("You already have a legacy booking with this club. Contact the club before booking another time.")
    if (existing) await tx.interviewBooking.delete({ where: { id: existing.id } })
    const result = await tx.interviewBooking.create({ data: { ...input, roundId: application.roundId } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: application.clubId, targetId: result.id, action: existing ? "interview.booking.reschedule" : "interview.booking.create" } })
    return { id: result.id }
  })
  revalidatePath("/")
  return booking
}
export async function cancelRoomBooking(bookingId: string) {
  uuid.parse(bookingId)
  const { user } = await requireAuth()
  await atomic(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    const booking = await tx.interviewBooking.findFirst({ where: { id: bookingId, application: { studentId: user.id } }, include: { slot: true } })
    if (!booking) throw new Error("Booking not found.")
    if (+booking.slot.startTime <= Date.now()) throw new Error("This interview has already started. Contact the club to change it.")
    await tx.interviewBooking.delete({ where: { id: bookingId } })
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
