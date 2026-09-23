"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubRole } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

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
  const parsed = createSlotsSchema.parse(data);

  // Must be an admin to define interview blocks
  await requireClubRole(parsed.clubId, ["PRESIDENT", "RECRUITMENT_LEAD"]);

  const slots = await prisma.interviewSlot.createMany({
    data: parsed.slots.map(s => ({
      clubId: parsed.clubId,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      capacity: s.capacity
    }))
  });

  revalidatePath(`/club-manager`);
  return { success: true, count: slots.count };
}

export async function getAvailableSlots(clubId: string) {
  // Anyone authenticated can view public slots for a club
  await requireAuth();

  const slots = await prisma.interviewSlot.findMany({
    where: { clubId, startTime: { gt: new Date() } },
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

  // Serializable isolation prevents concurrent requests from overbooking a slot.
  let booking;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      booking = await prisma.$transaction(async (tx) => {
        const application = await tx.application.findUnique({ where: { id: parsed.applicationId } });
        if (!application || application.studentId !== user.id) {
          throw new Error("Unauthorized to book for this application.");
        }
        const slot = await tx.interviewSlot.findUnique({
          where: { id: parsed.slotId }, include: { bookings: true },
        });
        if (!slot || slot.clubId !== application.clubId) throw new Error("Slot not available for this application.");
        const existing = slot.bookings.find(item => item.applicationId === application.id);
        if (existing) return existing;
        if (slot.startTime <= new Date()) throw new Error("This interview slot has already started.");
        if (slot.bookings.length >= slot.capacity) throw new Error("This interview slot is already full.");
        return tx.interviewBooking.create({ data: parsed });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
        if (attempt < 2) continue;
        throw new Error("This slot changed while booking. Please refresh and try again.");
      }
      throw error;
    }
  }

  revalidatePath("/");
  revalidatePath(`/club-manager`);

  return { success: true, booking };
}

