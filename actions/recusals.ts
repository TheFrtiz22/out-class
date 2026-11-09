"use server"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { authorizeClubTransaction } from "@/lib/club-transaction-authorization"
import { hasPermission } from "@/lib/permissions"
import { profileName } from "@/lib/recusal-presentation"

const scope = z.object({ clubId: z.string().uuid(), applicationId: z.string().uuid() }).strict()
const setSchema = scope.extend({ memberId: z.string().uuid().optional(), recused: z.boolean() }).strict()

/** Who can see and change recusals:
 * - any reviewer or interviewer can step out of an applicant themselves;
 * - recruitment leads (recruitment.manage) can recuse anyone and undo any recusal.
 * Members cannot undo their own recusal, so it can't be toggled to game a vote. */
export async function getApplicantRecusals(input: unknown) {
  const d = scope.parse(input)
  const { user } = await requireClubPermission(d.clubId, [], { allowSuspendedRead: true })
  return prisma.$transaction(async tx => {
    const member = await authorizeClubTransaction(tx, d.clubId, user.id, [], { readOnly: true, allowSuspendedRead: true })
    const app = await tx.application.findFirst({ where: { id: d.applicationId, clubId: d.clubId, status: { not: "DRAFTING" } }, select: { studentId: true } })
    if (!app || app.studentId === user.id) throw new Error("Application unavailable.")
    const lead = hasPermission(member, "recruitment.manage")
    const rows = await tx.applicantRecusal.findMany({
      where: { applicationId: d.applicationId, clubId: d.clubId, liftedAt: null, ...(lead ? {} : { memberId: member.id }) },
      select: { memberId: true, member: { select: { user: { select: { studentProfile: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: { createdAt: "asc" },
    })
    return {
      selfRecused: rows.some(r => r.memberId === member.id),
      canManage: lead,
      recused: lead ? rows.map(r => ({ memberId: r.memberId, name: profileName(r.member.user.studentProfile) })) : [],
    }
  })
}

export async function setApplicantRecusal(input: unknown) {
  const d = setSchema.parse(input)
  const { user } = await requireClubPermission(d.clubId, [])
  return prisma.$transaction(async tx => {
    const actor = await authorizeClubTransaction(tx, d.clubId, user.id, [])
    const targetId = d.memberId ?? actor.id
    const lead = hasPermission(actor, "recruitment.manage")
    if (targetId !== actor.id && !lead) throw new Error("Only recruitment leads can recuse other members.")
    if (!d.recused && !lead) throw new Error("Ask a recruitment lead to undo a recusal.")
    if (targetId === actor.id && !lead && !hasPermission(actor, "applications.review") && !actor.interviewOffices.length && !actor.interviewerEligible)
      throw new Error("Only reviewers and interviewers can recuse themselves.")
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${d.applicationId} FOR UPDATE`
    const app = await tx.application.findFirst({ where: { id: d.applicationId, clubId: d.clubId, status: { not: "DRAFTING" } }, select: { id: true } })
    if (!app) throw new Error("Application unavailable.")
    if (!await tx.clubMember.findFirst({ where: { id: targetId, clubId: d.clubId, status: "ACTIVE" }, select: { id: true } })) throw new Error("Member unavailable.")
    const key = { applicationId_memberId: { applicationId: d.applicationId, memberId: targetId } }
    const existing = await tx.applicantRecusal.findUnique({ where: key })
    if (d.recused) {
      if (existing && !existing.liftedAt) return { changed: false }
      if (existing) await tx.applicantRecusal.update({ where: key, data: { liftedAt: null, liftedById: null, createdAt: new Date(), createdById: user.id } })
      else await tx.applicantRecusal.create({ data: { clubId: d.clubId, applicationId: d.applicationId, memberId: targetId, createdById: user.id } })
    } else {
      if (!existing || existing.liftedAt) return { changed: false }
      await tx.applicantRecusal.update({ where: key, data: { liftedAt: new Date(), liftedById: user.id } })
    }
    // The audit record names the member and application only; no reason is collected or stored.
    await tx.auditLog.create({ data: { actorId: user.id, clubId: d.clubId, targetId: d.applicationId, action: d.recused ? "recruitment.recusal.add" : "recruitment.recusal.lift", details: { memberId: targetId } } })
    return { changed: true }
  })
}
