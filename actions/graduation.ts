"use server"
import { revalidatePath } from "next/cache"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { ActionError, actionResult } from "@/lib/action-result"
import { canConfirmGraduation, confirmedGraduationAt } from "@/lib/graduation"

/** Home prompt answers (lib/graduation.ts). Only the account holder answers; a support session cannot. */
async function ownProfile(work: (tx: AppTransactionClient, userId: string) => Promise<void>) {
  const { user, impersonation } = await requireAuth()
  if (impersonation) throw new ActionError("Only the account holder can answer this.", "FORBIDDEN")
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    await work(tx, user.id)
  })
  revalidatePath("/", "layout")
}

async function confirmGraduationCommand() {
  const result = { graduatedAt: new Date(0) }
  await ownProfile(async (tx, userId) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true, gradYear: true, graduatedAt: true, graduationConfirmedAt: true } })
    if (!profile) throw new ActionError("Complete your profile first.")
    const now = new Date()
    if (!canConfirmGraduation(profile, now)) throw new ActionError("Graduation can be confirmed from April of your graduation year. Update your year if it changed.")
    const graduatedAt = result.graduatedAt = confirmedGraduationAt(profile.gradYear, now)
    await tx.studentProfile.update({ where: { id: profile.id }, data: { graduatedAt, graduationConfirmedAt: now } })
    await tx.auditLog.create({ data: { actorId: userId, targetId: profile.id, action: "student.graduation.confirm", details: { gradYear: profile.gradYear, graduatedAt: graduatedAt.toISOString() } } })
  })
  return result
}

async function dismissGraduationPromptCommand() {
  await ownProfile(async (tx, userId) => {
    const updated = await tx.studentProfile.updateMany({ where: { userId, graduationPromptDismissedAt: null }, data: { graduationPromptDismissedAt: new Date() } })
    if (!updated.count && !await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } })) throw new ActionError("Complete your profile first.")
  })
  return { dismissed: true }
}

export async function confirmGraduation() {
  return actionResult(confirmGraduationCommand, "confirmGraduation")
}
export async function dismissGraduationPrompt() {
  return actionResult(dismissGraduationPromptCommand, "dismissGraduationPrompt")
}
