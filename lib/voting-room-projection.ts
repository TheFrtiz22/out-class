import {meetingDetails} from "@/lib/voting-session-setup";
import type { Prisma } from "@prisma/client";
import { hasPermission, type ClubPermission } from "@/lib/permissions";
import { roomOutcomes, roomTally, publicChoice } from "@/lib/voting-room";
import { roundTargetSummary, sessionTargetSummary } from "@/lib/voting-target-summary";
export type LiveRoom=Prisma.VotingSessionGetPayload<{include:typeof import("@/utils/voting-room").roomInclude}>;
type Member={id:string}&NonNullable<Parameters<typeof hasPermission>[0]>;
export function roomAuthority(s: LiveRoom, m: Member, anonymous: boolean) {
  if (!hasPermission(m, "applications.review") || (!anonymous && !hasPermission(m, "applicants.identify"))) throw Error("Voting presentation access denied.");
  const leader = s.leaderMemberIds.includes(m.id) && hasPermission(m, "decisions.start");
  const voter = s.participants.some(p => p.memberId === m.id) && hasPermission(m, "decisions.vote");
  const observer = hasPermission(m, "decisions.view");
  if (!leader && !voter && !observer) throw Error("Voting room access denied.");
  return { leader, voter, observer };
}
export function requireRoomLeader(s: LiveRoom, m: Member, capability: ClubPermission) {
  if (!s.leaderMemberIds.includes(m.id) || !hasPermission(m, capability) || !hasPermission(m,"decisions.start")) throw Error("Current session leadership permission required.");
}
/** A deliberate projection: no other member's ballot or open tally leaves the server. */
/** `round.final`: no later non-archived round exists, so passing admits (class size) rather than advances. */
export function projectVotingRoom(s: LiveRoom, m: Member, anonymous: boolean, round: { name: string; final: boolean } | null = null) {
  const permissions = roomAuthority(s,m,anonymous), outcomes = roomOutcomes(s);
  return {
    meeting:(()=>{const m=meetingDetails((s.presentationOptions as {meeting?:unknown})?.meeting);if(!m)return null;const {announcedUserIds,...visible}=m;return {...visible,announced:announcedUserIds.length>0};})(),
    id:s.id, clubId:s.clubId, cycleId:s.cycleId!, roundId:s.roundId, revision:s.revision, status:s.state,ballotRosterSize:s.participants.length,ballotsReceived:s.passes.find(p=>p.number===s.currentPass)?.candidates.find(c=>c.applicationId===s.activeApplicationId)?.ballots.length??0,
    currentApplicantId:s.activeApplicationId, passNumber:s.currentPass, targetSize:s.targetUnset?null:s.targetSize,
    // Counts from confirmed outcomes only (the same `outcomes` every room viewer already receives); no ballots.
    targetSummary:sessionTargetSummary({revision:s.revision,targetSize:s.targetSize,targetUnset:s.targetUnset,outcomes,round}),
    finalizedAt:s.finalizedAt, displayConfig:s.displayConfig, permissions:{...permissions,
      canEnd:permissions.leader&&hasPermission(m,"decisions.finish"),
      canFinalize:permissions.leader&&hasPermission(m,"decisions.manage")&&hasPermission(m,"decisions.publish")&&hasPermission(m,"applicants.identify"),
      canCorrect:permissions.leader&&hasPermission(m,"decisions.manage"),
      canDecideWithoutVote:permissions.leader&&hasPermission(m,"decisions.manage")},
    outcomes, queue:outcomes.filter(o=>o.outcome==="HOLD"||o.outcome==="UNREVIEWED"), accepted:outcomes.filter(o=>o.outcome==="ACCEPT").length,
    history:s.passes.map(p=>({number:p.number,status:p.state,candidates:p.candidates.map(c=>{
      const own=c.ballots.find(b=>b.memberId===m.id),closed=c.ballotState==="CLOSED"||c.ballotState==="CONFIRMED";
      return {applicationId:c.applicationId,position:c.position,ballotState:c.ballotState,outcome:publicChoice(c.confirmedDecision),
        // A leader decision made without (or despite) a vote; ballot totals stay separate.
        withoutVote:c.withoutVote||(!!c.override&&c.override===c.confirmedDecision),ownBallot:own?{choice:publicChoice(own.decision),revision:own.revision}:null,
        ...(closed?{totals:roomTally(c)}:{})};
    })})),
  };
}

/**
 * Entire-round scope: canonical outcomes from every live voting room in the
 * round that this member could open (same rule as the room itself), counts
 * only. Cancelled rooms are excluded; `partial` says some rooms were not
 * counted. No applicant IDs, ballots or tallies are returned.
 */
export function projectRoundTargetSummary(rooms: LiveRoom[], m: Member, round: { name: string; final: boolean; anonymousReview: boolean }, truncated = false) {
  if (!hasPermission(m, "applications.review") || (!round.anonymousReview && !hasPermission(m, "applicants.identify"))) throw Error("Applicant access denied.");
  const live = rooms.filter(s => meetingDetails((s.presentationOptions as { meeting?: unknown })?.meeting)?.status !== "CANCELLED");
  const visible = live.filter(s => { try { roomAuthority(s, m, round.anonymousReview); return true; } catch { return false; } });
  const summary = roundTargetSummary({ round, sessions: visible.map(s => ({ id: s.id, createdAt: s.createdAt, revision: s.revision, targetSize: s.targetSize, targetUnset: s.targetUnset, outcomes: roomOutcomes(s) })) });
  return { ...summary, sessions: visible.length, partial: truncated || visible.length < live.length };
}
