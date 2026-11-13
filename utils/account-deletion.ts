import { createClient as createAdminClient } from "@supabase/supabase-js"
import type { prisma } from "@/utils/prisma"
import {
  ACCOUNT_DELETION_REPORT_KIND,
  accountDeletionAudit,
  pendingApplicationStatuses,
  tombstoneEmail,
} from "@/lib/account-deletion"
import { FEEDBACK_SCREENSHOT_BUCKET, feedbackScreenshotFolder } from "@/lib/feedback-reports"

/** Storage and Auth side effects, injectable for tests. */
export type AccountDeletionServices = {
  listObjects(bucket: string, prefix: string): Promise<string[]>
  removeObjects(bucket: string, paths: string[]): Promise<void>
  deleteAuthUser(userId: string): Promise<void>
}

const PERSONAL_BUCKETS = ["resumes", "headshots"] as const

export function supabaseAccountDeletionServices(): AccountDeletionServices {
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw Error("Account deletion is unavailable right now.")
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "", secret, { auth: { persistSession: false, autoRefreshToken: false } })
  return {
    async listObjects(bucket, prefix) {
      const paths: string[] = []
      for (let offset = 0; offset < 10_000; offset += 1000) {
        const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset })
        if (error) throw Error(`Could not list ${bucket} objects.`)
        // Folder placeholders have no id; uploads are flat under the user's folder.
        paths.push(...(data || []).filter(item => item.id).map(item => `${prefix}/${item.name}`))
        if (!data || data.length < 1000) break
      }
      return paths
    },
    async removeObjects(bucket, paths) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100))
        if (error) throw Error(`Could not remove ${bucket} objects.`)
      }
    },
    async deleteAuthUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      // Already gone (an earlier, interrupted run) is success.
      if (error && (error as { status?: number }).status !== 404 && (error as { code?: string }).code !== "user_not_found") throw Error("Could not delete the sign-in account.")
    },
  }
}

/** The application client (with its audit extension); a plain PrismaClient type does not accept it. */
type Db = Pick<typeof prisma, "$transaction" | "user" | "taskFile" | "platformAdmin" | "platformReport" | "auditLog">

export type AccountDeletionResult = {
  userId: string
  storageObjects: number
  deletedApplications: number
  anonymizedApplications: number
  deletedMemberships: number
  anonymizedMemberships: number
  /** Published decision letters and interview résumé snapshots are immutable by DB trigger; a migration is needed to scrub them. */
  retainedDecisionLetters: number
  retainedResumeSnapshots: number
  authDeleted: boolean
}

export const OWNER_GUARD_MESSAGE = "This person is still the only active owner of a club. Transfer ownership, then complete the deletion."
/** The DB owner guards (outclass_owner_account_guard, membership guard) raise these. */
export function ownerGuardError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  return /Assign another active owner/.test(text)
}

const AUTH_DELETE_ATTEMPTS = 3

/**
 * Deletes a person's account data. Idempotent: every step tolerates an earlier
 * partial run, so an interrupted deletion is completed by running it again.
 *
 * Order: disable sign-in (requireAuth then never rewrites the email; the DB
 * owner guard refuses sole active owners), delete/anonymize rows in one
 * transaction, then remove Storage objects (so a rolled-back transaction never
 * leaves files missing), delete the Auth user with retries, then resolve the
 * request and audit. The User row stays as the anonymized tombstone.
 */
export async function performAccountDeletion(
  db: Db,
  userId: string,
  context: { actorId: string; reportId?: string; reason: string },
  services: AccountDeletionServices = supabaseAccountDeletionServices(),
): Promise<AccountDeletionResult> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, disabledAt: true } })
  if (!user) throw Error("Account not found.")
  const admin = await db.platformAdmin.findUnique({ where: { userId } })
  if (admin?.active) throw Error("Remove platform administrator access before deleting this account.")
  if (!user.disabledAt) await db.user.update({ where: { id: userId }, data: { disabledAt: new Date() } })

  // Task-file paths live only in rows deleted below; capture them and keep a
  // durable copy (no personal data: assignment-id paths) so a re-run can finish removal.
  const earlier = await db.auditLog.findMany({ where: { targetId: userId, action: accountDeletionAudit.storagePending }, select: { details: true } })
  const taskFiles = new Set<string>(earlier.flatMap(row => {
    const paths = (row.details as { taskFiles?: unknown } | null)?.taskFiles
    return Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string") : []
  }))
  for (const file of await db.taskFile.findMany({ where: { assignment: { userId } }, select: { path: true } })) taskFiles.add(file.path)

  const counts = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`
    if (taskFiles.size) await tx.auditLog.create({ data: { actorId: context.actorId, action: accountDeletionAudit.storagePending, targetId: userId, details: { taskFiles: [...taskFiles] } } })
    await tx.studentProfile.deleteMany({ where: { userId } })
    await tx.eventRsvp.deleteMany({ where: { userId } })
    await tx.savedCampusEvent.deleteMany({ where: { userId } })
    await tx.corkboardClub.deleteMany({ where: { userId } })
    await tx.userTutorial.deleteMany({ where: { userId } })
    await tx.userAvailability.deleteMany({ where: { userId } })
    await tx.editorDraft.deleteMany({ where: { userId } })
    await tx.calendarFeedToken.deleteMany({ where: { userId } })
    // Push endpoints go so the person's devices stop receiving notifications (deliveries cascade).
    await tx.webPushSubscription.deleteMany({ where: { userId } })
    await tx.recipientGroupEntry.deleteMany({ where: { userId } })
    // Notifications first: their outbox rows (cascade) reference the deliveries.
    await tx.userNotification.deleteMany({ where: { userId } })
    await tx.notificationEmailDelivery.deleteMany({ where: { userId } })
    await tx.userNotificationPreference.deleteMany({ where: { userId } })
    await tx.clubConversation.deleteMany({ where: { studentId: userId } })
    await tx.taskAssignment.deleteMany({ where: { userId } })
    await tx.clubTask.updateMany({ where: { assigneeId: userId }, data: { assigneeId: null } })
    await tx.clubClaim.deleteMany({ where: { userId, status: "PENDING" } })
    await tx.clubClaim.updateMany({ where: { userId }, data: { explanation: "" } })
    await tx.adminElevationChallenge.deleteMany({ where: { actorId: userId } })
    await tx.platformAdmin.deleteMany({ where: { userId, active: false } })
    await tx.rosterImportRow.updateMany({ where: { matchedUserId: userId }, data: { matchedUserId: null } })
    // Their issue/feedback reports stay as moderation history; the screenshot reference goes (objects below).
    await tx.$executeRaw`UPDATE "PlatformReport" SET "context" = "context" - 'screenshotPath' WHERE "reporterId" = ${userId} AND "context" ? 'screenshotPath'`

    // Applications: withdraw in-progress ones nothing depends on; anonymize the rest.
    // Kept rows keep the club's own evaluations, interview records and observations
    // (written by leaders); they reach the person only through studentId = tombstone.
    const applications = await tx.application.findMany({
      where: { studentId: userId },
      select: { id: true, status: true, recruitmentOffer: { select: { id: true } }, _count: { select: {
        evaluations: true, interviewRecords: true, votingCandidates: true, interviewAssignments: true,
        resumeDocuments: true, decisionLetters: true, observations: true,
      } } },
    })
    const removable = applications.filter(app => (pendingApplicationStatuses as readonly string[]).includes(app.status)
      && !app.recruitmentOffer && Object.values(app._count).every(count => count === 0)).map(app => app.id)
    const retained = applications.filter(app => !removable.includes(app.id))
    if (removable.length) await tx.application.deleteMany({ where: { id: { in: removable } } })
    if (retained.length) {
      const ids = retained.map(app => app.id)
      await tx.applicationAnswer.deleteMany({ where: { applicationId: { in: ids } } })
      await tx.application.updateMany({ where: { id: { in: ids } }, data: { anonymousReviewText: null } })
    }

    // Memberships: evaluations, interview records and ballots are immutable club records.
    const memberships = await tx.clubMember.findMany({ where: { userId }, select: { id: true, _count: { select: {
      evaluations: true, interviewRecords: true, interviewAssignments: true, resumeAnnotations: true,
      votingParticipants: true, availabilityOverrides: true,
    } } } })
    const freeMemberships = memberships.filter(m => Object.values(m._count).every(count => count === 0)).map(m => m.id)
    const keptMemberships = memberships.map(m => m.id).filter(id => !freeMemberships.includes(id))
    if (freeMemberships.length) await tx.clubMember.deleteMany({ where: { id: { in: freeMemberships } } })
    if (keptMemberships.length) await tx.clubMember.updateMany({ where: { id: { in: keptMemberships } }, data: {
      status: "LEFT", isOwner: false, accessRole: "MEMBER", permissions: [], groups: [], cohort: null, title: null,
      interviewOffices: [], interviewerEligible: null,
    } })

    await tx.user.update({ where: { id: userId }, data: { email: tombstoneEmail(userId), role: "STUDENT" } })
    return {
      deletedApplications: removable.length, anonymizedApplications: retained.length,
      deletedMemberships: freeMemberships.length, anonymizedMemberships: keptMemberships.length,
      retainedDecisionLetters: retained.reduce((sum, app) => sum + app._count.decisionLetters, 0),
      retainedResumeSnapshots: retained.reduce((sum, app) => sum + app._count.resumeDocuments, 0),
    }
  }, { timeout: 30_000 })

  // Storage only after the transaction commits.
  let storageObjects = 0
  for (const bucket of PERSONAL_BUCKETS) {
    const paths = await services.listObjects(bucket, userId)
    if (paths.length) await services.removeObjects(bucket, paths)
    storageObjects += paths.length
  }
  if (taskFiles.size) await services.removeObjects("task-submissions", [...taskFiles])
  storageObjects += taskFiles.size
  // Feedback screenshots live under the person's own reports/<userId> folder (attached or abandoned uploads).
  const screenshots = await services.listObjects(FEEDBACK_SCREENSHOT_BUCKET, feedbackScreenshotFolder(userId))
  if (screenshots.length) await services.removeObjects(FEEDBACK_SCREENSHOT_BUCKET, screenshots)
  storageObjects += screenshots.length

  let authDeleted = false
  for (let attempt = 0; attempt < AUTH_DELETE_ATTEMPTS && !authDeleted; attempt++) {
    try { await services.deleteAuthUser(userId); authDeleted = true } catch { /* retried; recorded below */ }
  }

  const result: AccountDeletionResult = { userId, storageObjects, ...counts, authDeleted }
  await db.$transaction(async tx => {
    if (authDeleted && context.reportId) await tx.platformReport.updateMany({
      where: { id: context.reportId, kind: ACCOUNT_DELETION_REPORT_KIND, status: { in: ["OPEN", "INVESTIGATING"] } },
      data: { status: "RESOLVED", resolution: context.reason, resolvedAt: new Date(), resolvedBy: context.actorId, revision: { increment: 1 } },
    })
    await tx.auditLog.create({ data: { actorId: context.actorId, action: authDeleted ? accountDeletionAudit.completed : accountDeletionAudit.incomplete, targetId: userId, reason: context.reason, details: { ...result, reportId: context.reportId ?? null, result: authDeleted ? "success" : "auth-delete-failed" } } })
  })
  return result
}
