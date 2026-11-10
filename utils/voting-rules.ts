import type {AppTransactionClient} from "@/utils/prisma";
import {hasPermission} from "@/lib/permissions";
import {evaluateThreshold,readVotingRules,ruleSnapshotSchema,type RuleBallot,type RuleResult,type ThresholdRule,type VotingRules} from "@/lib/voting-rules";

/** Session participants who may vote right now (same rule as the room projection). With an
 * applicationId, members who stepped out of that applicant (conflict of interest) are not in
 * its electorate: they neither vote nor count toward its threshold. */
export async function currentEligibleVoterIds(tx:AppTransactionClient,clubId:string,participantIds:string[],anonymous:boolean,applicationId?:string){
  if(!participantIds.length)return [];
  const members=await tx.clubMember.findMany({where:{clubId,id:{in:participantIds},status:"ACTIVE",user:{disabledAt:null}}});
  const recused=applicationId?new Set((await tx.applicantRecusal.findMany({where:{applicationId,memberId:{in:participantIds},liftedAt:null},select:{memberId:true}})).map(r=>r.memberId)):new Set<string>();
  return members.filter(v=>!recused.has(v.id)&&hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(anonymous||hasPermission(v,"applicants.identify"))).map(v=>v.id).sort();
}
/** Per applicant, how many session participants stepped out of it. Legacy sessions count
 * participants for their thresholds, so these are subtracted rather than treated as missing votes. */
export async function recusedVoterCounts(tx:Pick<AppTransactionClient,"applicantRecusal">,participantIds:string[],applicationIds:string[]){
  const counts=new Map<string,number>();
  if(!participantIds.length||!applicationIds.length)return counts;
  for(const r of await tx.applicantRecusal.findMany({where:{applicationId:{in:applicationIds},memberId:{in:participantIds},liftedAt:null},select:{applicationId:true}}))counts.set(r.applicationId,(counts.get(r.applicationId)??0)+1);
  return counts;
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
