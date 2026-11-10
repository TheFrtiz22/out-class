"use server";
import {z} from "zod";
import {requireClubPermission} from "@/utils/auth";
import {authorizeClubTransaction} from "@/lib/club-transaction-authorization";
import {clubWriteTransaction,votingWriteLimits} from "@/utils/club-write-transaction";
import {loadVotingRoom,requireRoomLeader,roomAuthority} from "@/utils/voting-room";
import {currentEligibleVoterIds} from "@/utils/voting-rules";

/** "Something to add": a request for the leader's attention about the applicant
 * currently being discussed. It never casts a ballot, changes an outcome, saves
 * an observation, or changes the room revision, so it cannot interfere with
 * voting commands. Requests are scoped to one applicant in one pass. */
const target=z.object({clubId:z.string().uuid(),sessionId:z.string().uuid(),passNumber:z.number().int().positive(),applicationId:z.string().uuid()}).strict();
const raiseSchema=target.extend({raised:z.boolean()}).strict();
const respondSchema=target.extend({memberId:z.string().uuid(),action:z.enum(["ACKNOWLEDGE","CLEAR"])}).strict();
type Result={ok:true;raised:boolean;acknowledged:boolean}|{ok:false;code:string;message:string};
const moved={ok:false as const,code:"APPLICANT_CHANGED",message:"The discussion moved to another applicant. Your request was not changed."};

function current(s:{state:string;currentPass:number;activeApplicationId:string|null;finalizedAt:Date|null},d:z.infer<typeof target>){
  return s.state==="OPEN"&&!s.finalizedAt&&s.currentPass===d.passNumber&&s.activeApplicationId===d.applicationId;
}

/** Members raise or withdraw their own request. Repeated clicks converge on one row. */
export async function setDiscussionRequest(input:unknown):Promise<Result>{
  const d=raiseSchema.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.vote"]);
  return clubWriteTransaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.vote"]);
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);
    if(!roomAuthority(s,m,round.anonymousReview).voter)throw Error("Eligible session voter required.");
    if(!current(s,d))return moved;
    const key={sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId,memberId:m.id};
    const row=await tx.votingHandRaise.findUnique({where:{sessionId_passNumber_applicationId_memberId:key}});
    const active=!!row&&!row.withdrawnAt&&!row.clearedAt,now=new Date();
    if(d.raised&&!active){
      if(row)await tx.votingHandRaise.update({where:{sessionId_passNumber_applicationId_memberId:key},data:{raisedAt:now,withdrawnAt:null,acknowledgedAt:null,acknowledgedBy:null,clearedAt:null,clearedBy:null,updatedAt:now}});
      else await tx.votingHandRaise.create({data:{...key,raisedAt:now,updatedAt:now}});
      return {ok:true,raised:true,acknowledged:false};
    }
    if(!d.raised&&active)await tx.votingHandRaise.update({where:{sessionId_passNumber_applicationId_memberId:key},data:{withdrawnAt:now,updatedAt:now}});
    return {ok:true,raised:d.raised&&active,acknowledged:!!(d.raised&&active&&row?.acknowledgedAt)};
  },votingWriteLimits);
}

/** Session leaders acknowledge or clear a member's request; the conversation itself happens in person. */
export async function respondToDiscussionRequest(input:unknown):Promise<Result>{
  const d=respondSchema.parse(input),{user}=await requireClubPermission(d.clubId,["applications.review","decisions.start"]);
  return clubWriteTransaction(async tx=>{
    const m=await authorizeClubTransaction(tx,d.clubId,user.id,["applications.review","decisions.start"]);
    const {s,round}=await loadVotingRoom(tx,d.clubId,d.sessionId,true);roomAuthority(s,m,round.anonymousReview);requireRoomLeader(s,m,"decisions.start");
    if(!current(s,d))return moved;
    const key={sessionId:s.id,passNumber:d.passNumber,applicationId:d.applicationId,memberId:d.memberId};
    const row=await tx.votingHandRaise.findUnique({where:{sessionId_passNumber_applicationId_memberId:key}});
    // Only requests from members who are still eligible voters can be acted on.
    if(!row||row.withdrawnAt||row.clearedAt||!(await currentEligibleVoterIds(tx,s.clubId,[d.memberId],round.anonymousReview,d.applicationId)).includes(d.memberId))return {ok:true,raised:false,acknowledged:false};
    const now=new Date();
    if(d.action==="ACKNOWLEDGE"){if(!row.acknowledgedAt)await tx.votingHandRaise.update({where:{sessionId_passNumber_applicationId_memberId:key},data:{acknowledgedAt:now,acknowledgedBy:user.id,updatedAt:now}});return {ok:true,raised:true,acknowledged:true};}
    await tx.votingHandRaise.update({where:{sessionId_passNumber_applicationId_memberId:key},data:{clearedAt:now,clearedBy:user.id,updatedAt:now}});
    return {ok:true,raised:false,acknowledged:false};
  },votingWriteLimits);
}
