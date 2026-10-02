import { organizationCapabilities } from '@/lib/organization-authorization';
import { clubWorkspaceHref } from '@/lib/club-workspace';
import type { ClubAccess } from '@/lib/permissions';

export function organizationSetupSteps(input: { clubId: string; claimed: boolean; name: string; tagline: string; description: string; rosterReady: boolean; members: (ClubAccess & { isOwner: boolean })[]; roundCount: number }) {
  const members = clubWorkspaceHref(input.clubId, 'members');
  return [
    { id: 'claim', title: 'Claim organization', complete: input.claimed, detail: 'Ownership is verified and saved.', href: clubWorkspaceHref(input.clubId) },
    { id: 'profile', title: 'Complete organization profile', complete: !!(input.name.trim() && input.tagline.trim() && input.description.trim()), detail: 'Add a tagline and description so students know your organization.', href: clubWorkspaceHref(input.clubId, 'settings') },
    { id: 'roster', title: 'Upload member roster', complete: input.rosterReady, detail: 'Import a reviewed CSV. Emailing invitations is a separate choice.', href: members },
    { id: 'administrators', title: 'Assign administrators', complete: input.members.some(member => !member.isOwner && (() => { const caps = organizationCapabilities(member); return caps.canManageMembers || caps.canManageRecruiting || caps.canChangeRoles; })()), detail: 'Give an active member the capabilities they need. Pending grants do not count yet.', href: members },
    { id: 'recruiting', title: 'Configure recruiting', complete: input.roundCount > 0, detail: input.roundCount > 0 ? 'Saved recruitment rounds are available. Review privacy and requirements when needed.' : 'Review recruiting settings. Contact OutClass if your organization needs its initial rounds created.', href: `${clubWorkspaceHref(input.clubId, 'recruitment')}&tool=rounds` },
  ];
}
