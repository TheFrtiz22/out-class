import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import { hasPermission, type ClubPermission } from "@/lib/permissions";
import { roomOutcomes, roomTally, publicChoice } from "@/lib/voting-room";
import { createHash } from "node:crypto";
import { editorValue } from "@/lib/editor-value";
export function roomFingerprint(value:unknown) { return createHash("sha256").update(editorValue(value)).digest("hex"); }

export const roomInclude = { participants: true, candidates: { orderBy: { position: "asc" as const } }, passes: { orderBy: { number: "asc" as const }, include: { candidates: { orderBy: { position: "asc" as const }, include: { ballots: true } } } } };
export type LiveRoom = Prisma.VotingSessionGetPayload<{ include: typeof roomInclude }>;
type Member = Prisma.ClubMemberGetPayload<object>;
export async function loadVotingRoom(tx: AppTransactionClient, clubId: string, sessionId: string, write = false) {
  if (write) await tx.$queryRaw`SELECT id FROM "VotingSession" WHERE id=${sessionId} AND "clubId"=${clubId} FOR UPDATE`;
  const s = await tx.votingSession.findFirst({ where: { id: sessionId, clubId, mode: "LIVE" }, include: roomInclude });
  if (!s) throw Error("Voting room unavailable.");
  const round = await tx.pipelineRound.findFirst({ where: { id: s.roundId, clubId } });
  const cycle = s.cycleId ? await tx.recruitmentCycle.findFirst({ where: { id: s.cycleId, clubId } }) : null;
  if (!round || !cycle || (write && (round.archivedAt || cycle.archivedAt))) throw Error("Voting scope unavailable or archived.");
  return { s, round };
}
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
    id:s.id, clubId:s.clubId, cycleId:s.cycleId!, roundId:s.roundId, revision:s.revision, status:s.state,
    currentApplicantId:s.activeApplicationId, passNumber:s.currentPass, targetSize:s.targetSize,
    finalizedAt:s.finalizedAt, displayConfig:s.displayConfig, permissions:{...permissions,
      canEnd:permissions.leader&&hasPermission(m,"decisions.finish"),
      canFinalize:permissions.leader&&hasPermission(m,"decisions.publish")&&hasPermission(m,"applicants.identify"),
      canCorrect:permissions.leader&&hasPermission(m,"decisions.manage")},
    outcomes, queue:outcomes.filter(o=>o.outcome==="HOLD"||o.outcome==="UNREVIEWED"), accepted:outcomes.filter(o=>o.outcome==="ACCEPT").length,
    history:s.passes.map(p=>({number:p.number,status:p.state,candidates:p.candidates.map(c=>{
      const own=c.ballots.find(b=>b.memberId===m.id),closed=c.ballotState==="CLOSED"||c.ballotState==="CONFIRMED";
      return {applicationId:c.applicationId,position:c.position,ballotState:c.ballotState,outcome:publicChoice(c.confirmedDecision),
        ownBallot:own?{choice:publicChoice(own.decision),revision:own.revision}:null,
        ...(closed?{totals:roomTally(c)}:{})};
    })})),
  };
}
