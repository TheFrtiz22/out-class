import type { Prisma } from "@prisma/client";
import { hasPermission, type ClubPermission } from "@/lib/permissions";
import { roomOutcomes, roomTally, publicChoice } from "@/lib/voting-room";
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
export function projectVotingRoom(s: LiveRoom, m: Member, anonymous: boolean) {
  const permissions = roomAuthority(s,m,anonymous), outcomes = roomOutcomes(s);
  return {
    id:s.id, clubId:s.clubId, cycleId:s.cycleId!, roundId:s.roundId, revision:s.revision, status:s.state,ballotRosterSize:s.participants.length,ballotsReceived:s.passes.find(p=>p.number===s.currentPass)?.candidates.find(c=>c.applicationId===s.activeApplicationId)?.ballots.length??0,
    currentApplicantId:s.activeApplicationId, passNumber:s.currentPass, targetSize:s.targetUnset?null:s.targetSize,
    finalizedAt:s.finalizedAt, displayConfig:s.displayConfig, permissions:{...permissions,
      canEnd:permissions.leader&&hasPermission(m,"decisions.finish"),
      canFinalize:permissions.leader&&hasPermission(m,"decisions.manage")&&hasPermission(m,"decisions.publish")&&hasPermission(m,"applicants.identify"),
      canCorrect:permissions.leader&&hasPermission(m,"decisions.manage")},
    outcomes, queue:outcomes.filter(o=>o.outcome==="HOLD"||o.outcome==="UNREVIEWED"), accepted:outcomes.filter(o=>o.outcome==="ACCEPT").length,
    history:s.passes.map(p=>({number:p.number,status:p.state,candidates:p.candidates.map(c=>{
      const own=c.ballots.find(b=>b.memberId===m.id),closed=c.ballotState==="CLOSED"||c.ballotState==="CONFIRMED";
      return {applicationId:c.applicationId,position:c.position,ballotState:c.ballotState,outcome:publicChoice(c.confirmedDecision),
        withoutVote:c.withoutVote,ownBallot:own?{choice:publicChoice(own.decision),revision:own.revision}:null,
        ...(closed?{totals:roomTally(c)}:{})};
    })})),
  };
}
