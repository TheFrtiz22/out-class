"use server";

import { prisma } from "@/utils/prisma";
import { requireAuth } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const submissionSchema = z.object({
  clubId: z.string().uuid(),
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    response: z.string()
  }))
});

export async function submitApplication(data: z.infer<typeof submissionSchema>) {
  const { user } = await requireAuth();
  const parsed = submissionSchema.parse(data);

  // 1. Ensure the student has a profile before applying
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id }
  });

  if (!profile) {
    throw new Error("You must complete your unified profile before applying.");
  }

  // 2. Ensure they haven't already applied
  const existingApp = await prisma.application.findUnique({
    where: {
      studentId_clubId: {
        studentId: user.id,
        clubId: parsed.clubId
      }
    }
  });

  if (existingApp && existingApp.status !== "DRAFTING") {
    throw new Error("You have already submitted an application to this club.");
  }

  // 3. Find the first Pipeline Round for this club (usually "Applied")
  const firstRound = await prisma.pipelineRound.findFirst({
    where: { clubId: parsed.clubId },
    orderBy: { order: 'asc' }
  });

  if (!firstRound) {
    throw new Error("This club has not set up their application pipeline yet.");
  }

  // 4. Upsert the application (transition from DRAFTING -> SUBMITTED)
  const application = await prisma.application.upsert({
    where: {
      studentId_clubId: {
        studentId: user.id,
        clubId: parsed.clubId
      }
    },
    update: {
      status: "SUBMITTED",
      roundId: firstRound.id,
      submittedAt: new Date(),
      answers: {
        deleteMany: {}, // Clear drafts
        create: parsed.answers
      }
    },
    create: {
      studentId: user.id,
      clubId: parsed.clubId,
      status: "SUBMITTED",
      roundId: firstRound.id,
      submittedAt: new Date(),
      answers: {
        create: parsed.answers
      }
    }
  });

  revalidatePath("/student-dashboard");
  revalidatePath(`/club/${parsed.clubId}`);

  return { success: true, applicationId: application.id };
}

export async function saveApplicationDraft(data: z.infer<typeof submissionSchema>) {
  const { user } = await requireAuth();
  const parsed = submissionSchema.parse(data);

  // Fetch the first round as a placeholder for drafts
  const firstRound = await prisma.pipelineRound.findFirst({
    where: { clubId: parsed.clubId },
    orderBy: { order: 'asc' }
  });

  if (!firstRound) {
    throw new Error("This club has not set up their application pipeline yet.");
  }

  const application = await prisma.application.upsert({
    where: {
      studentId_clubId: {
        studentId: user.id,
        clubId: parsed.clubId
      }
    },
    update: {
      answers: {
        deleteMany: {},
        create: parsed.answers
      }
    },
    create: {
      studentId: user.id,
      clubId: parsed.clubId,
      status: "DRAFTING",
      roundId: firstRound.id,
      answers: {
        create: parsed.answers
      }
    }
  });

  revalidatePath("/student-dashboard");
  return { success: true, applicationId: application.id };
}

export async function getStudentDashboardData() {
  const { user } = await requireAuth();

  const applications = await prisma.application.findMany({
    where: { studentId: user.id },
    include: {
      club: {
        select: { name: true, logoUrl: true, color: true }
      },
      round: {
        select: { name: true }
      },
      answers: true,
      bookings: {
        include: { slot: true }
      }
    },
    orderBy: { submittedAt: 'desc' }
  });

  const attendances = await prisma.eventAttendance.findMany({
    where: { studentId: user.id },
    include: {
      event: {
        include: { club: { select: { name: true } } }
      }
    }
  });

  return { applications, attendances };
}

