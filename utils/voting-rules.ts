import type {AppTransactionClient} from "@/utils/prisma";
import {hasPermission, activeMemberWhere } from "@/lib/permissions";
import {evaluateThreshold,readVotingRules,ruleSnapshotSchema,type RuleBallot,type RuleResult,type ThresholdRule,type VotingRules} from "@/lib/voting-rules";

/** Session participants who may vote right now (same rule as the room projection). */
export async function currentEligibleVoterIds(tx:AppTransactionClient,clubId:string,participantIds:string[],anonymous:boolean){
  if(!participantIds.length)return [];
  const members=await tx.clubMember.findMany({where:{clubId,id:{in:participantIds},...activeMemberWhere,user:{disabledAt:null}}});
  return members.filter(v=>hasPermission(v,"applications.review")&&hasPermission(v,"decisions.vote")&&(anonymous||hasPermission(v,"applicants.identify"))).map(v=>v.id).sort();
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
