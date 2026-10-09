import { revokeClubInvitations } from "@/utils/revoke-club-invitations";
import type { AppStatus } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { lockOperationalClub } from "@/lib/club-suspension";
import { assertRecruitmentTransition } from "@/lib/recruitment-lifecycle";

async function event(tx: AppTransactionClient, actorId: string, clubId: string, id: string, action: string, applicationId: string) {
  await tx.auditLog.create({ data: { actorId, clubId, targetId: id, action, details: { applicationId } } });
}
/** Caller must recheck decision capability inside this transaction before invoking.
 * All offer, decision and membership mutations share the Club serialization lock.
 */
export async function publishRecruitmentDecision(tx: AppTransactionClient, input: { clubId: string; applicationId: string; status: AppStatus; expectedStatus?: AppStatus; roundId?: string }, actorId: string) {
  await lockOperationalClub(tx, input.clubId);
  const app = await tx.application.findFirst({ where: { id: input.applicationId, clubId: input.clubId }, include: { round: true } });
  if (!app || input.roundId && input.roundId !== app.roundId || input.expectedStatus && input.expectedStatus !== app.status && input.status !== app.status)
    throw Error("Application changed. Refresh before deciding.");
  assertRecruitmentTransition(app.status, input.status, app.round.type);
  if (app.status !== input.status) await tx.application.update({ where: { id: app.id }, data: { status: input.status } });
  const existing = await tx.clubInvitation.findUnique({ where: { applicationId: app.id } });
  if (input.status === "ACCEPTED" && !existing) {
    const [club, student] = await Promise.all([
      tx.club.findUniqueOrThrow({ where: { id: input.clubId }, select: { schoolId: true } }),
      tx.user.findUniqueOrThrow({ where: { id: app.studentId }, select: { email: true } }),
    ]);
    const offer = await tx.clubInvitation.create({ data: {
      applicationId: app.id, clubId: app.clubId, schoolId: club.schoolId, email: student.email,
      invitedBy: actorId, requestedRole: "MEMBER", purpose: "MEMBERSHIP", authoritySource: "CLUB_MEMBER", permissions: [],
      expiresAt: new Date(Date.now() + 30 * 86400000),
    } });
    await event(tx, actorId, app.clubId, offer.id, "offer.created", app.id);
  } else if (input.status !== "ACCEPTED" && existing?.status === "PENDING") {
    await revokeClubInvitations(tx, { id: existing.id }, actorId, "recruitment.decision.reversal");
  }
  if (app.status !== input.status) await tx.auditLog.create({ data: { actorId, clubId: app.clubId, targetId: app.id, action: "recruitment.decision.published", details: { previousStatus: app.status, status: input.status, roundId: app.roundId } } });
  return { previousStatus: app.status };
}

/** Recipient comes exclusively from the linked application, never email or client input. */
export async function respondToRecruitmentOffer(tx: AppTransactionClient, applicationId: string, userId: string, response: "ACCEPT" | "DECLINE") {
  const hint = await tx.application.findFirst({ where: { id: applicationId, studentId: userId } });
  if (!hint) throw Error("Offer unavailable.");
  await lockOperationalClub(tx, hint.clubId);
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR SHARE`;
  const user = await tx.user.findUnique({ where: { id: userId } });
  const app = await tx.application.findFirst({ where: { id: applicationId, studentId: userId, clubId: hint.clubId } });
  const offer = await tx.clubInvitation.findUnique({ where: { applicationId } });
  if (!user || user.disabledAt || !app || !offer || offer.clubId !== app.clubId) throw Error("Offer unavailable.");
  const where = { userId_clubId: { userId, clubId: app.clubId } };
  const existing = await tx.clubMember.findUnique({ where });
  // Retries never reactivate a membership subsequently removed/suspended.
  if (response === "ACCEPT" && offer.status === "ACCEPTED" && offer.claimedUserId === userId) {
    if (existing?.status !== "ACTIVE") return { clubId: app.clubId, status: "INACTIVE_MEMBERSHIP" as const };
    return { clubId: app.clubId, status: "ACCEPTED" as const };
  }
  if (response === "DECLINE" && offer.status === "DECLINED") return { clubId: app.clubId, status: "DECLINED" as const };
  if (app.status !== "ACCEPTED" || offer.status !== "PENDING" || offer.expiresAt <= new Date() || offer.revokedAt || offer.acceptedAt || offer.declinedAt || offer.expiredAt)
    throw Error("Offer unavailable or expired. Refresh your status.");
  if (response === "DECLINE") {
    await tx.clubInvitation.update({ where: { id: offer.id }, data: { status: "DECLINED", declinedAt: new Date() } });
    await event(tx, userId, app.clubId, offer.id, "offer.declined", app.id);
    return { clubId: app.clubId, status: "DECLINED" as const };
  }
  if (existing && existing.status !== "ACTIVE") return { clubId: app.clubId, status: "INACTIVE_MEMBERSHIP" as const };
  if (!existing) await tx.clubMember.create({ data: { userId, clubId: app.clubId, accessRole: "MEMBER", role: "GENERAL_MEMBER", permissions: [], isOwner: false } });
  // Active existing members keep every role, permission and ownership field untouched.
  const now = new Date();
  await tx.clubInvitation.update({ where: { id: offer.id }, data: { status: "ACCEPTED", acceptedAt: now, claimedAt: now, claimedUserId: userId } });
  await event(tx, userId, app.clubId, offer.id, "offer.accepted", app.id);
  return { clubId: app.clubId, status: "ACCEPTED" as const };
}
