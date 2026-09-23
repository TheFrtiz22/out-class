"use server";

import { prisma } from "@/utils/prisma";
import { requireAuth, requireClubRole } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const createEventSchema = z.object({
  clubId: z.string().uuid(),
  title: z.string().min(1),
  date: z.coerce.date(),
  location: z.string().min(1),
  description: z.string().optional(),
  isPublic: z.boolean().default(true)
});

export async function createEvent(data: z.infer<typeof createEventSchema>) {
  const parsed = createEventSchema.parse(data);

  // Must be at least a Recruitment Lead to create official events
  await requireClubRole(parsed.clubId, ["PRESIDENT", "RECRUITMENT_LEAD"]);

  const event = await prisma.event.create({
    data: {
      clubId: parsed.clubId,
      title: parsed.title,
      date: parsed.date,
      location: parsed.location,
      description: parsed.description,
      isPublic: parsed.isPublic
    }
  });

  revalidatePath(`/club/${parsed.clubId}`);
  revalidatePath(`/club-manager`);

  return { success: true, event };
}

export async function getClubEvents(clubId: string) {
  const events = await prisma.event.findMany({
    where: { clubId, isPublic: true },
    orderBy: { date: "asc" }
  });

  return { events };
}

export async function recordEventAttendance(eventId: string) {
  const { user } = await requireAuth();

  // Make sure the event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId }
  });

  if (!event) {
    throw new Error("Event not found.");
  }

  if (!event.isPublic) {
    await requireClubRole(event.clubId, ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"]);
  }

  // Record attendance using Postgres upsert to prevent duplicates if they scan twice
  const attendance = await prisma.eventAttendance.upsert({
    where: {
      eventId_studentId: {
        eventId,
        studentId: user.id
      }
    },
    update: {
      checkedInAt: new Date()
    },
    create: {
      eventId,
      studentId: user.id
    }
  });

  revalidatePath("/student-dashboard");
  revalidatePath(`/club-manager`);

  return { success: true, attendance };
}

export async function getEventAttendees(eventId: string, clubId: string) {
  // Only club admins can see the attendee list (leads)
  await requireClubRole(clubId, ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"]);

  const attendees = await prisma.eventAttendance.findMany({
    where: { eventId, event: { clubId } },
    include: {
      student: {
        omit: { passwordHash: true },
        include: { studentProfile: true }
      }
    },
    orderBy: { checkedInAt: "desc" }
  });

  return { attendees };
}

