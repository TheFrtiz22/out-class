import type { Prisma } from "@prisma/client";
import type { AppTransactionClient } from "@/utils/prisma";
import type { FrozenLetterSettings } from "@/lib/decision-schedule";
import { publishRecruitmentDecision } from "@/utils/recruitment-offers";
import { summarizeVoting } from "@/lib/voting-engine";
export const votingPublicationInclude={participants:true,candidates:{orderBy:{position:"asc" as const}},passes:{orderBy:{number:"asc" as const},include:{candidates:{orderBy:{position:"asc" as const},include:{ballots:true}}}}};
type Session=Prisma.VotingSessionGetPayload<{include:typeof votingPublicationInclude}>;
/** Caller holds Club then VotingSession locks and live publication authority. */
export async function publishVotingCandidates(tx:AppTransactionClient,s:Session,applicationIds:string[],actorId:string,settings?:FrozenLetterSettings){
 return publishReviewedVotingCandidates(tx,s,applicationIds,summarizeVoting(s).outcomes,actorId,settings);
}
/** Frozen outcomes are valid only while the caller verifies the session revision. */
export async function publishReviewedVotingCandidates(tx:AppTransactionClient,s:Pick<Session,"id"|"clubId"|"roundId"|"state"|"publishedAt"|"candidates"> & {mode?:string},applicationIds:string[],outcomes:ReturnType<typeof summarizeVoting>["outcomes"],actorId:string,settings?:FrozenLetterSettings,names?:Record<string,{firstName:string;fullName:string}>){
 if(s.mode==="LIVE")throw Error("Live room finalization does not publish decisions or send notifications.");
 if(s.state!=="COMPLETED"||s.publishedAt||!applicationIds.length||new Set(applicationIds).size!==applicationIds.length)throw Error("Voting session unavailable for publication.");
        for(const id of [...applicationIds].sort()) {
          const o=outcomes.find(o=>o.applicationId===id), c=s.candidates.find(c=>c.applicationId===id)
          if(!o||!c||o.outcome==="UNRESOLVED") throw Error("Only resolved session candidates can publish.")
          const status=o.outcome==="PASS"?"ACCEPTED":o.outcome==="HOLD"?"WAITLISTED":"REJECTED"
          const current = await tx.application.findFirst({where:{id,clubId:s.clubId,roundId:s.roundId,status:c.expectedStatus}})
          if(!current) throw Error("Application changed since the session snapshot. Publication cancelled.")
          await publishRecruitmentDecision(tx,{applicationId:id,clubId:s.clubId,roundId:s.roundId,expectedStatus:c.expectedStatus,status},actorId,settings,names?.[id])
          await tx.votingCandidate.update({where:{sessionId_applicationId:{sessionId:s.id,applicationId:id}},data:{publishedStatus:status}})
          await tx.auditLog.create({data:{actorId:actorId,clubId:s.clubId,targetId:id,action:"voting.decision.published",details:{sessionId:s.id,pass:o.passNumber,outcome:o.outcome,previousStatus:c.expectedStatus,status}}})
        }
}
