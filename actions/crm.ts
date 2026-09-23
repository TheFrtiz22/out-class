"use server"

import { prisma } from "@/utils/prisma"
import { requireClubRole } from "@/utils/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"

export async function getClubPipeline(clubId: string) {
  // Only members can view the pipeline
  await requireClubRole(clubId, ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"])

  const rounds = await prisma.pipelineRound.findMany({
    where: { clubId },
    orderBy: { order: "asc" },
  })

  const applications = await prisma.application.findMany({
    where: { clubId, status: { not: "DRAFTING" } },
    include: {
      student: {
        omit: { passwordHash: true },
        include: { studentProfile: { include: { experiences: true } } },
      },
      evaluations: true,
      answers: { include: { question: true } },
      bookings: { include: { slot: true } },
    },
  })

  return { rounds, applications }
}

const moveApplicantSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  newRoundId: z.string().uuid(),
})

export async function moveApplicantRound(data: z.infer<typeof moveApplicantSchema>) {
  const parsed = moveApplicantSchema.parse(data)

  // Only Presidents and Recruitment Leads can move candidates through the pipeline
  await requireClubRole(parsed.clubId, ["PRESIDENT", "RECRUITMENT_LEAD"])

  const round = await prisma.pipelineRound.findFirst({
    where: { id: parsed.newRoundId, clubId: parsed.clubId },
  })
  if (!round) throw new Error("Round is not available for this club.")
  const result = await prisma.application.updateMany({
    where: { id: parsed.applicationId, clubId: parsed.clubId, status: { not: "DRAFTING" } },
    data: { roundId: parsed.newRoundId },
  })
  if (result.count !== 1) throw new Error("Application is not available for this club.")
  const application = await prisma.application.findFirst({
    where: { id: parsed.applicationId, clubId: parsed.clubId },
  })

  revalidatePath("/")
  revalidatePath(`/club-manager`)

  return { success: true, application }
}

const statusUpdateSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  status: z.enum(["IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"]),
  expectedStatus: z
    .enum(["SUBMITTED", "IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"])
    .optional(),
})

export async function setApplicationStatus(data: z.infer<typeof statusUpdateSchema>) {
  const parsed = statusUpdateSchema.parse(data)

  // Only Presidents can issue final decisions
  await requireClubRole(parsed.clubId, ["PRESIDENT"])

  const result = await prisma.application.updateMany({
    where: {
      id: parsed.applicationId,
      clubId: parsed.clubId,
      status: parsed.expectedStatus ?? { not: "DRAFTING" },
    },
    data: { status: parsed.status },
  })
  if (result.count !== 1) throw new Error("Application is not available for this club.")
  const application = await prisma.application.findFirst({
    where: { id: parsed.applicationId, clubId: parsed.clubId },
  })

  revalidatePath("/")
  revalidatePath(`/club-manager`)

  return { success: true, application }
}
