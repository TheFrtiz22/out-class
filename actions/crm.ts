"use server";

import { prisma } from "@/utils/prisma";
import { requireClubRole } from "@/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export async function getClubPipeline(clubId: string) {
  // Only members can view the pipeline
  await requireClubRole(clubId, ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"]);

  const rounds = await prisma.pipelineRound.findMany({
    where: { clubId },
    orderBy: { order: "asc" },
  });

  const applications = await prisma.application.findMany({
    where: { clubId, status: { not: "DRAFTING" } },
    include: {
      student: {
        include: { studentProfile: true }
      },
      evaluations: true,
      answers: true,
    }
  });

  return { rounds, applications };
}

const moveApplicantSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  newRoundId: z.string().uuid()
});

export async function moveApplicantRound(data: z.infer<typeof moveApplicantSchema>) {
  const parsed = moveApplicantSchema.parse(data);

  // Only Presidents and Recruitment Leads can move candidates through the pipeline
  await requireClubRole(parsed.clubId, ["PRESIDENT", "RECRUITMENT_LEAD"]);

  const application = await prisma.application.update({
    where: { id: parsed.applicationId },
    data: { roundId: parsed.newRoundId }
  });

  revalidatePath(`/club-manager`);

  return { success: true, application };
}

const statusUpdateSchema = z.object({
  clubId: z.string().uuid(),
  applicationId: z.string().uuid(),
  status: z.enum(["IN_REVIEW", "INTERVIEWING", "ACCEPTED", "REJECTED", "WAITLISTED"])
});

export async function setApplicationStatus(data: z.infer<typeof statusUpdateSchema>) {
  const parsed = statusUpdateSchema.parse(data);

  // Only Presidents can issue final decisions
  await requireClubRole(parsed.clubId, ["PRESIDENT"]);

  const application = await prisma.application.update({
    where: { id: parsed.applicationId },
    data: { status: parsed.status }
  });

  revalidatePath(`/club-manager`);

  return { success: true, application };
}

