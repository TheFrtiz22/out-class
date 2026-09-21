"use server";

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
  }))
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
      bookings: true // Needed to determine if the slot is full (bookings.length >= capacity)
    },
    orderBy: { startTime: "asc" }
  });

  // Filter out full slots before sending to client
  const availableSlots = slots.filter(slot => slot.bookings.length < slot.capacity);

  return { slots: availableSlots };
}

const bookSlotSchema = z.object({
  slotId: z.string().uuid(),
  applicationId: z.string().uuid()
});

export async function bookInterviewSlot(data: z.infer<typeof bookSlotSchema>) {
  const { user } = await requireAuth();
  const parsed = bookSlotSchema.parse(data);

  // 1. Verify the application belongs to the current user
  const application = await prisma.application.findUnique({
    where: { id: parsed.applicationId }
  });

  if (!application || application.studentId !== user.id) {
    throw new Error("Unauthorized to book for this application.");
  }

  // 2. Fetch the slot to check capacity
  const slot = await prisma.interviewSlot.findUnique({
    where: { id: parsed.slotId },
    include: { bookings: true }
  });

  if (!slot) {
    throw new Error("Slot not found.");
  }

  if (slot.bookings.length >= slot.capacity) {
    throw new Error("This interview slot is already full.");
  }

  // 3. Book the slot (atomic transaction recommended for real high-concurrency, but fine for now)
  const booking = await prisma.interviewBooking.create({
    data: {
      slotId: parsed.slotId,
      applicationId: parsed.applicationId
    }
  });

  revalidatePath("/student-dashboard");
  revalidatePath(`/club-manager`);

  return { success: true, booking };
}

