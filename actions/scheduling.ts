"use server";

import { lockSchedulingPeople } from "@/utils/panel-publication";
import { logContentionExhausted, retryTransactionConflict, TransactionConflictError } from "@/utils/club-write-transaction";
import { assertOfficialPanelConflicts } from "@/utils/official-panel-conflicts";
import { Prisma } from "@prisma/client";
import { assertClubOperational } from "@/lib/club-suspension";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubPermission } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { boundedParse } from "@/lib/bounded-input";

const createSlotsSchema = z.object({
  clubId: z.string().uuid(),
  slots: z.array(z.object({
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    location: z.string().min(1),
    capacity: z.number().int().min(1).default(1)
  }).refine(slot => slot.endTime > slot.startTime, { message: "Interview end must follow its start." })).min(1).max(200)
});

export async function createInterviewSlots(data: z.infer<typeof createSlotsSchema>) {
  const parsed = boundedParse(createSlotsSchema, data);

  // Must be an admin to define interview blocks
  await requireClubPermission(parsed.clubId, ["interviews.manage"]);

  throw new Error("Reload the interview manager and create a room with a recruitment round.");
}

export async function getAvailableSlots(clubId: string) {
  // Anyone authenticated can view public slots for a club
  await requireAuth();

  await assertClubOperational(prisma, clubId);
  const slots = await prisma.interviewSlot.findMany({
    where: { clubId, roomId: null, startTime: { gt: new Date() } },
    include: {
      _count: { select: { bookings: true } }
    },
    orderBy: { startTime: "asc" }
  });

  // Filter out full slots before sending to client
  const availableSlots = slots.filter(slot => slot._count.bookings < slot.capacity);

  return { slots: availableSlots };
}

const bookSlotSchema = z.object({
  slotId: z.string().uuid(),
  applicationId: z.string().uuid()
});

export async function bookInterviewSlot(data: z.infer<typeof bookSlotSchema>) {
  const { user } = await requireAuth();
  const parsed = bookSlotSchema.parse(data);

  // Row locks (club, student, session) prevent concurrent requests from overbooking a slot.
  let booking;
  try {
    // Deadlock (40P01) or serialization failure (40001) rolls the transaction back whole; it is re-run.
    booking = await retryTransactionConflict(() => prisma.$transaction(async (tx) => {
      const application = await tx.application.findUnique({ where: { id: parsed.applicationId } });
      if (!application || application.studentId !== user.id) {
        throw new Error("Unauthorized to book for this application.");
      }
      // Same order as room reservations: club (shared), the student, then the session row,
      // so capacity is read after concurrent reservations of this slot commit.
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${application.clubId} FOR SHARE`;
      await assertClubOperational(tx, application.clubId);
      await lockSchedulingPeople(tx, { exclusive: [user.id] });
      await tx.$queryRaw`SELECT id FROM "InterviewSlot" WHERE id=${parsed.slotId} AND "clubId"=${application.clubId} FOR UPDATE`;
      const slot = await tx.interviewSlot.findUnique({
        where: { id: parsed.slotId }, include: { bookings: true },
      });
      if (!slot || slot.clubId !== application.clubId) throw new Error("Slot not available for this application.");
      if (slot.roomId) throw new Error("Use the booking page to pick a time in this room.");
      const existing = slot.bookings.find(item => item.applicationId === application.id);
      if (existing) return existing;
      if (application.status !== "INTERVIEWING") throw new Error("You need an interview invitation before you can book.");
      if (slot.startTime <= new Date()) throw new Error("This interview slot has already started.");
      if (slot.bookings.length >= slot.capacity) throw new Error("This interview slot is already full.");
      const otherBookings = await tx.interviewBooking.findMany({
        where: { application: { studentId: user.id }, slot: { endTime: { gt: new Date() } } }, include: { slot: true },
      });
      if (otherBookings.some(b => b.applicationId === application.id || b.slot.startTime < slot.endTime && b.slot.endTime > slot.startTime)) {
        throw new Error("You already have an interview for this application or time.");
      }
      await assertOfficialPanelConflicts(tx,[user.id],[{id:slot.id,startTime:slot.startTime.toISOString(),endTime:slot.endTime.toISOString(),buffer:0}]);
      return tx.interviewBooking.create({ data: parsed });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }));
  } catch (error) {
    if (!(error instanceof TransactionConflictError)) throw error;
    logContentionExhausted("interview.booking.legacy", error);
    throw new Error("That time changed. Reload the page and try again.");
  }

  revalidatePath("/", "layout");
  revalidatePath(`/club-manager`);

  return { success: true, booking };
}

