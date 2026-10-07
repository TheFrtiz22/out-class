"use server";

import { lockOperationalClub } from "@/lib/club-suspension";

import { scheduleInvitationDelivery } from "@/utils/invitation-background";
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '@/utils/auth';
import { prisma } from '@/utils/prisma';
import { invitationEmailConfig } from '@/utils/email';
import { deliveryActor, enqueueInvitationEmail, enqueueInvitationEmails, processInvitationEmails } from '@/utils/invitation-delivery';

const id = z.string().uuid();
export async function sendRosterInvitations(importId: string) {
  id.parse(importId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  const result = await prisma.$transaction(async tx => {
    const record = await tx.rosterImport.findUniqueOrThrow({ where: { id: importId } });
    await lockOperationalClub(tx, record.clubId);
    await deliveryActor(tx, record.clubId, user.id);
    if (record.status !== 'COMPLETED') throw new Error('Complete and review the import before sending invitations.');
    const rows = await tx.rosterImportRow.findMany({ where: { importId, clubId: record.clubId, status: 'INVITATION_CREATED', invitationId: { not: null } } });
    const { queued, reused, skipped } = await enqueueInvitationEmails(tx, record.clubId, user.id, rows.map(row => ({ invitationId: row.invitationId!, key: `roster:${record.id}:${row.invitationId}` })), true);
    if (queued) await tx.auditLog.create({ data: { actorId: user.id, clubId: record.clubId, targetId: record.id, action: 'club.roster.email.request', details: { queued, reused, skipped } } });
    return { queued, reused, skipped, clubId: record.clubId };
  }, { timeout: 60000 });
  if (result.queued) scheduleInvitationDelivery(result.clubId);
  return { queued: result.queued, reused: result.reused, skipped: result.skipped };
}

export async function resendOrganizationInvitation(clubId: string, invitationId: string) {
  id.parse(clubId); id.parse(invitationId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  const result = await prisma.$transaction(async tx => {
    await lockOperationalClub(tx, clubId);
    const result = await enqueueInvitationEmail(tx, invitationId, clubId, user.id, randomUUID());
    if (result.queued) await tx.auditLog.create({ data: { actorId: user.id, clubId, targetId: invitationId, action: 'club.invite.resend.request' } });
    return result;
  });
  if (result.queued) scheduleInvitationDelivery(clubId);
  return result;
}

export async function deliverOrganizationInvitations(clubId: string) {
  id.parse(clubId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  await prisma.$transaction(async tx => {
    await lockOperationalClub(tx, clubId);
    await deliveryActor(tx, clubId, user.id);
  });
  return processInvitationEmails(clubId);
}

/** Request a background pass without waiting for SMTP. */
export async function requestInvitationDelivery(clubId: string) {
  id.parse(clubId);
  const { user } = await requireAuth();
  invitationEmailConfig();
  await prisma.$transaction(async tx => { await deliveryActor(tx, clubId, user.id) });
  scheduleInvitationDelivery(clubId);
  return { queued: true };
}
