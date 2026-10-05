import type { MembershipAccessRole } from "@prisma/client";
import { canGrantOnboardingRole, onboardingRolePermissions } from "@/lib/club-onboarding";
import { hasPermission, isActiveMembership, type ClubAccess, type ClubPermission } from "@/lib/permissions";

export const organizationRoles = ["OWNER", "ADMIN", "RECRUITING_ADMIN", "INTERVIEWER", "MEMBER"] as const;
export const organizationRoleLabels: Record<MembershipAccessRole, string> = {
  OWNER: "Owner", ADMIN: "Admin", RECRUITING_ADMIN: "Recruiting Lead", INTERVIEWER: "Interviewer", MEMBER: "Member",
};
export const organizationRolePermissions = onboardingRolePermissions;

/** Stored capabilities, not global User roles or role labels, authorize operations. */
export function organizationCapabilities(actor: ClubAccess | null | undefined) {
  return {
    canManageMembers: hasPermission(actor, "members.manage"),
    canManageRecruiting: hasPermission(actor, "recruitment.manage"),
    canManageInterviews: hasPermission(actor, "interviews.manage"),
    canManageOrganization: hasPermission(actor, "club.settings"),
    canChangeRoles: hasPermission(actor, "leaders.manage"),
    canTransferOwnership: isActiveMembership(actor) && actor?.isOwner === true,
  };
}

export function canControlOrganizationAccess(actor: ClubAccess | null | undefined, target: ClubAccess & { accessRole?: string }) {
  if (!isActiveMembership(actor)) return false;
  if (actor?.isOwner) return true;
  return !target.isOwner && target.accessRole !== "OWNER" &&
    (target.permissions || []).every(p => hasPermission(actor, p as ClubPermission));
}

export function canChangeOrganizationRole(actor: ClubAccess | null | undefined, target: ClubAccess & { accessRole?: string }, role: MembershipAccessRole) {
  return organizationCapabilities(actor).canChangeRoles && isActiveMembership(target) &&
    canControlOrganizationAccess(actor, target) && canGrantOnboardingRole(actor || null, role);
}

export function canRemoveOrganizationMember(actor: ClubAccess | null | undefined, target: ClubAccess & { accessRole?: string }) {
  return organizationCapabilities(actor).canManageMembers && isActiveMembership(target) && canControlOrganizationAccess(actor, target);
}

export function canManageOrganizationInvitation(actor: ClubAccess | null | undefined, invitation: { requestedRole: MembershipAccessRole; permissions: readonly string[] }) {
  return canGrantOnboardingRole(actor || null, invitation.requestedRole) &&
    invitation.permissions.every(p => hasPermission(actor, p as ClubPermission));
}
