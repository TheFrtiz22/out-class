"use server";

import { z } from 'zod';
import { requireClubPermission } from '@/utils/auth';
import { prisma } from '@/utils/prisma';
import { organizationCapabilities } from '@/lib/organization-authorization';
import { organizationSetupSteps } from '@/lib/organization-onboarding';

export async function getOrganizationSetupChecklist(clubId: string) {
  z.string().uuid().parse(clubId);
  const { user } = await requireClubPermission(clubId, ['club.settings']);
  return prisma.$transaction(async tx => {
    const actor = await tx.clubMember.findUnique({ where: { userId_clubId: { userId: user.id, clubId } } });
    if (!organizationCapabilities(actor).canManageOrganization) throw new Error('Organization setup access denied.');
    const club = await tx.club.findUniqueOrThrow({ where: { id: clubId }, select: { name: true, tagline: true, description: true, claimedAt: true } });
    const [members, rosterCount, roundCount] = await Promise.all([
      tx.clubMember.findMany({ where: { clubId, status: 'ACTIVE', user: { disabledAt: null } }, select: { isOwner: true, permissions: true, status: true } }),
      tx.rosterImport.count({ where: { clubId, status: 'COMPLETED', rows: { some: { status: { in: ['INVITATION_CREATED', 'INVITATION_REUSED', 'ALREADY_MEMBER'] } } } } }),
      tx.pipelineRound.count({ where: { clubId } }),
    ]);
    return { organizationName: club.name, steps: organizationSetupSteps({ clubId, claimed: !!club.claimedAt || members.some(member => member.isOwner), name: club.name, tagline: club.tagline, description: club.description, rosterReady: rosterCount > 0, members, roundCount }) };
  });
}
