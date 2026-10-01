"use server";
import { requireAuth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { hasWorkspace } from "@/lib/permissions";
import { tutorialExperience, tutorialInput, type TutorialProgress } from "@/lib/tutorials";

async function context(experience: unknown, clubId?: string) {
  const kind = tutorialExperience.parse(experience);
  const { user, impersonation } = await requireAuth();
  if (kind === "leader") {
    if (!clubId) throw new Error("Choose your leader workspace.");
    const member = await prisma.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
    if (!member || !hasWorkspace(member)) throw new Error("Leader workspace access required.");
  }
  return { userId: user.id, experience: kind, impersonation };
}
export async function getTutorial(experience: unknown, clubId?: string): Promise<TutorialProgress> {
  const { userId, experience: kind } = await context(experience, clubId);
  return await prisma.userTutorial.findUnique({ where: { userId_experience: { userId, experience: kind } } }) ?? { status: "IN_PROGRESS", step: 0, version: 1 };
}
export async function saveTutorial(input: unknown): Promise<TutorialProgress> {
  const data = tutorialInput.parse(input);
  const { userId, experience, impersonation } = await context(data.experience, data.clubId);
  const status = data.action === "skip" ? "SKIPPED" : data.action === "complete" ? "COMPLETED" : "IN_PROGRESS";
  const step = data.action === "restart" ? 0 : data.step;
  // Support can preview a tour without consuming the customer's first-time experience.
  if (impersonation) return { status, step, version: 1 };
  return prisma.$transaction(async tx => {
    const key = { userId, experience };
    await tx.userTutorial.upsert({ where: { userId_experience: key }, create: { ...key, status, step }, update: {} });
    await tx.userTutorial.updateMany({
      where: { ...key, ...(data.action === "restart" ? {} : { status: "IN_PROGRESS" }) },
      data: { status, step },
    });
    return (await tx.userTutorial.findUniqueOrThrow({ where: { userId_experience: key } }));
  });
}
