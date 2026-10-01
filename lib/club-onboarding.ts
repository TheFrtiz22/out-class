import type { MembershipAccessRole, SchoolIdentifierType } from "@prisma/client";
import { clubPermissions, hasPermission, type ClubAccess, type ClubPermission } from "@/lib/permissions";

/** Roles are membership-local templates. Stored capabilities remain authoritative. */
export const onboardingRolePermissions: Record<MembershipAccessRole, ClubPermission[]> = {
  OWNER: [...clubPermissions],
  ADMIN: [...clubPermissions],
  RECRUITING_ADMIN: ["recruitment.manage", "applications.review", "applicants.identify", "interviews.manage", "decisions.manage", "meetings.manage", "meetings.attendance"],
  INTERVIEWER: ["applications.review", "applicants.identify"],
  MEMBER: [],
};

export function normalizeSchoolIdentifier(value: string, config: Pick<SchoolIdentifierType, "normalization" | "validationRegex">) {
  // Matches PostgreSQL btrim (ASCII spaces), deliberately excluding control characters.
  const trimmed = value.replace(/^ +| +$/g, "");
  const normalized = config.normalization === "TRIM_LOWERCASE" ? trimmed.toLowerCase() : trimmed;
  if (!normalized || normalized.length > 128 || /[\x00-\x1f\x7f]/.test(normalized)) throw new Error("Invalid school identifier.");
  if (config.validationRegex && !new RegExp(config.validationRegex).test(normalized)) throw new Error("Invalid school identifier.");
  return normalized;
}

export function canGrantOnboardingRole(actor: ClubAccess | null, role: MembershipAccessRole) {
  if (!actor || (actor.status && actor.status !== "ACTIVE")) return false;
  if (role === "OWNER") return actor.isOwner === true;
  if (role === "MEMBER") return hasPermission(actor, "members.manage") || hasPermission(actor, "leaders.manage");
  return hasPermission(actor, "leaders.manage") && onboardingRolePermissions[role].every(p => hasPermission(actor, p));
}

export function invitationPurpose(role: MembershipAccessRole) {
  return role === "OWNER" ? "OWNER_DESIGNATION" : role === "MEMBER" ? "MEMBERSHIP" : "ACCESS_GRANT";
}
