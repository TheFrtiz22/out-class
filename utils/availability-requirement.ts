import { isAlumniProfile } from "@/lib/graduation"
import { NO_REGULAR_AVAILABILITY_ACTION, type AvailabilityRequirementAccount } from "@/lib/availability-requirement"
import type { prisma } from "@/utils/prisma"

type Db = Pick<typeof prisma, "$queryRaw">
type Row = { disabled: boolean; platformAdmin: boolean; onboarded: boolean; graduatedAt: Date | string | null; hasAvailability: boolean; declaredNone: boolean }

/**
 * The account facts the availability requirement needs, in one SQL statement. The schedule JSON never
 * leaves the database: "has an available time" is the SQL form of scheduleHasAvailability (a submitted
 * recurring week with a non-empty day, or any specific date with a range), and the declaration is an
 * existence check on the student's own audit row (AuditLog targetId/action index).
 */
export async function loadAvailabilityRequirement(db: Db, userId: string, now: Date | number = Date.now()): Promise<AvailabilityRequirementAccount | null> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT u."disabledAt" IS NOT NULL AS "disabled",
      COALESCE(pa.active, false) AS "platformAdmin",
      sp."userId" IS NOT NULL AS "onboarded",
      sp."graduatedAt" AS "graduatedAt",
      COALESCE(
        (jsonb_typeof(ua.schedule->'weekly') = 'array' AND ua.schedule->>'weeklySubmitted' = 'true'
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(ua.schedule->'weekly') AS day(ranges) WHERE jsonb_typeof(day.ranges) = 'array' AND jsonb_array_length(day.ranges) > 0))
        OR (jsonb_typeof(ua.schedule->'exceptions') = 'object'
          AND EXISTS (SELECT 1 FROM jsonb_each(ua.schedule->'exceptions') AS dated(day, ranges) WHERE jsonb_typeof(dated.ranges) = 'array' AND jsonb_array_length(dated.ranges) > 0)),
        false) AS "hasAvailability",
      EXISTS (SELECT 1 FROM "AuditLog" al WHERE al."targetId" = u.id AND al.action = ${NO_REGULAR_AVAILABILITY_ACTION} AND al."actorId" = u.id) AS "declaredNone"
    FROM "User" u
    LEFT JOIN "PlatformAdmin" pa ON pa."userId" = u.id
    LEFT JOIN "StudentProfile" sp ON sp."userId" = u.id
    LEFT JOIN "UserAvailability" ua ON ua."userId" = u.id
    WHERE u.id = ${userId}`
  const row = rows[0]
  if (!row) return null
  return {
    disabled: !!row.disabled,
    platformAdmin: !!row.platformAdmin,
    alumni: isAlumniProfile(row.graduatedAt ? { graduatedAt: new Date(row.graduatedAt) } : null, now),
    onboarded: !!row.onboarded,
    hasAvailability: !!row.hasAvailability,
    declaredNone: !!row.declaredNone,
  }
}
