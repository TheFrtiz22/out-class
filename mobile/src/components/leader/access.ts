import type { Me, Membership } from "~/lib/types";

/**
 * Which leader tools to SHOW for a membership, from the permissions the server sent with the
 * account. This only decides what is offered: every tool's API call is authorized again on the
 * server by the action it reaches, and a stale phone simply gets that action's refusal.
 */
export type LeaderTools = { attendance: boolean; announce: boolean; applicants: boolean; voting: boolean; interviews: boolean };

const can = (membership: Membership, permission: string) => membership.isOwner || membership.permissions.includes(permission);

export function leaderTools(membership: Membership): LeaderTools {
  const active = membership.status === "ACTIVE" && !membership.alumniSince;
  return {
    attendance: active && can(membership, "meetings.attendance"),
    announce: active && can(membership, "meetings.manage"),
    applicants: active && can(membership, "applications.review"),
    voting: active && (can(membership, "decisions.start") || can(membership, "decisions.vote")),
    interviews: active && can(membership, "applications.review"),
  };
}
export const hasLeaderTools = (membership: Membership) => Object.values(leaderTools(membership)).some(Boolean);
export const leaderMemberships = (me: Me | undefined) => (me?.memberships ?? []).filter(hasLeaderTools);
