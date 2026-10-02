"use server";

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '@/utils/auth';
import { prisma } from '@/utils/prisma';
import { invitationEmailConfig } from '@/utils/email';
import { deliveryActor, enqueueInvitationEmail, processInvitationEmails } from '@/utils/invitation-delivery';

const id = z.string().uuid();
export async function sendRosterInvitations(importId: string) {
  id.parse(importId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  return prisma.$transaction(async tx => {
    const record = await tx.rosterImport.findUniqueOrThrow({ where: { id: importId } });
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${record.clubId} FOR UPDATE`;
    await deliveryActor(tx, record.clubId, user.id);
    if (record.status !== 'COMPLETED') throw new Error('Complete and review the import before sending invitations.');
    const rows = await tx.rosterImportRow.findMany({ where: { importId, clubId: record.clubId, status: 'INVITATION_CREATED', invitationId: { not: null } } });
    let queued = 0, reused = 0, skipped = 0;
    for (const row of rows) {
      const invitation = await tx.clubInvitation.findFirst({ where: { id: row.invitationId!, clubId: record.clubId, status: 'PENDING', expiresAt: { gt: new Date() } } });
      if (!invitation || invitation.emailSendCount > 0) { skipped++; continue; }
      const result = await enqueueInvitationEmail(tx, invitation.id, record.clubId, user.id, `roster:${record.id}:${invitation.id}`);
      if (result.queued) queued++; else reused++;
    }
    if (queued) await tx.auditLog.create({ data: { actorId: user.id, clubId: record.clubId, targetId: record.id, action: 'club.roster.email.request', details: { queued, reused, skipped } } });
    return { queued, reused, skipped };
  }, { timeout: 60000 });
}

export async function resendOrganizationInvitation(clubId: string, invitationId: string) {
  id.parse(clubId); id.parse(invitationId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    const result = await enqueueInvitationEmail(tx, invitationId, clubId, user.id, randomUUID());
    if (result.queued) await tx.auditLog.create({ data: { actorId: user.id, clubId, targetId: invitationId, action: 'club.invite.resend.request' } });
    return result;
  });
}

export async function deliverOrganizationInvitations(clubId: string) {
  id.parse(clubId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Club" WHERE id = ${clubId} FOR UPDATE`;
    await deliveryActor(tx, clubId, user.id);
  });
  return processInvitationEmails(clubId);
}
