import { parseSchedule } from "@/lib/availability"
import { isAlumniProfile } from "@/lib/graduation"
import { NO_REGULAR_AVAILABILITY_ACTION, availabilityRequirementExempt, scheduleHasAvailability, type AvailabilityRequirementAccount } from "@/lib/availability-requirement"
import type { prisma } from "@/utils/prisma"

type Db = Pick<typeof prisma, "user" | "auditLog">

/** The account facts the availability requirement needs, in one read (plus one when it would otherwise ask). */
export async function loadAvailabilityRequirement(db: Db, userId: string, now: Date | number = Date.now()): Promise<AvailabilityRequirementAccount | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: {
    disabledAt: true,
    platformAdmin: { select: { active: true } },
    studentProfile: { select: { graduatedAt: true } },
    availability: { select: { schedule: true, revision: true } },
  } })
  if (!user) return null
  let schedule: AvailabilityRequirementAccount["schedule"] = null
  try { schedule = user.availability ? parseSchedule(user.availability.schedule) : null } catch { schedule = null }
  const account = { disabled: !!user.disabledAt, platformAdmin: !!user.platformAdmin?.active, alumni: isAlumniProfile(user.studentProfile, now), onboarded: !!user.studentProfile, schedule, declaredNone: false, revision: user.availability?.revision ?? 0 }
  // The declaration matters only when the gate would otherwise ask.
  if (account.onboarded && !availabilityRequirementExempt(account) && !scheduleHasAvailability(schedule)) account.declaredNone = !!await db.auditLog.findFirst({ where: { targetId: userId, actorId: userId, action: NO_REGULAR_AVAILABILITY_ACTION }, select: { id: true } })
  return account
}
