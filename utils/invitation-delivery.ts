import { assertClubOperational } from "@/lib/club-suspension";
import { randomUUID } from 'node:crypto';
import { prisma, type AppTransactionClient } from '@/utils/prisma';
import { canManageOrganizationInvitation } from '@/lib/organization-authorization';
import { invitationEmailConfig, sendInvitationEmail } from '@/utils/email';

export const EMAIL_COOLDOWN_MS = 15 * 60 * 1000;
export const EMAIL_HOURLY_LIMIT = 1000;

async function resolveDeliveryActor(tx: AppTransactionClient, clubId: string, userId: string, authorizeRequest: boolean) {
  await assertClubOperational(tx, clubId);
  const account = await tx.user.findUnique({ where: { id: userId }, select: { disabledAt: true } });
  const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId, clubId } } });
  if (!account || account.disabledAt) throw new Error('Invitation sending access denied.');
  if ((process.env.OUTCLASS_PLATFORM_ADMIN_IDS || '').split(',').map(value => value.trim()).includes(userId) &&
      (await tx.platformAdmin.findUnique({ where: { userId } }))?.active) {
    if (authorizeRequest) {
      const { requirePlatformAdmin } = await import("@/utils/platform-admin");
      const admin = await requirePlatformAdmin();
      if (admin.id !== userId) throw new Error("Invitation sending access denied.");
    }
    // Administrative invitation delivery does not grant any club membership.
    return { isOwner: true, status: 'ACTIVE', permissions: [] };
  }
  if (!actor || !canManageOrganizationInvitation(actor, { requestedRole: 'MEMBER', permissions: [] })) throw new Error('Invitation sending access denied.');
  return actor;
}

/** Request-time Admin authority always requires the full live Admin guard. */
export async function deliveryActor(tx: AppTransactionClient, clubId: string, userId: string) {
  return resolveDeliveryActor(tx, clubId, userId, true);
}

export async function enqueueInvitationEmail(tx: AppTransactionClient, invitationId: string, clubId: string, userId: string, key: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const actor = await deliveryActor(tx, clubId, userId);
  const preferences = await tx.club.findUnique({ where: { id: clubId }, select: { invitationEmailEnabled: true } });
  if (preferences?.invitationEmailEnabled === false) throw new Error("Invitation emails are disabled in club notification settings.");
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
  if (invitation.club.invitationEmailEnabled === false) return null;
  if (invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.acceptedAt || invitation.revokedAt || invitation.declinedAt || delivery.recipientEmail !== invitation.email) return null;
  // The durable outbox was authorized at enqueue time. Workers recheck current
  // account/grant authority without depending on the originating request cookies.
  const requester = await resolveDeliveryActor(tx, invitation.clubId, delivery.requestedById, false).catch(() => null);
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
  const candidates = await prisma.invitationDelivery.findMany({ where: { invitation: { clubId }, status: 'QUEUED', nextAttemptAt: { lte: new Date() } }, select: { id: true }, orderBy: { createdAt: 'asc' }, take: Math.max(1, Math.min(limit, 25)) });
  let sent = 0, failed = 0, cancelled = 0, uncertain = 0;
  const started = Date.now();
  async function deliver(candidate: { id: string }) {
    const claimed = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
      const paused = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Club" WHERE id=${clubId} AND "suspendedAt" IS NOT NULL`;
      if (paused.length) return null; // Leave queued invitations intact until restoration.
      const current = await tx.invitationDelivery.findUniqueOrThrow({ where: { id: candidate.id } });
      if (current.status !== 'QUEUED') return null;
      const ready = await eligible(tx, current.id);
      if (!ready) { await tx.invitationDelivery.update({ where: { id: current.id }, data: { status: 'CANCELLED', failureCode: 'INVITATION_UNAVAILABLE' } }); cancelled++; return null; }
      await tx.invitationDelivery.update({ where: { id: current.id }, data: { status: 'SENDING', attemptCount: { increment: 1 } } });
      return ready;
    });
    if (!claimed) return;
    try {
      // SMTP runs outside any transaction or organization lock. A claimed message
      // may already be in flight when revoked; accepting its link still checks live grants.
      const receipt = await sendInvitationEmail({ recipient: claimed.recipientEmail, organizationName: claimed.invitation.club.name, owner: !!claimed.invitation.schoolIdentity && claimed.invitation.requestedRole === 'OWNER', deliveryId: claimed.id, ...(!claimed.invitation.schoolIdentity ? { legacyInvitationId: claimed.invitationId } : {}) });
      await prisma.$transaction(async tx => {
        const now = new Date();
        await tx.invitationDelivery.update({ where: { id: claimed.id }, data: { status: 'SENT', sentAt: now, providerMessageId: receipt.messageId, failureCode: null } });
        await tx.clubInvitation.update({ where: { id: claimed.invitationId }, data: { firstEmailSentAt: claimed.invitation.firstEmailSentAt || now, lastEmailSentAt: now, emailSendCount: { increment: 1 } } });
        await tx.auditLog.create({ data: { actorId: claimed.requestedById, clubId, targetId: claimed.invitationId, action: 'club.invite.email.sent', details: { deliveryId: claimed.id } } });
      });
      sent++;

    } catch (error) {
      const response = error && typeof error === 'object' && 'responseCode' in error ? Number(error.responseCode) : 0;
      const rejected = response >= 400 && response < 600;
      // Persisted SENDING prevents a crash/timeout/commit failure from sending twice on retry.
      await prisma.invitationDelivery.update({ where: { id: candidate.id }, data: { ...(rejected ? { status: 'FAILED', failedAt: new Date() } : {}), failureCode: rejected ? 'SMTP_REJECTED' : 'DELIVERY_UNCERTAIN' } });
      if (rejected) failed++; else uncertain++;
    }
  }
  // At most three provider calls at once; leave time for the last group to finish
  // within the route/background lifetime. Unclaimed work stays durably QUEUED.
  for (let index = 0; index < candidates.length && Date.now() - started < 25000; index += 3) {
    await Promise.all(candidates.slice(index, index + 3).map(deliver));
  }
  const remaining = await prisma.invitationDelivery.count({ where: { invitation: { clubId }, status: 'QUEUED' } });
  return { sent, failed, cancelled, uncertain, remaining };
}

/** Authorize once, inspect the whole selection, and insert the durable outbox in one write. */
export async function enqueueInvitationEmails(tx: AppTransactionClient, clubId: string, userId: string, requests: { invitationId: string; key: string }[], skipUnavailable = false) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  const actor = await deliveryActor(tx, clubId, userId);
  const preferences = await tx.club.findUnique({ where: { id: clubId }, select: { invitationEmailEnabled: true } });
  if (preferences?.invitationEmailEnabled === false) throw new Error('Invitation emails are disabled in club notification settings.');
  const now = new Date(), cutoff = new Date(+now - EMAIL_COOLDOWN_MS), since = new Date(+now - 3600000);
  const ids = requests.map(r => r.invitationId);
  const [invitations, deliveries, senderCount, clubCount] = await Promise.all([
    tx.clubInvitation.findMany({ where: { id: { in: ids }, clubId } }),
    tx.invitationDelivery.findMany({ where: { invitationId: { in: ids }, OR: [{ status: { in: ['QUEUED', 'SENDING'] } }, { createdAt: { gt: cutoff } }, { idempotencyKey: { in: requests.map(r => r.key) } }] } }),
    tx.invitationDelivery.count({ where: { requestedById: userId, createdAt: { gt: since } } }),
    tx.invitationDelivery.count({ where: { invitation: { clubId }, createdAt: { gt: since } } }),
  ]);
  const byId = new Map(invitations.map(i => [i.id,i]));
  const deliveriesByInvite = new Map<string, typeof deliveries>();
  for (const delivery of deliveries) deliveriesByInvite.set(delivery.invitationId, [...(deliveriesByInvite.get(delivery.invitationId) || []),delivery]);
  let reused = 0, skipped = 0;
  const pending = [];
  for (const request of requests) {
    const invitation = byId.get(request.invitationId), history = deliveriesByInvite.get(request.invitationId) || [];
    if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= now || invitation.acceptedAt || invitation.revokedAt || invitation.declinedAt || !canManageOrganizationInvitation(actor,invitation) || skipUnavailable && invitation.emailSendCount > 0) {
      if (skipUnavailable) { skipped++; continue; }
      throw new Error('Selection contains unavailable invitations or grants above your authority.');
    }
    if (history.some(d => d.idempotencyKey === request.key || ['QUEUED','SENDING'].includes(d.status))) { reused++; continue; }
    if (history.some(d => d.status !== 'CANCELLED' && d.createdAt > cutoff) || invitation.lastEmailSentAt && invitation.lastEmailSentAt > cutoff) throw new Error('Wait 15 minutes before sending these invitations again.');
    pending.push({ invitationId: invitation.id, requestedById: userId, recipientEmail: invitation.email, idempotencyKey: request.key });
  }
  if (senderCount + pending.length > EMAIL_HOURLY_LIMIT || clubCount + pending.length > EMAIL_HOURLY_LIMIT) throw new Error('Hourly invitation email limit reached. Select fewer invitations or try later.');
  if (pending.length) await tx.invitationDelivery.createMany({ data: pending });
  return { queued: pending.length, reused, skipped };
}
