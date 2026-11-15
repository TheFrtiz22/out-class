"use server"
import { createHash } from "node:crypto"
import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/auth"
import { requirePlatformAdmin } from "@/utils/platform-admin"
import { createClient } from "@/utils/supabase/server"
import { freshAuthClient } from "@/utils/admin-elevation"
import { sendAccountDeletionEmail } from "@/utils/email"
import { OWNER_GUARD_MESSAGE, ownerGuardError, performAccountDeletion } from "@/utils/account-deletion"
import { PLATFORM_VIEW_COOKIE } from "@/lib/platform-view-as"
import { DEMO_COOKIE } from "@/lib/demo/access"
import { providerAuthFailure } from "@/lib/admin-failure"
import { captchaFailed, turnstileMessage, turnstileRemoteIp, withCaptcha } from "@/lib/turnstile"
import { activeMemberWhere, hasPermission } from "@/lib/permissions"
import {
  ACCOUNT_DELETION_IP_ATTEMPTS,
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

/** Same rule as the Settings page: an "email" identity means the account has a password. */
function hasPassword(supabaseUser: { app_metadata?: Record<string, unknown> }) {
  const meta = supabaseUser.app_metadata || {}
  return Array.isArray(meta.providers) ? meta.providers.includes("email") : meta.provider === "email"
}

async function emailStatus(reportIds: string[]) {
  if (!reportIds.length) return new Map<string, boolean>()
  const rows = await prisma.auditLog.findMany({ where: { action: accountDeletionAudit.emailed, targetId: { in: reportIds } }, orderBy: { createdAt: "asc" }, select: { targetId: true, details: true } })
  return new Map(rows.map(row => [row.targetId, (row.details as { result?: string } | null)?.result === "sent"]))
}

/** Clubs where leaving would remove the only holder of a key role. Never blocks the request. */
async function leadershipWarnings(userId: string) {
  const mine = await prisma.clubMember.findMany({ where: { userId, ...activeMemberWhere }, select: { clubId: true, role: true, isOwner: true, permissions: true, status: true, club: { select: { name: true } } } })
  const warnings: string[] = []
  for (const member of mine) {
    const holds = { decisions: hasPermission(member, "decisions.start"), president: member.role === "PRESIDENT", lead: member.role === "RECRUITMENT_LEAD" }
    if (!holds.decisions && !holds.president && !holds.lead) continue
    const others = await prisma.clubMember.findMany({ where: { clubId: member.clubId, userId: { not: userId }, ...activeMemberWhere, user: { disabledAt: null } }, select: { role: true, isOwner: true, permissions: true, status: true } })
    const lost = [
      holds.decisions && !others.some(o => hasPermission(o, "decisions.start")) && "starting decisions",
      holds.president && !others.some(o => o.role === "PRESIDENT") && "president",
      holds.lead && !others.some(o => o.role === "RECRUITMENT_LEAD") && "recruitment lead",
    ].filter(Boolean)
    if (lost.length) warnings.push(`You’re the only ${lost.join(", ")} in ${member.club.name}. Hand that off so the club isn’t stuck.`)
  }
  return warnings
}

function openRequest(userId: string) {
  return prisma.platformReport.findFirst({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, targetId: userId, status: { in: OPEN } }, orderBy: { createdAt: "desc" } })
}

/** The signed-in person's pending request (with email status) and non-blocking leadership warnings. */
export async function getAccountDeletionRequest() {
  const { user } = await requireAccountHolder()
  const row = await openRequest(user.id)
  const warnings = await leadershipWarnings(user.id)
  if (!row) return { pending: null, warnings }
  const sent = (await emailStatus([row.id])).get(row.id)
  return { pending: { requestedAt: row.createdAt.toISOString(), scheduledFor: accountDeletionDueAt(row.createdAt).toISOString(), emailSent: sent !== false }, warnings }
}

/**
 * Accounts with a password always re-enter it (verified on a throwaway Auth client,
 * as in the Admin password re-check). University sign-in only accounts have no
 * password, so they need a sign-in in the last 10 minutes.
 */
async function verifyFreshAuthentication(user: { id: string; email: string }, passwordAccount: boolean, password: string | undefined, turnstileToken: string | undefined) {
  if (passwordAccount) {
    if (!password) throw Error("Enter your current password.")
    const since = new Date(Date.now() - 15 * 60_000)
    const ip = turnstileRemoteIp((await headers()).get("x-forwarded-for"))
    // Only a hash is stored; it serves the per-IP limit and nothing else.
    const ipHash = ip ? createHash("sha256").update("outclass-account-deletion\0" + ip).digest("hex") : null
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`
      if (await tx.auditLog.count({ where: { actorId: user.id, action: accountDeletionAudit.passwordAttempt, createdAt: { gte: since } } }) >= ACCOUNT_DELETION_PASSWORD_ATTEMPTS) throw Error("Too many attempts. Try again in 15 minutes.")
      if (ipHash && await tx.auditLog.count({ where: { action: accountDeletionAudit.passwordAttempt, createdAt: { gte: since }, details: { path: ["ipHash"], equals: ipHash } } }) >= ACCOUNT_DELETION_IP_ATTEMPTS) throw Error("Too many attempts from this network. Try again in 15 minutes.")
      await tx.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.passwordAttempt, targetId: user.id, details: { result: "attempt", ipHash } } })
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

/** Refuse when the person is a club's sole active owner, or every other owner is also leaving. */
async function assertOwnershipCovered(userId: string) {
  // An alumni owner holds no capabilities; their leaving cannot strand the club.
  const owned = await prisma.clubMember.findMany({ where: { userId, isOwner: true, ...activeMemberWhere }, select: { clubId: true, club: { select: { name: true } } } })
  for (const membership of owned) {
    const others = await prisma.clubMember.findMany({ where: { clubId: membership.clubId, userId: { not: userId }, isOwner: true, ...activeMemberWhere, user: { disabledAt: null } }, select: { userId: true } })
    if (!others.length) throw Error(`Transfer ownership of ${membership.club.name} before deleting your account.`)
    const leaving = await prisma.platformReport.count({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, status: { in: OPEN }, targetId: { in: others.map(o => o.userId) } } })
    if (leaving >= others.length) throw Error(`The other owner of ${membership.club.name} has also asked to delete their account. Add another owner before deleting yours.`)
  }
}

export async function requestAccountDeletion(input: unknown) {
  const { user, supabaseUser } = await requireAccountHolder()
  const d = requestSchema.parse(input)
  if (!accountDeletionConfirmationMatches(d.confirmation, user.email)) throw Error("Type your university email or DELETE to confirm.")
  const admin = await prisma.platformAdmin.findUnique({ where: { userId: user.id } })
  if (admin?.active) throw Error("Platform administrators must hand off administrator access before deleting their account.")
  await assertOwnershipCovered(user.id)
  const method = await verifyFreshAuthentication(user, hasPassword(supabaseUser as { app_metadata?: Record<string, unknown> }), d.password, d.turnstileToken)

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
  let emailSent: boolean
  if (request.created) {
    try {
      await sendAccountDeletionEmail({ recipient: user.email, scheduledFor, requestId: request.row.id })
      emailSent = true
    } catch {
      emailSent = false
    }
    await prisma.auditLog.create({ data: { actorId: user.id, action: accountDeletionAudit.emailed, targetId: request.row.id, details: { result: emailSent ? "sent" : "failed" } } }).catch(() => undefined)
  } else {
    emailSent = (await emailStatus([request.row.id])).get(request.row.id) !== false
  }
  revalidatePath("/settings/account")
  return { requestedAt: request.row.createdAt.toISOString(), scheduledFor: scheduledFor.toISOString(), emailSent, warnings: await leadershipWarnings(user.id) }
}

/**
 * Signed-in only, no re-authentication: cancelling restores the status quo, so a
 * stolen session gains nothing by it (docs/account-deletion.md).
 */
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

/** Platform admin queue: pending requests with their due dates and confirmation-email status. */
export async function listAccountDeletionRequests() {
  const actor = await requirePlatformAdmin()
  const rows = await prisma.platformReport.findMany({ where: { kind: ACCOUNT_DELETION_REPORT_KIND, status: { in: OPEN } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, targetId: true, revision: true, createdAt: true, status: true } })
  const sent = await emailStatus(rows.map(row => row.id))
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "platform.account-deletions.read", targetId: "account-deletions", details: { result: "success", count: rows.length } } })
  const now = new Date()
  return rows.map(row => ({ id: row.id, userId: row.targetId, revision: row.revision, status: row.status, requestedAt: row.createdAt.toISOString(), dueAt: accountDeletionDueAt(row.createdAt).toISOString(), due: accountDeletionDue(row.createdAt, now), emailSent: sent.get(row.id) ?? null }))
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
  let result
  try {
    result = await performAccountDeletion(prisma, row.targetId, { actorId: actor.id, reportId: row.id, reason: d.reason })
  } catch (error) {
    if (ownerGuardError(error)) throw Error(OWNER_GUARD_MESSAGE)
    throw error
  }
  if (!result.authDeleted) throw Error("Personal data was deleted, but the sign-in account couldn’t be. Run Complete deletion again.")
  return result
}
