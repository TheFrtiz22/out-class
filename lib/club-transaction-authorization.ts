import type { AppTransactionClient } from "@/utils/prisma";
import { assertClubOperational } from "@/lib/club-suspension";
import { hasPermission, isActiveMembership, type ClubPermission } from "@/lib/permissions";

/** Recheck live grants after waiting on the club serialization lock. */
export async function authorizeClubTransaction(
  tx: AppTransactionClient, clubId: string, userId: string,
  permissions: readonly ClubPermission[],
  // sharedClubLock: a write that serializes on its own narrower row (e.g. a voting
  // session) and needs only protection from club-wide changes (membership,
  // permissions, suspension), which all take the club row exclusively.
  options: { allowSuspendedRead?: boolean; readOnly?: boolean; sharedClubLock?: boolean } = {},
) {
  if (options.readOnly || options.sharedClubLock) await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR SHARE`;
  else await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${clubId} FOR UPDATE`;
  // Hold identity and membership against concurrent disable/revocation until commit.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM "ClubMember" WHERE "clubId"=${clubId} AND "userId"=${userId} FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const member = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  if (!user || user.disabledAt || !isActiveMembership(member) || !permissions.every(p => hasPermission(member, p)))
    throw new Error("Club access denied. Membership or permissions changed.");
  if (!options.allowSuspendedRead) await assertClubOperational(tx, clubId);
  return member!;
}
