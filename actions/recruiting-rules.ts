"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/utils/prisma"
import { requireClubPermission } from "@/utils/auth"
import { hasPermission } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { applyRuleSchema, buildRulePreview, ruleEligibleStatuses, ruleLabel, ruleScopeSchema, saveRuleSchema, validateRuleRequirement } from "@/lib/recruiting-rules"
import type { z } from "zod"

async function scopedRound(tx: Prisma.TransactionClient, scope: z.infer<typeof ruleScopeSchema>) {
  const round = await tx.pipelineRound.findFirst({
    where: { id: scope.roundId, clubId: scope.clubId },
    include: { screeningRule: true, club: { select: { testRequirement: true } } },
  })
  if (!round) throw new Error("Round is not available for this club.")
  return round
}

export async function getRecruitingRules(clubId: string) {
  ruleScopeSchema.shape.clubId.parse(clubId)
  const { membership } = await requireClubPermission(clubId, ["recruitment.manage"])
  const rounds = await prisma.pipelineRound.findMany({
    where: { clubId }, orderBy: { order: "asc" },
    select: { id: true, name: true, anonymousReview: true, screeningRule: true },
  })
  const club = await prisma.club.findUniqueOrThrow({ where: { id: clubId }, select: { testRequirement: true } })
  return { rounds, canIdentify: hasPermission(membership, "applicants.identify"), testRequirement: club.testRequirement, canPreview: hasPermission(membership, "applications.review"), canApply: hasPermission(membership, "applications.review") && hasPermission(membership, "decisions.manage") }
}

export async function saveRecruitingRule(input: z.infer<typeof saveRuleSchema>) {
  const parsed = saveRuleSchema.parse(input)
  const { user } = await requireClubPermission(parsed.clubId, ["recruitment.manage"])
  const saved = await prisma.$transaction(async tx => {
    const round = await scopedRound(tx, parsed)
    validateRuleRequirement(parsed.thresholds, round.club.testRequirement)
    if ((round.screeningRule?.revision ?? 0) !== parsed.expectedRevision) throw new Error("Rules changed. Reload before saving.")
    const data = { ...parsed.thresholds, revision: parsed.expectedRevision + 1 }
    const rule = round.screeningRule
      ? await tx.recruitingRule.update({ where: { roundId: parsed.roundId }, data })
      : await tx.recruitingRule.create({ data: { roundId: parsed.roundId, ...data } })
    // Flags belong to a specific saved rule version, never silently carry them into another.
    await tx.recruitingRuleFlag.deleteMany({ where: { roundId: parsed.roundId } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: parsed.clubId, targetId: parsed.roundId, action: "recruiting.rules.save", details: { before: round.screeningRule ? { minGpa: round.screeningRule.minGpa, minSat: round.screeningRule.minSat, minAct: round.screeningRule.minAct, revision: round.screeningRule.revision } : null, after: data } } })
    return rule
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  revalidatePath(`/club/${parsed.clubId}/workspace`)
  return saved
}

async function preview(tx: Prisma.TransactionClient, scope: z.infer<typeof ruleScopeSchema>, canIdentify: boolean) {
  const round = await scopedRound(tx, scope)
  if (!round.anonymousReview && !canIdentify) throw new Error("Applicant identity permission is required for this round.")
  if (!round.screeningRule) throw new Error("Save this round's rules before previewing.")
  const { minGpa, minSat, minAct, revision } = round.screeningRule
  const applications = await tx.application.findMany({
    where: { clubId: scope.clubId, roundId: scope.roundId, status: { in: ruleEligibleStatuses as ("SUBMITTED" | "IN_REVIEW" | "INTERVIEWING")[] } },
    select: { id: true, status: true, student: { select: { studentProfile: { select: { gpa: true, satScore: true, actScore: true } } } } },
    orderBy: { id: "asc" },
  })
  return buildRulePreview(scope, revision, { minGpa, minSat, minAct }, round.club.testRequirement, applications.map(app => ({ id: app.id, status: app.status, gpa: app.student.studentProfile?.gpa ?? null, satScore: app.student.studentProfile?.satScore ?? null, actScore: app.student.studentProfile?.actScore ?? null })))
}

export async function previewRecruitingRule(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input)
  const { membership } = await requireClubPermission(scope.clubId, ["recruitment.manage", "applications.review"])
  return prisma.$transaction(tx => preview(tx, scope, hasPermission(membership, "applicants.identify")), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}

export async function applyRecruitingRuleFlags(input: z.infer<typeof applyRuleSchema>) {
  const parsed = applyRuleSchema.parse(input)
  const { user, membership } = await requireClubPermission(parsed.clubId, ["recruitment.manage", "applications.review", "decisions.manage"])
  const result = await prisma.$transaction(async tx => {
    const fresh = await preview(tx, { clubId: parsed.clubId, roundId: parsed.roundId }, hasPermission(membership, "applicants.identify"))
    if (fresh.fingerprint !== parsed.fingerprint) throw new Error("Applicants or rules changed. Preview again before applying flags.")
    const matches = fresh.results.filter(result => result.outcome === "flag")
    await tx.recruitingRuleFlag.deleteMany({ where: { roundId: parsed.roundId } })
    if (matches.length) await tx.recruitingRuleFlag.createMany({ data: matches.map(result => ({ roundId: parsed.roundId, applicationId: result.id, ruleRevision: fresh.revision, reasons: result.reasons, flaggedBy: user.id })) })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: parsed.clubId, targetId: parsed.roundId, action: "recruiting.rules.flag", details: { revision: fresh.revision, fingerprint: fresh.fingerprint, applicationIds: matches.map(result => result.id) } } })
    return { flagged: matches.length }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  revalidatePath(`/club/${parsed.clubId}/workspace`)
  return result
}

export async function getRecruitingRuleFlags(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input)
  const { membership } = await requireClubPermission(scope.clubId, ["recruitment.manage", "applications.review"])
  const round = await scopedRound(prisma, scope)
  if (!round.anonymousReview && !hasPermission(membership, "applicants.identify")) throw new Error("Applicant identity permission is required for this round.")
  const flags = await prisma.recruitingRuleFlag.findMany({
    where: { roundId: scope.roundId, application: { clubId: scope.clubId, roundId: scope.roundId, status: { in: ruleEligibleStatuses as ("SUBMITTED" | "IN_REVIEW" | "INTERVIEWING")[] } } },
    select: { applicationId: true, ruleRevision: true, reasons: true, flaggedAt: true },
    orderBy: { applicationId: "asc" },
  })
  return flags.map(flag => ({ ...flag, label: ruleLabel(flag.applicationId) }))
}

export async function clearRecruitingRuleFlags(input: z.infer<typeof ruleScopeSchema>) {
  const scope = ruleScopeSchema.parse(input)
  const { user } = await requireClubPermission(scope.clubId, ["recruitment.manage", "applications.review", "decisions.manage"])
  await prisma.$transaction(async tx => {
    await scopedRound(tx, scope)
    await tx.recruitingRuleFlag.deleteMany({ where: { roundId: scope.roundId } })
    await tx.auditLog.create({ data: { actorId: user.id, clubId: scope.clubId, targetId: scope.roundId, action: "recruiting.rules.clear", details: { roundId: scope.roundId } } })
  })
  revalidatePath(`/club/${scope.clubId}/workspace`)
  return { success: true }
}
