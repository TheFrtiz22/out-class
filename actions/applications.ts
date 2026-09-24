"use server"

import { meetsTestRequirement } from "@/lib/test-scores"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { revalidatePath } from "next/cache"
import { applicationInputSchema, answerErrors } from "@/lib/student-applications"
import type { z } from "zod"

async function persistApplication(input: z.infer<typeof applicationInputSchema>, submit: boolean) {
  const { user } = await requireAuth()
  const parsed = applicationInputSchema.parse(input)
  const applicationId = await prisma.$transaction(async (tx) => {
    if (submit && !(await tx.studentProfile.findUnique({ where: { userId: user.id } }))) {
      throw new Error("You must complete your unified profile before applying.")
    }
    if (submit) {
      const club = await tx.club.findUnique({ where: { id: parsed.clubId }, select: { testRequirement: true } })
      const profile = await tx.studentProfile.findUnique({ where: { userId: user.id } })
      if (!club || !meetsTestRequirement(club.testRequirement, profile)) throw new Error("Update your profile to meet this club's SAT/ACT requirement before submitting.")
    }
    const questions = await tx.applicationQuestion.findMany({ where: { clubId: parsed.clubId } })
    const errors = answerErrors(questions, parsed.answers, submit)
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
    const firstRound = await tx.pipelineRound.findFirst({
      where: { clubId: parsed.clubId },
      orderBy: { order: "asc" },
    })
    if (!firstRound) throw new Error("This club has not set up their application pipeline yet.")
    const existing = await tx.application.findUnique({
      where: { studentId_clubId: { studentId: user.id, clubId: parsed.clubId } },
    })
    const transition = submit
      ? { status: "SUBMITTED" as const, roundId: firstRound.id, submittedAt: new Date() }
      : { status: "DRAFTING" as const }
    if (existing) {
      // The status predicate also protects against a save racing with submission.
      const result = await tx.application.updateMany({
        where: { id: existing.id, studentId: user.id, status: "DRAFTING" },
        data: transition,
      })
      if (result.count !== 1)
        throw new Error(
          "This application has already been submitted. Reload to see its current status.",
        )
      await tx.applicationAnswer.deleteMany({ where: { applicationId: existing.id } })
      if (parsed.answers.length)
        await tx.applicationAnswer.createMany({
          data: parsed.answers.map((answer) => ({ ...answer, applicationId: existing.id })),
        })
      return existing.id
    }
    const application = await tx.application.create({
      data: {
        studentId: user.id,
        clubId: parsed.clubId,
        roundId: firstRound.id,
        ...transition,
        answers: { create: parsed.answers },
      },
    })
    return application.id
  })
  revalidatePath("/")
  revalidatePath(`/club/${parsed.clubId}`)
  return { success: true, applicationId }
}

export async function submitApplication(data: z.infer<typeof applicationInputSchema>) {
  return persistApplication(data, true)
}
export async function saveApplicationDraft(data: z.infer<typeof applicationInputSchema>) {
  return persistApplication(data, false)
}

export async function getStudentApplications() {
  const { user } = await requireAuth()
  return prisma.application.findMany({
    where: { studentId: user.id },
    select: {
      id: true,
      clubId: true,
      status: true,
      submittedAt: true,
      club: {
        select: {
          testRequirement: true,
          name: true,
          logoUrl: true,
          color: true,
          questions: {
            select: { id: true, prompt: true, type: true, required: true, wordLimit: true },
            orderBy: { id: "asc" },
          },
        },
      },
      round: { select: { name: true } },
      answers: { select: { questionId: true, response: true } },
      bookings: {
        select: { id: true, slot: { select: { startTime: true, endTime: true, location: true } } },
        orderBy: { slot: { startTime: "asc" } },
      },
    },
    orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
  })
}

export async function getStudentDashboardData() {
  const { user } = await requireAuth()

  const applications = await prisma.application.findMany({
    where: { studentId: user.id },
    include: {
      club: {
        select: { name: true, logoUrl: true, color: true, _count: { select: { questions: true } } },
      },
      round: {
        select: { name: true },
      },
      answers: true,
      bookings: {
        include: { slot: true },
      },
    },
    orderBy: { submittedAt: "desc" },
  })

  const attendances = await prisma.eventAttendance.findMany({
    where: { studentId: user.id, event: { OR: [{ audience: "RECRUITMENT", isPublic: true }, { club: { members: { some: { userId: user.id } } } }] } },
    include: {
      event: {
        include: { club: { select: { name: true } } },
      },
    },
  })

  const meetings = await prisma.meeting.findMany({ where: { OR: [{ audience: "RECRUITMENT", isPublic: true }, { club: { members: { some: { userId: user.id } } } }] }, select: { id: true, clubId: true, title: true, date: true, location: true, description: true, audience: true, club: { select: { name: true } } }, orderBy: { date: "asc" } })
  return { applications, attendances, meetings }
}
