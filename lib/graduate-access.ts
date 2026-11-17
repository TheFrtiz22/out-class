import type { AppTransactionClient } from "@/utils/prisma"
import { ActionError } from "@/lib/action-result"
import { ALUMNI_REFUSALS, ALUMNI_REFUSED, isAlumniProfile } from "@/lib/graduation"
import { HAND_OVER_PERMISSIONS, isActiveMembership, type ClubAccess, type ClubPermission } from "@/lib/permissions"

type Db = Pick<AppTransactionClient, "$queryRaw">
type Member = ClubAccess & { userId: string; interviewerEligible?: boolean | null }
/** The membership as the shared checks return it: marked handOverOnly for a graduate. */
export type GraduateMarked<T> = T & { handOverOnly?: boolean }

/** A current membership that carries any club capability (owner, permissions, an interview office or interviewer eligibility). */
const holdsCapabilities = (member: ClubAccess & { interviewerEligible?: boolean | null }) =>
  member.isOwner === true || !!member.permissions?.length || !!member.interviewOffices?.length || member.interviewerEligible === true

/**
 * Marks a graduate whose membership is still current (an owner the graduation job kept so the club
 * is not left without one, or a leader before the job runs) as handOverOnly (lib/permissions.ts):
 * hasPermission, interviewCapabilities and the organization checks then allow only handing the club
 * to a current member. Reads the member's own graduation date, and only for a member who holds a
 * capability, so plain members add no query. Returns the same object when nothing changes.
 */
export async function graduateClubAccess<T extends Member>(db: Db, member: T, now = new Date()): Promise<GraduateMarked<T>> {
  if (member.handOverOnly || !isActiveMembership(member) || !holdsCapabilities(member)) return member
  const rows = await db.$queryRaw<{ graduatedAt: Date | null }[]>`SELECT "graduatedAt" FROM "StudentProfile" WHERE "userId" = ${member.userId}`
  return isAlumniProfile(rows[0], now) ? { ...member, handOverOnly: true } : member
}
export async function graduateClubAccessOrNull<T extends Member>(db: Db, member: T | null | undefined, now = new Date()): Promise<GraduateMarked<T> | null> {
  return member ? graduateClubAccess(db, member, now) : null
}

/** Refuses a handOverOnly member any requested permission other than the hand-over ones. */
export function assertGraduateMayUse(member: ClubAccess, permissions: readonly ClubPermission[]) {
  if (member.handOverOnly && permissions.some(p => !HAND_OVER_PERMISSIONS.includes(p)))
    throw new ActionError(ALUMNI_REFUSALS.manage, ALUMNI_REFUSED)
}

/** Refuses a handOverOnly member a club operation that a plain membership check let through. */
export function assertGraduateMayOperate(member: ClubAccess | null | undefined) {
  if (member?.handOverOnly) throw new ActionError(ALUMNI_REFUSALS.manage, ALUMNI_REFUSED)
}

/** The shared permission checks' step: mark the member, then refuse anything beyond hand-over. */
export async function graduateMemberFor<T extends Member>(db: Db, member: T, permissions: readonly ClubPermission[], now = new Date()): Promise<GraduateMarked<T>> {
  const marked = await graduateClubAccess(db, member, now)
  assertGraduateMayUse(marked, permissions)
  return marked
}
