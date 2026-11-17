import {isGraduatedMember} from "@/lib/graduation";
import type {AppTransactionClient} from "@/utils/prisma";
import {hasPermission, activeMemberWhere } from "@/lib/permissions";
import {evaluateThreshold,readVotingRules,ruleSnapshotSchema,type RuleBallot,type RuleResult,type ThresholdRule,type VotingRules} from "@/lib/voting-rules";

/** Session participants who may vote right now (same rule as the room projection). */
export async function currentEligibleVoterIds(tx:AppTransactionClient,clubId:string,participantIds:string[],anonymous:boolean){
  if(!participantIds.length)return [];
  const members=await tx.clubMember.findMany({where:{clubId,id:{in:participantIds},...activeMemberWhere,user:{disabledAt:null}},include:{user:{select:{studentProfile:{select:{graduatedAt:true}}}}}});
  return members.filter(v=>!isGraduatedMember(v)&&hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(anonymous||hasPermission(v,"applicants.identify"))).map(v=>v.id).sort();
}
/** The applicant's own membership in this club, if they have one: never a voter on their own slide. */
export async function applicantMemberId(tx:AppTransactionClient,clubId:string,applicationId:string){
  const app=await tx.application.findFirst({where:{id:applicationId,clubId},select:{studentId:true}});
  if(!app)return null;
  const member=await tx.clubMember.findFirst({where:{clubId,userId:app.studentId},select:{id:true}});
  return member?.id??null;
}
/** Who counts for one applicant's ballot right now: roster members who may still vote, never the applicant themself. */
export async function ballotElectorate(tx:AppTransactionClient,clubId:string,participantIds:string[],anonymous:boolean,applicationId:string,{excludeRecused=false}:{excludeRecused?:boolean}={}){
  const self=await applicantMemberId(tx,clubId,applicationId);
  // Open-electorate sessions: a member who stepped out of this applicant (recusal) is not eligible for it either.
  const recused=excludeRecused?new Set((await recusedMemberIds(tx,applicationId,participantIds))):new Set<string>();
  return currentEligibleVoterIds(tx,clubId,participantIds.filter(id=>id!==self&&!recused.has(id)),anonymous);
}
/** Members with an active (not lifted) recusal from this application, among the given members. */
export async function recusedMemberIds(tx:AppTransactionClient,applicationId:string,memberIds:string[]){
  if(!memberIds.length)return [];
  return (await tx.applicantRecusal.findMany({where:{applicationId,liftedAt:null,memberId:{in:memberIds}},select:{memberId:true}})).map(r=>r.memberId);
}
/** Members who may join an open-electorate session in this club now: current (non-alumni) members on enabled
 * accounts who hold the club's voting permissions (and may identify applicants, for identified rounds). */
export async function joinableVoters(tx:AppTransactionClient,clubId:string,anonymous:boolean){
  const members=await tx.clubMember.findMany({where:{clubId,...activeMemberWhere,user:{disabledAt:null}},select:{id:true,userId:true,status:true,alumniSince:true,isOwner:true,permissions:true}});
  return members.filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(anonymous||hasPermission(v,"applicants.identify")));
}
export type BallotRuleSnapshot={version:number;rules:VotingRules;electorate:string[]};
export async function latestBallotRule(tx:AppTransactionClient,key:{sessionId:string;passNumber:number;applicationId:string}):Promise<BallotRuleSnapshot|null>{
  const rows=await tx.votingBallotRule.findMany({where:key,orderBy:{version:"desc"},take:1});
  const row=rows[0];if(!row)return null;
  const parsed=ruleSnapshotSchema.safeParse({rules:row.rules,electorate:row.electorate});
  return parsed.success?{version:row.version,...parsed.data}:null;
}
/** Result for a threshold ballot; null for leader-confirmed or pre-rule instances. */
export function ballotRuleResult(snapshot:BallotRuleSnapshot|null,ballots:RuleBallot[]):{rule:ThresholdRule;result:RuleResult}|null{
  if(!snapshot||snapshot.rules.mode!=="THRESHOLD")return null;
  return {rule:snapshot.rules,result:evaluateThreshold(snapshot.rules,snapshot.electorate,ballots)};
}
export function sessionRules(presentationOptions:unknown){return readVotingRules((presentationOptions as {rules?:unknown}|null)?.rules);}
