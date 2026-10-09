import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";

/** Caller holds the Club UPDATE lock. Audit only the first effective revocation.
 * Existing unlinked invitation mutations retain their caller's selection semantics.
 */
export async function revokeClubInvitations(tx: AppTransactionClient, where: Prisma.ClubInvitationWhereInput, actorId: string, reason: string, timestampOnly = false) {
  const linked = await tx.clubInvitation.findMany({
    where: { AND: [where, { applicationId: { not: null }, status: "PENDING", revokedAt: null, acceptedAt: null, declinedAt: null }] },
    select: { id: true, clubId: true, applicationId: true, application: { select: { studentId: true } } },
  });
  const result = await tx.clubInvitation.updateMany({ where, data: { revokedAt: new Date(), ...(!timestampOnly ? { status: "REVOKED" as const } : {}) } });
  if (timestampOnly && linked.length) await tx.clubInvitation.updateMany({ where: { id: { in: linked.map(o => o.id) } }, data: { status: "REVOKED" } });
  for (const offer of linked) await tx.auditLog.create({ data: {
    actorId, clubId: offer.clubId, targetId: offer.id, action: "offer.revoked", reason,
    details: { applicationId: offer.applicationId, studentId: offer.application!.studentId },
  } });
  return result;
}
