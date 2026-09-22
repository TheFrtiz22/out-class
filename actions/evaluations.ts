"use server"

import { prisma } from "@/utils/prisma"
import { requireClubRole } from "@/utils/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"

const evaluateSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  roundName: z.string().min(1),
  score: z.number().min(1).max(10), // Assuming a 1-10 scoring system
  notes: z.string().optional(),
})

export async function submitEvaluation(data: z.infer<typeof evaluateSchema>) {
  const parsed = evaluateSchema.parse(data)

  // Any active member can submit an evaluation
  const { membership } = await requireClubRole(parsed.clubId, [
    "PRESIDENT",
    "RECRUITMENT_LEAD",
    "GENERAL_MEMBER",
  ])

  const application = await prisma.application.findFirst({
    where: { id: parsed.applicationId, clubId: parsed.clubId, status: { not: "DRAFTING" } },
  })
  if (!application) throw new Error("Application is not available for this club.")
  const round = await prisma.pipelineRound.findFirst({
    where: { clubId: parsed.clubId, name: parsed.roundName },
  })
  if (!round) throw new Error("Round is not available for this club.")
  const evaluation = await prisma.evaluation.upsert({
    where: {
      applicationId_interviewerId_round: {
        applicationId: parsed.applicationId,
        interviewerId: membership.id,
        round: parsed.roundName,
      },
    },
    update: {
      score: parsed.score,
      notes: parsed.notes,
    },
    create: {
      applicationId: parsed.applicationId,
      interviewerId: membership.id,
      round: parsed.roundName,
      score: parsed.score,
      notes: parsed.notes,
    },
  })

  revalidatePath("/")
  revalidatePath(`/club-manager`)
  revalidatePath(`/interview-workspace/${parsed.applicationId}`)

  return { success: true, evaluation }
}

export async function getEvaluations(clubId: string, applicationId: string) {
  // Verifying access
  await requireClubRole(clubId, ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"])

  const evaluations = await prisma.evaluation.findMany({
    where: { applicationId, application: { clubId, status: { not: "DRAFTING" } } },
    include: {
      interviewer: {
        include: { user: { include: { studentProfile: true } } }, // To display the interviewer's name/photo
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return { evaluations }
}
