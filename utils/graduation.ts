import type { AppTransactionClient } from "@/utils/prisma"
import { graduationDefaultAt, graduationYearChange, lastDefaultedGradYear } from "@/lib/graduation"
import { ActionError } from "@/lib/action-result"

/** Audit actor for scheduled lifecycle changes; not a User id. */
export const GRADUATION_JOB_ACTOR = "system:graduation"
const MAX_YEARS_PER_RUN = 20

type RawClient = Pick<AppTransactionClient, "$queryRaw" | "$executeRaw">
export type GraduationJobDb = RawClient & { $transaction<T>(work: (tx: RawClient) => Promise<T>): Promise<T> }

// Timestamps are passed as ISO text and converted to UTC wall time explicitly, so the stored
// TIMESTAMP(3) values match Prisma's UTC convention whatever the session time zone is.
const iso = (value: Date) => value.toISOString()

/**
 * Daily graduation default (app/api/internal/graduation). Idempotent and batched:
 * 1. Profiles with no graduatedAt whose gradYear's Aug 1 (America/New_York) has passed get
 *    graduatedAt = that Aug 1. Students who answered "Yes" already have it.
 * 2. ACTIVE memberships of graduated students (graduatedAt <= now) get alumniSince = graduatedAt,
 *    except an owner who would leave the club without another current owner who is not also
 *    graduating; that membership is retained (counted, not changed) until the club adds an owner.
 * Every change writes one AuditLog row. Sends nothing.
 */
export async function runGraduationJob(db: GraduationJobDb, now = new Date(), limits = { profiles: 500, memberships: 500, deadline: Number.POSITIVE_INFINITY }) {
  const result = { graduated: 0, alumniMemberships: 0, retainedOwners: 0, more: false }
  const lastYear = lastDefaultedGradYear(now)
  const years = await db.$queryRaw<{ gradYear: number }[]>`
    SELECT DISTINCT "gradYear" FROM "StudentProfile"
    WHERE "graduatedAt" IS NULL AND "gradYear" <= ${lastYear}
    ORDER BY "gradYear" LIMIT ${MAX_YEARS_PER_RUN}`
  for (const { gradYear } of years) {
    const remaining = limits.profiles - result.graduated
    if (remaining <= 0 || Date.now() > limits.deadline) { result.more = true; break }
    const at = iso(graduationDefaultAt(gradYear))
    const rows = await db.$transaction(async tx => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "StudentProfile" SET "graduatedAt" = (${at}::timestamptz AT TIME ZONE 'UTC')
        WHERE id IN (SELECT id FROM "StudentProfile" WHERE "graduatedAt" IS NULL AND "gradYear" = ${gradYear}
          ORDER BY id LIMIT ${remaining} FOR UPDATE SKIP LOCKED)
        RETURNING id`
      if (rows.length) await tx.$executeRaw`
        INSERT INTO "AuditLog"(id, "actorId", action, "targetId", details)
        SELECT gen_random_uuid()::text, ${GRADUATION_JOB_ACTOR}, 'student.graduation.default', t.id,
          jsonb_build_object('gradYear', ${gradYear}::int, 'graduatedAt', ${at}::text)
        FROM unnest(${rows.map(r => r.id)}::text[]) AS t(id)`
      return rows
    })
    result.graduated += rows.length
    if (rows.length === remaining) result.more = true
  }
  if (years.length === MAX_YEARS_PER_RUN) result.more = true

  const at = iso(now)
  const clubs = await db.$queryRaw<{ clubId: string }[]>`
    SELECT DISTINCT m."clubId" FROM "ClubMember" m JOIN "StudentProfile" p ON p."userId" = m."userId"
    WHERE m.status = 'ACTIVE' AND m."alumniSince" IS NULL AND p."graduatedAt" <= (${at}::timestamptz AT TIME ZONE 'UTC')
    ORDER BY m."clubId" LIMIT ${limits.memberships}`
  for (const { clubId } of clubs) {
    const remaining = limits.memberships - result.alumniMemberships
    if (remaining <= 0 || Date.now() > limits.deadline) { result.more = true; break }
    const rows = await db.$transaction(async tx => {
      // Membership changes take the club row exclusively, like every other roster change. An owner
      // stays current when no other current, enabled owner who is not also graduating remains.
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`
      const rows = await tx.$queryRaw<{ id: string; alumniSince: Date }[]>`
        UPDATE "ClubMember" m SET "alumniSince" = p."graduatedAt", "updatedAt" = (${at}::timestamptz AT TIME ZONE 'UTC')
        FROM "StudentProfile" p
        WHERE p."userId" = m."userId" AND m.id IN (
          SELECT c.id FROM "ClubMember" c JOIN "StudentProfile" cp ON cp."userId" = c."userId"
          WHERE c."clubId" = ${clubId} AND c.status = 'ACTIVE' AND c."alumniSince" IS NULL
            AND cp."graduatedAt" <= (${at}::timestamptz AT TIME ZONE 'UTC')
            AND NOT (c."isOwner" AND NOT EXISTS (
              SELECT 1 FROM "ClubMember" o JOIN "User" ou ON ou.id = o."userId" LEFT JOIN "StudentProfile" op ON op."userId" = o."userId"
              WHERE o."clubId" = c."clubId" AND o.id <> c.id AND o."isOwner" AND o.status = 'ACTIVE' AND o."alumniSince" IS NULL
                AND ou."disabledAt" IS NULL AND (op."graduatedAt" IS NULL OR op."graduatedAt" > (${at}::timestamptz AT TIME ZONE 'UTC'))))
          -- The profile is taken FOR SHARE (members are already serialized by the club lock above), so
          -- a concurrent graduation-year save (which holds the profile FOR UPDATE) finishes first and
          -- the graduatedAt condition is re-checked against its result: a restored student is skipped.
          ORDER BY c.id LIMIT ${remaining} FOR SHARE OF cp)
        RETURNING m.id, m."alumniSince"`
      if (rows.length) await tx.$executeRaw`
        INSERT INTO "AuditLog"(id, "actorId", action, "clubId", "targetId", details)
        SELECT gen_random_uuid()::text, ${GRADUATION_JOB_ACTOR}, 'club.member.alumni', ${clubId}, t.id, jsonb_build_object('source', 'graduation')
        FROM unnest(${rows.map(r => r.id)}::text[]) AS t(id)`
      return rows
    })
    result.alumniMemberships += rows.length
    if (rows.length === remaining) result.more = true
  }
  if (clubs.length === limits.memberships) result.more = true
  const [retained] = await db.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count FROM "ClubMember" m JOIN "StudentProfile" p ON p."userId" = m."userId"
    WHERE m.status = 'ACTIVE' AND m."alumniSince" IS NULL AND m."isOwner" AND p."graduatedAt" <= (${at}::timestamptz AT TIME ZONE 'UTC')`
  result.retainedOwners = retained?.count ?? 0
  return result
}

/** Thrown when a support (view-as) session tries to change the graduation year. */
export const SUPPORT_YEAR_CHANGE_MESSAGE = "Only the account holder can change their graduation year."

/**
 * Applies a gradYear change inside the caller's profile transaction (lib/graduation.ts
 * graduationYearChange). Locks the User row, then the profile row, before reading, so it serializes
 * with the daily job (which takes the profile FOR SHARE before converting memberships): the job
 * either sees the restored profile and skips it, or finished first and is undone here.
 *
 * A restored student's memberships lose exactly the alumniSince the job gave them (equal to their
 * graduatedAt) and come back as plain current members: owner, access role, permissions, offices,
 * title and interviewer eligibility are cleared, so a returning leader needs a current leader to
 * re-grant them. A support session may not change the year at all.
 */
export async function applyGraduationYearChange(tx: Pick<AppTransactionClient, "$queryRaw" | "studentProfile" | "clubMember" | "auditLog">, userId: string, nextYear: number, options: { supportSession?: boolean; now?: Date } = {}) {
  const now = options.now ?? new Date()
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
  await tx.$queryRaw`SELECT id FROM "StudentProfile" WHERE "userId" = ${userId} FOR UPDATE`
  const current = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true, gradYear: true, graduatedAt: true, graduationConfirmedAt: true, graduationPromptDismissedAt: true } })
  if (!current || current.gradYear === nextYear) return null
  if (options.supportSession) throw new ActionError(SUPPORT_YEAR_CHANGE_MESSAGE, "FORBIDDEN")
  const change = graduationYearChange(current, nextYear, now)
  if (!change) return null
  await tx.studentProfile.update({ where: { id: current.id }, data: change.data })
  if (change.restoreAlumniSince) {
    const where = { userId, status: "ACTIVE" as const, alumniSince: change.restoreAlumniSince }
    const before = await tx.clubMember.findMany({ where, select: { id: true, clubId: true, isOwner: true, accessRole: true, permissions: true, interviewOffices: true } })
    const restored = await tx.clubMember.updateMany({ where: { ...where, id: { in: before.map(m => m.id) } }, data: { alumniSince: null, ...RESTORED_MEMBER } })
    await tx.auditLog.create({ data: { actorId: userId, targetId: current.id, action: "student.graduation.reverse", details: { fromYear: current.gradYear, toYear: nextYear, memberships: restored.count, before, after: RESTORED_MEMBER } } })
  }
  return change
}

/** What a restored membership becomes: a current member with no leadership. */
export const RESTORED_MEMBER = { isOwner: false, accessRole: "MEMBER" as const, role: "GENERAL_MEMBER" as const, permissions: [] as string[], interviewOffices: [] as string[], title: null, interviewerEligible: null }
