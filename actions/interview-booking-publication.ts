"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { interviewBookingCoverage } from "@/utils/interview-booking"
import { notifyBookingPublished } from "@/utils/applicant-booking-notifications"
import { revalidatePath } from "next/cache"
import { bookingSlotSnapshot } from "@/lib/interview-rooms"

export async function getInterviewBookingPublication(raw: unknown) {
  const input = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid() }).strict().parse(raw)
  const { user } = await requireAuth()
  return prisma.$transaction(async tx => {
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const rows = await interviewBookingCoverage(tx, input.clubId, input.roundId)
    return { slots: rows }
  }, { timeout: 60000 })
}

export async function setInterviewBookingPublication(raw: unknown) {
  const input = z.object({ clubId: z.string().uuid(), roundId: z.string().uuid(), revision: z.number().int().nonnegative(), action: z.enum(["PUBLISH", "PAUSE", "POLICY"]), cycleId: z.string().uuid().nullable(), allowCancellation: z.boolean(), allowRescheduling: z.boolean() }).strict().parse(raw)
  const { user } = await requireAuth()
  const result = await prisma.$transaction(async tx => {
    // Club-exclusive. Panels it checks were conflict-checked across clubs when published.
    await authorizeClubTransaction(tx, input.clubId, user.id, ["interviews.manage"])
    const round = await tx.pipelineRound.findFirst({ where: { id: input.roundId, clubId: input.clubId, archivedAt: null, type: { in: ["INTERVIEW", "GROUP_INTERVIEW"] } } })
    if (!round || round.anonymousReview) throw new Error("Choose an active identified interview round.")
    if (input.cycleId && !await tx.recruitmentCycle.findFirst({ where: { id: input.cycleId, clubId: input.clubId, archivedAt: null } })) throw new Error("Choose an active recruitment cycle from this club.")
    if (input.action !== "PUBLISH" && input.cycleId !== round.bookingCycleId) throw new Error("Publish the schedule to change the recruiting cycle. Existing interviews are kept.")
    // Exact retries do not republish or send another notification.
    if (input.action === "PUBLISH" && round.bookingPublishedAt && !round.bookingPaused && round.bookingCycleId === input.cycleId && round.bookingAllowCancellation === input.allowCancellation && round.bookingAllowRescheduling === input.allowRescheduling && round.bookingRevision === input.revision + 1) return { revision: round.bookingRevision }
    if (round.bookingRevision !== input.revision) throw new Error("Booking settings changed in another tab. Reload and try again.")
    let bookingSlots: ReturnType<typeof bookingSlotSnapshot>[] | undefined
    if (input.action === "PUBLISH") {
      const coverage = await interviewBookingCoverage(tx, input.clubId, input.roundId)
      if (!coverage.length) throw new Error("Add upcoming interview times before publishing the schedule.")
      const blocked = coverage.find(s => !s.bookable)
      if (blocked) throw new Error(`The schedule can't be published yet: ${blocked.reasons.join(" ")} Check this session's interviewers.`)
      const slots = await tx.interviewSlot.findMany({ where: { id: { in: coverage.map(s => s.slotId) }, clubId: input.clubId }, include: { room: true } })
      bookingSlots = slots.map(s => bookingSlotSnapshot(s, s.room!))
    }
    const saved = await tx.pipelineRound.update({ where: { id: round.id }, data: { bookingCycleId: input.cycleId, bookingAllowCancellation: input.allowCancellation, bookingAllowRescheduling: input.allowRescheduling, bookingRevision: { increment: 1 }, ...(input.action === "PUBLISH" ? { bookingPublishedAt: round.bookingPublishedAt ?? new Date(), bookingPaused: false, bookingSlots } : input.action === "PAUSE" ? { bookingPaused: true } : {}) } })
    if (input.action === "PUBLISH") await notifyBookingPublished(tx, saved)
    await tx.auditLog.create({ data: { actorId: user.id, clubId: input.clubId, targetId: round.id, action: `interview.booking.${input.action.toLowerCase()}`, details: { cycleId: input.cycleId, revision: saved.bookingRevision, allowCancellation: input.allowCancellation, allowRescheduling: input.allowRescheduling } } })
    return { revision: saved.bookingRevision }
  }, { isolationLevel: "ReadCommitted", timeout: 60000 })
  revalidatePath(`/club/${input.clubId}/workspace`)
  revalidatePath("/", "layout")
  return result
}
