import { isAlumniProfile } from "~/components/alumni-banner";
import type { Me, Membership } from "~/lib/types";

/**
 * Which leader tools to SHOW for a membership, from the permissions the server sent with the
 * account. This only decides what is offered: every tool's API call is authorized again on the
 * server by the action it reaches, and a stale phone simply gets that action's refusal.
 */
export type LeaderTools = { attendance: boolean; announce: boolean; applicants: boolean; voting: boolean; interviews: boolean };
type Graduation = { graduatedAt?: string | null } | null | undefined;

const can = (membership: Membership, permission: string) => membership.isOwner || membership.permissions.includes(permission);
/**
 * A current membership the server lets act. A graduate whose membership is still current (before the
 * graduation job sets alumniSince) is marked handOverOnly on the server (lib/graduate-access.ts), and
 * hasPermission then refuses everything but handing the club over, so none of these tools would work.
 */
const activeFor = (membership: Membership, profile?: Graduation) => membership.status === "ACTIVE" && !membership.alumniSince && !isAlumniProfile(profile);

export function leaderTools(membership: Membership, profile?: Graduation): LeaderTools {
  const active = activeFor(membership, profile);
  return {
    attendance: active && can(membership, "meetings.attendance"),
    announce: active && can(membership, "meetings.manage"),
    // Each line is the gate of the action the tool reaches (actions/crm.ts readPipeline,
    // actions/voting-room.ts listLiveVotingRooms, lib/interview-access.ts participate).
    applicants: active && (can(membership, "applications.review") || can(membership, "applicants.identify")),
    voting: active && can(membership, "applications.review") && (can(membership, "decisions.start") || can(membership, "decisions.vote") || can(membership, "decisions.view")),
    interviews: active && can(membership, "applications.review") && can(membership, "applicants.identify"),
  };
}
export const hasLeaderTools = (membership: Membership, profile?: Graduation) => Object.values(leaderTools(membership, profile)).some(Boolean);
export const leaderMemberships = (me: Me | undefined) => (me?.memberships ?? []).filter(membership => hasLeaderTools(membership, me?.profile));

/** Announcing to Active applicants also needs identified-recipient access (lib/communications-policy.ts canIdentifyRecipients). */
export const canAnnounceToApplicants = (membership: Membership, profile?: Graduation) =>
  leaderTools(membership, profile).announce && can(membership, "applicants.identify") && can(membership, "applications.review");
/** Setting up a session (components/live-voting/room-landing.tsx canStart, actions/voting-room.ts createLiveVotingRoom). */
export const canStartVoting = (membership: Membership, profile?: Graduation) =>
  activeFor(membership, profile) && can(membership, "applications.review") && can(membership, "decisions.manage") && can(membership, "decisions.start");
/** The workspace's Settings section is offered when any settings tab is (lib/club-settings.ts availableSettings). */
export const canOpenSettings = (membership: Membership, profile?: Graduation) =>
  activeFor(membership, profile) && ["club.settings", "recruitment.manage", "members.manage", "leaders.manage"].some(permission => can(membership, permission));

/** Attendance opens one hour before a meeting and closes six hours after its end (actions/meetings.ts). */
export function attendanceOpen(meeting: { date: string; endDate: string | null }, now = Date.now()) {
  return now >= +new Date(meeting.date) - 3_600_000 && now <= +new Date(meeting.endDate || meeting.date) + 6 * 3_600_000;
}
