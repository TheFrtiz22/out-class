"use server"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { createClient } from "@/utils/supabase/server"
import { freshAuthClient } from "@/utils/admin-elevation"
import { sendAccountDeletionEmail } from "@/utils/email"
import { performAccountDeletion } from "@/utils/account-deletion"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { providerAuthFailure } from "@/lib/admin-failure"
import { captchaFailed, turnstileMessage, withCaptcha } from "@/lib/turnstile"
import {
  ACCOUNT_DELETION_PASSWORD_ATTEMPTS,
  ACCOUNT_DELETION_REPORT_KIND,
  accountDeletionAudit,
  accountDeletionCancellable,
  accountDeletionConfirmationMatches,
  accountDeletionDue,
  accountDeletionDueAt,
  freshAuthentication,
} from "@/lib/account-deletion"

const OPEN = ["OPEN", "INVESTIGATING"]
const requestSchema = z.object({
  confirmation: z.string().max(320),
  password: z.string().min(1).max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
}).strict()

/** Demo Mode and administrator support sessions never reach a real account's deletion path. */
async function requireAccountHolder() {
  const jar = await cookies()
  if (jar.has(PLATFORM_VIEW_COOKIE)) throw Error("Support sessions can’t request or cancel account deletion.")
  if (jar.get(DEMO_COOKIE)?.value === "1") throw Error("Account deletion is unavailable in Demo Mode.")
  const auth = await requireAuth()
  if (auth.impersonation) throw Error("Support sessions can’t request or cancel account deletion.")
  return auth
}

function openRequest(userId: string) {
  return prisma.platformReport.findFirst({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, targetId: userId, status: { in: OPEN } }, orderBy: { createdAt: "desc" } })
}

/** The signed-in person's pending request, if any. */
export async function getAccountDeletionRequest() {
  const { user } = await requireAccountHolder()
  const row = await openRequest(user.id)
  return row ? { requestedAt: row.createdAt.toISOString(), scheduledFor: accountDeletionDueAt(row.createdAt).toISOString() } : null
}

/**
 * Fresh authentication: the password (verified on a throwaway Auth client, the
 * same pattern as the Admin password re-check) or a sign-in in the last 10 minutes.
 */
async function verifyFreshAuthentication(user: { id: string; email: string }, password: string | undefined, turnstileToken: string | undefined) {
  if (password) {
    const since = new Date(Date.now() - 15 * 60_000)
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
      if (await tx.auditLog.count({ where: { actorId: user.id, action: accountDeletionAudit.passwordAttempt, createdAt: { gte: since } } }) >= ACCOUNT_DELETION_PASSWORD_ATTEMPTS) throw Error("Too many attempts. Try again in 15 minutes.")
      await tx.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.passwordAttempt, targetId: user.id, details: { result: "attempt" } } })
    })
    const client = freshAuthClient()
    const signed = await client.auth.signInWithPassword(withCaptcha({ email: user.email, password }, turnstileToken))
    if (captchaFailed(signed.error)) throw Error(turnstileMessage("rejected"))
    if (signed.error && !providerAuthFailure(signed.error)) throw Error("Password verification is unavailable right now. Try again later.")
    if (signed.error || !signed.data.session || signed.data.user?.id !== user.id) throw Error("That password isn’t right.")
    // Close the verification session only; never sign the person out elsewhere.
    await client.auth.signOut({ scope: "local" }).catch(() => undefined)
    return "password"
  }
  const client = await createClient(await cookies())
  const { data, error } = await client.auth.getClaims()
  if (error || !freshAuthentication(data?.claims?.amr)) throw Error("For your security, sign out and sign back in, then delete your account within 10 minutes.")
  return "recent-sign-in"
}

export async function requestAccountDeletion(input: unknown) {
  const { user } = await requireAccountHolder()
  const d = requestSchema.parse(input)
  if (!accountDeletionConfirmationMatches(d.confirmation, user.email)) throw Error("Type your university email or DELETE to confirm.")
  const admin = await prisma.platformAdmin.findUnique({ where: { userId: user.id } })
  if (admin?.active) throw Error("Platform administrators must hand off administrator access before deleting their account.")
  const owned = await prisma.clubMember.findMany({ where: { userId: user.id, isOwner: true, status: "ACTIVE" }, select: { clubId: true, club: { select: { name: true } } } })
  for (const membership of owned) {
    const others = await prisma.clubMember.count({ where: { clubId: membership.clubId, userId: { not: user.id }, isOwner: true, status: "ACTIVE", user: { disabledAt: null } } })
    if (!others) throw Error(`Transfer ownership of ${membership.club.name} before deleting your account.`)
  }
  const method = await verifyFreshAuthentication(user, d.password, d.turnstileToken)

  const request = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
    const existing = await tx.platformReport.findFirst({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, targetId: user.id, status: { in: OPEN } } })
    if (existing) return { row: existing, created: false }
    const requestedAt = new Date(), scheduledFor = accountDeletionDueAt(requestedAt)
    // The Reports queue is the platform-admin notification path; no new table.
    const row = await tx.platformReport.create({ data: { kind: ACCOUNT_DELETION_REPORT_KIND, targetId: user.id, reporterId: user.id, summary: `Account deletion requested. Due ${scheduledFor.toISOString().slice(0, 10)}.`, createdAt: requestedAt } })
    await tx.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.requested, targetId: user.id, details: { reportId: row.id, scheduledFor: scheduledFor.toISOString(), verification: method, result: "success" } } })
    return { row, created: true }
  })
  const scheduledFor = accountDeletionDueAt(request.row.createdAt)
  let emailSent = !request.created
  if (request.created) {
    try {
      await sendAccountDeletionEmail({ recipient: user.email, scheduledFor, requestId: request.row.id })
      emailSent = true
    } catch {
      emailSent = false
    }
    await prisma.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.emailed, targetId: request.row.id, details: { result: emailSent ? "sent" : "failed" } } }).catch(() => undefined)
  }
  revalidatePath("/settings/account")
  return { requestedAt: request.row.createdAt.toISOString(), scheduledFor: scheduledFor.toISOString(), emailSent }
}

export async function cancelAccountDeletion() {
  const { user } = await requireAccountHolder()
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
    const row = await tx.platformReport.findFirst({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, targetId: user.id, status: { in: OPEN } } })
    if (!row) throw Error("There’s no pending deletion request.")
    if (!accountDeletionCancellable(row.createdAt)) throw Error("This request is past its 14-day window and can no longer be cancelled.")
    const updated = await tx.platformReport.updateMany({ where: { id: row.id, revision: row.revision }, data: { status: "DISMISSED", resolution: "Cancelled by the account holder.", resolvedAt: new Date(), resolvedBy: user.id, revision: { increment: 1 } } })
    if (!updated.count) throw Error("The request changed. Reload and try again.")
    await tx.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.cancelled, targetId: user.id, details: { reportId: row.id, result: "success" } } })
  })
  revalidatePath("/settings/account")
  return { cancelled: true }
}

/** Platform admin queue: pending requests with their due dates. */
export async function listAccountDeletionRequests() {
  const actor = await requirePlatformAdmin()
  const rows = await prisma.platformReport.findMany({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, status: { in: OPEN } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, targetId: true, revision: true, createdAt: true, status: true } })
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.account-deletions.read", targetId: "account-deletions", details: { result: "success", count: rows.length } } })
  const now = new Date()
  return rows.map(row => ({ id: row.id, userId: row.targetId, revision: row.revision, requestedAt: row.createdAt.toISOString(), dueAt: accountDeletionDueAt(row.createdAt).toISOString(), due: accountDeletionDue(row.createdAt, now) }))
}

const completeSchema = z.object({ id: z.string().uuid(), revision: z.number().int().min(0), reason: z.string().trim().min(10).max(1000) }).strict()
/** Fresh-admin only, after the grace period, audited. */
export async function completeAccountDeletion(input: unknown) {
  const actor = await requirePlatformAdmin({ fresh: true })
  const d = completeSchema.parse(input)
  const row = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "PlatformReport" WHERE id=${d.id} FOR UPDATE`
    const found = await tx.platformReport.findUnique({ where: { id: d.id } })
    if (!found || found.kind !== ACCOUNT_DELETION_REPORT_KIND || !OPEN.includes(found.status)) throw Error("This deletion request is no longer pending.")
    if (found.revision !== d.revision) throw Error("The request changed. Reload it before completing.")
    if (!accountDeletionDue(found.createdAt)) throw Error("The 14-day cancellation window hasn’t ended yet.")
    // Claim the request so a concurrent completion or a late cancel cannot interleave.
    await tx.platformReport.update({ where: { id: found.id }, data: { status: "INVESTIGATING", revision: { increment: 1 } } })
    await tx.auditLog.create({ data: { actorId: actor.id, action: "platform.account-deletion.start", targetId: found.targetId, reason: d.reason, details: { reportId: found.id, result: "started" } } })
    return found
  })
  const result = await performAccountDeletion(prisma, row.targetId, { actorId: actor.id, reportId: row.id, reason: d.reason })
  return result
}
