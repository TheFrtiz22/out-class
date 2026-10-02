import { randomUUID } from 'node:crypto';
import { prisma, type AppTransactionClient } from '@/utils/prisma';
import { canManageOrganizationInvitation } from '@/lib/organization-authorization';
import { invitationEmailConfig, sendInvitationEmail } from '@/utils/email';

export const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;
export const EMAIL_HOURLY_LIMIT = 1000;

export async function deliveryActor(tx: AppTransactionClient, clubId: string, userId: string) {
  const account = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  if (!account || account.disabledAt || !actor || !canManageOrganizationInvitation(actor, { requestedRole: 'MEMBER', permissions: [] })) throw new Error('Invitation sending access denied.');
  return actor;
}

export async function enqueueInvitationEmail(tx: AppTransactionClient, invitationId: string, clubId: string, userId: string, key: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const actor = await deliveryActor(tx, clubId, userId);
  const existing = await tx.invitationDelivery.findUnique({ where: { idempotencyKey: key } });
  if (existing) return { queued: false, reused: true };
  const invitation = await tx.clubInvitation.findFirst({ where: { id: invitationId, clubId } });
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.acceptedAt || invitation.revokedAt || invitation.declinedAt || !canManageOrganizationInvitation(actor, invitation)) throw new Error('Invitation unavailable or above your authority.');
  const pending = await tx.invitationDelivery.findFirst({ where: { invitationId, status: { in: ['QUEUED', 'SENDING'] } } });
  if (pending) return { queued: false, reused: true };
  const recent = await tx.invitationDelivery.findFirst({ where: { invitationId, createdAt: { gt: new Date(Date.now() - EMAIL_COOLDOWN_MS) }, status: { not: 'CANCELLED' } } });
  if (recent || invitation.lastEmailSentAt && invitation.lastEmailSentAt > new Date(Date.now() - EMAIL_COOLDOWN_MS)) throw new Error('Wait 15 minutes before sending this invitation again.');
  const since = new Date(Date.now() - 3600000);
  const [senderCount, clubCount] = await Promise.all([
    tx.invitationDelivery.count({ where: { requestedById: userId, createdAt: { gt: since } } }),
    tx.invitationDelivery.count({ where: { invitation: { clubId }, createdAt: { gt: since } } }),
  ]);
  if (senderCount >= EMAIL_HOURLY_LIMIT || clubCount >= EMAIL_HOURLY_LIMIT) throw new Error('Hourly invitation email limit reached. Try later.');
  await tx.invitationDelivery.create({ data: { invitationId, requestedById: userId, recipientEmail: invitation.email, idempotencyKey: key || randomUUID() } });
  return { queued: true, reused: false };
}

async function eligible(tx: AppTransactionClient, deliveryId: string) {
  const delivery = await tx.invitationDelivery.findUniqueOrThrow({ where: { id: deliveryId }, include: { invitation: { include: { club: true, schoolIdentity: { include: { identifierType: true } } } } } });
  const invitation = delivery.invitation;
  if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.acceptedAt || invitation.revokedAt || invitation.declinedAt || delivery.recipientEmail !== invitation.email) return null;
  const requester = await deliveryActor(tx, invitation.clubId, delivery.requestedById).catch(() => null);
  if (!requester || !canManageOrganizationInvitation(requester, invitation)) return null;
  const inviterAccount = await tx.user.findUnique({ where: { id: invitation.invitedBy }, select: { disabledAt: true } });
  if (!inviterAccount || inviterAccount.disabledAt) return null;
  if (invitation.authoritySource === 'PLATFORM_ADMIN') {
    const grant = await tx.platformAdmin.findUnique({ where: { userId: invitation.invitedBy } });
    if (!grant?.active || !(process.env.OUTCLASS_PLATFORM_ADMIN_IDS || '').split(',').map(s => s.trim()).includes(invitation.invitedBy)) return null;
  } else {
    const inviter = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: invitation.invitedBy, clubId: invitation.clubId } } });
    if (!canManageOrganizationInvitation(inviter, invitation)) return null;
  }
  if (invitation.schoolIdentity) {
    const identity = invitation.schoolIdentity, config = identity.identifierType;
    if (config.verification !== 'EMAIL_LOCAL_PART' || !config.emailDomain || `${identity.normalizedIdentifier}@${config.emailDomain}` !== invitation.email) return null;
  }
  return delivery;
}

/** Each persisted claim is attempted once. Ambiguous SMTP outcomes require review, never automatic retry. */
export async function processInvitationEmails(clubId: string, limit = 5) {
  invitationEmailConfig();
  const candidates = await prisma.invitationDelivery.findMany({ where: { invitation: { clubId }, status: 'QUEUED', nextAttemptAt: { lte: new Date() } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: Math.min(limit, 5) });
  let sent = 0, failed = 0, cancelled = 0, uncertain = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
      const current = await tx.invitationDelivery.findUniqueOrThrow({ where: { id: candidate.id } });
      if (current.status !== 'QUEUED') return false;
      const ready = await eligible(tx, current.id);
      if (!ready) { await tx.invitationDelivery.update({ where: { id: current.id }, data: { status: 'CANCELLED', failureCode: 'INVITATION_UNAVAILABLE' } }); cancelled++; return false; }
      await tx.invitationDelivery.update({ where: { id: current.id }, data: { status: 'SENDING', attemptCount: { increment: 1 } } });
      return true;
    });
    if (!claimed) continue;
    try {
      const outcome = await prisma.$transaction(async tx => {
        // Revalidate under the shared club lock immediately before SMTP. Revoke/accept waits for this attempt.
        await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
        const delivery = await eligible(tx, candidate.id);
        if (!delivery) { await tx.invitationDelivery.update({ where: { id: candidate.id }, data: { status: 'CANCELLED', failureCode: 'INVITATION_UNAVAILABLE' } }); return 'cancelled' as const; }
        const receipt = await sendInvitationEmail({ recipient: delivery.recipientEmail, organizationName: delivery.invitation.club.name, owner: !!delivery.invitation.schoolIdentity && delivery.invitation.requestedRole === 'OWNER', deliveryId: delivery.id, ...(!delivery.invitation.schoolIdentity ? { legacyInvitationId: delivery.invitationId } : {}) });
        const now = new Date();
        await tx.invitationDelivery.update({ where: { id: delivery.id }, data: { status: 'SENT', sentAt: now, providerMessageId: receipt.messageId, failureCode: null } });
        await tx.clubInvitation.update({ where: { id: delivery.invitationId }, data: { firstEmailSentAt: delivery.invitation.firstEmailSentAt || now, lastEmailSentAt: now, emailSendCount: { increment: 1 } } });
        await tx.auditLog.create({ data: { actorId: delivery.requestedById, clubId, targetId: delivery.invitationId, action: 'club.invite.email.sent', details: { deliveryId: delivery.id } } });
        return 'sent' as const;
      }, { timeout: 30000 });
      if (outcome === 'sent') sent++; else cancelled++;
    } catch (error) {
      const response = error && typeof error === 'object' && 'responseCode' in error ? Number(error.responseCode) : 0;
      const rejected = response >= 400 && response < 600;
      // Persisted SENDING prevents a crash/timeout/commit failure from sending twice on retry.
      await prisma.invitationDelivery.update({ where: { id: candidate.id }, data: { ...(rejected ? { status: 'FAILED', failedAt: new Date() } : {}), failureCode: rejected ? 'SMTP_REJECTED' : 'DELIVERY_UNCERTAIN' } });
      if (rejected) failed++; else uncertain++;
    }
  }
  const remaining = await prisma.invitationDelivery.count({ where: { invitation: { clubId }, status: 'QUEUED' } });
  return { sent, failed, cancelled, uncertain, remaining };
}
