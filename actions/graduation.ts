"use server"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma, type AppTransactionClient } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { ActionError, actionResult } from "@/lib/action-result"
import { canConfirmGraduation, confirmedGraduationAt, isAlumniProfile, postGradDetailsSchema, type PostGradDetails } from "@/lib/graduation"
import { boundedSafeParse } from "@/lib/bounded-input"
import { shareGraduatePlacement } from "@/utils/graduation"

/** Home prompt answers (lib/graduation.ts). Only the account holder answers; a support session cannot. */
async function ownProfile(work: (tx: AppTransactionClient, userId: string) => Promise<string[] | void>) {
  const { user, impersonation } = await requireAuth()
  if (impersonation) throw new ActionError("Only the account holder can answer this.", "FORBIDDEN")
  const clubIds = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    return work(tx, user.id)
  })
  revalidatePath("/", "layout")
  // Public club pages show the merged "Where members go" list.
  if (clubIds?.length) {
    revalidateTag("club-directory")
    for (const clubId of clubIds) revalidatePath(`/club/${clubId}`)
  }
}

/** Validation messages reach the screen (ActionError), so a long or link-like name explains itself. */
function parseDetails(input: unknown) {
  const parsed = boundedSafeParse(postGradDetailsSchema, input ?? {})
  if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message || "Check your entries.")
  return parsed.data
}
/** Employer, role and the two alumni privacy choices, as stored on StudentProfile. */
const detailsData = (d: PostGradDetails) => ({ postGradEmployer: d.employer, postGradRole: d.role, alumniDirectoryVisible: d.showInAlumniList, alumniPlacementShare: d.shareEmployer })

async function confirmGraduationCommand(input: unknown = {}) {
  const details = parseDetails(input)
  const result = { graduatedAt: new Date(0) }
  await ownProfile(async (tx, userId) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true, gradYear: true, graduatedAt: true, graduationConfirmedAt: true } })
    if (!profile) throw new ActionError("Complete your profile first.")
    const now = new Date()
    if (!canConfirmGraduation(profile, now)) throw new ActionError("Graduation can be confirmed from April of your graduation year. Update your year if it changed.")
    const graduatedAt = result.graduatedAt = confirmedGraduationAt(profile.gradYear, now)
    await tx.studentProfile.update({ where: { id: profile.id }, data: { graduatedAt, graduationConfirmedAt: now, ...detailsData(details) } })
    await tx.auditLog.create({ data: { actorId: userId, targetId: profile.id, action: "student.graduation.confirm", details: { gradYear: profile.gradYear, graduatedAt: graduatedAt.toISOString(), employer: !!details.employer, showInAlumniList: details.showInAlumniList, shareEmployer: details.shareEmployer } } })
    // Same transaction: the employer name (never the student's) joins each club's placements.
    return (await shareGraduatePlacement(tx, userId, now)).clubIds
  })
  return result
}

/**
 * Settings: edit the employer, role and alumni privacy choices later. Available once the student has
 * confirmed graduation or is alumni. A new employer is shared to their clubs' placements once
 * (utils/graduation.ts); turning sharing off never removes names already listed (they are anonymous).
 */
async function saveAlumniDetailsCommand(input: unknown) {
  const details = parseDetails(input)
  await ownProfile(async (tx, userId) => {
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true, graduatedAt: true, graduationConfirmedAt: true } })
    if (!profile) throw new ActionError("Complete your profile first.")
    if (!profile.graduationConfirmedAt && !isAlumniProfile(profile)) throw new ActionError("These details open once you confirm your graduation.")
    await tx.studentProfile.update({ where: { id: profile.id }, data: detailsData(details) })
    await tx.auditLog.create({ data: { actorId: userId, targetId: profile.id, action: "student.alumni.details", details: { employer: !!details.employer, showInAlumniList: details.showInAlumniList, shareEmployer: details.shareEmployer } } })
    return (await shareGraduatePlacement(tx, userId)).clubIds
  })
  return { saved: true }
}

async function dismissGraduationPromptCommand() {
  await ownProfile(async (tx, userId) => {
    const updated = await tx.studentProfile.updateMany({ where: { userId, graduationPromptDismissedAt: null }, data: { graduationPromptDismissedAt: new Date() } })
    if (!updated.count && !await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } })) throw new ActionError("Complete your profile first.")
  })
  return { dismissed: true }
}

export async function confirmGraduation(input?: unknown) {
  return actionResult(() => confirmGraduationCommand(input), "confirmGraduation")
}
export async function saveAlumniDetails(input: unknown) {
  return actionResult(() => saveAlumniDetailsCommand(input), "saveAlumniDetails")
}
export async function dismissGraduationPrompt() {
  return actionResult(dismissGraduationPromptCommand, "dismissGraduationPrompt")
}
