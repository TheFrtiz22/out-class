import {z} from "zod";

/** Club voting rules for live rooms. LEADER_CONFIRMS is the existing behaviour
 * and the default for every session without explicit configuration. Threshold
 * arithmetic is exact (integer cross-multiplication); missing ballots are never
 * counted as Do not pass ballots. */
const fraction=z.object({numerator:z.number().int().min(1).max(100),denominator:z.number().int().min(1).max(100)}).strict()
  .refine(f=>f.numerator<=f.denominator,"A fraction cannot exceed 1.");
export const leaderConfirmsRule=z.object({mode:z.literal("LEADER_CONFIRMS")}).strict();
export const thresholdRule=z.object({
  mode:z.literal("THRESHOLD"),
  /** Pass votes must be at least this fraction of the denominator. */
  threshold:fraction,
  denominator:z.enum(["BALLOTS_CAST","ELIGIBLE_VOTERS"]),
  /** Ballots cast must be at least this fraction of eligible voters (and at least one). */
  minimumParticipation:fraction,
  belowThreshold:z.enum(["HOLD","REJECT"]),
  /** A leader must explicitly review automatic settings; never a silent default. */
  reviewed:z.literal(true,{errorMap:()=>({message:"Review the automatic rule and confirm it before saving."})}),
}).strict();
export const votingRulesSchema=z.discriminatedUnion("mode",[leaderConfirmsRule,thresholdRule]);
export type VotingRules=z.output<typeof votingRulesSchema>;
export type ThresholdRule=z.output<typeof thresholdRule>;
export const defaultVotingRules:VotingRules={mode:"LEADER_CONFIRMS"};
/** Unknown, missing or legacy values always mean leader-confirmed voting. */
export function readVotingRules(value:unknown):VotingRules{const v=votingRulesSchema.safeParse(value);return v.success?v.data:defaultVotingRules;}

export const ruleSnapshotSchema=z.object({rules:votingRulesSchema,electorate:z.array(z.string()).max(500)}).strict();
export type RuleBallot={memberId:string;decision:string};
export type RuleResult={
  outcome:"ACCEPT"|"HOLD"|"REJECT"|null;
  /** Why there is no automatic outcome, when outcome is null. */
  noResult:null|"NO_BALLOTS"|"PARTICIPATION"|"NO_ELIGIBLE_VOTERS";
  passVotes:number;holdVotes:number;rejectVotes:number;cast:number;eligible:number;missing:number;
  base:number;requiredPass:number;requiredParticipation:number;
};
const ceilDiv=(a:number,b:number)=>Math.floor((a+b-1)/b);

/** Evaluate one ballot instance. Only ballots from the snapshotted electorate count. */
export function evaluateThreshold(rule:ThresholdRule,electorate:string[],ballots:RuleBallot[]):RuleResult{
  const members=new Set(electorate),counted=ballots.filter(b=>members.has(b.memberId));
  const passVotes=counted.filter(b=>b.decision==="PASS").length,holdVotes=counted.filter(b=>b.decision==="HOLD").length,rejectVotes=counted.filter(b=>b.decision==="NOT_PASS").length;
  const cast=passVotes+holdVotes+rejectVotes,eligible=members.size,missing=Math.max(eligible-cast,0);
  const requiredParticipation=Math.max(1,ceilDiv(rule.minimumParticipation.numerator*eligible,rule.minimumParticipation.denominator));
  const base=rule.denominator==="BALLOTS_CAST"?cast:eligible;
  const requiredPass=base?Math.max(1,ceilDiv(rule.threshold.numerator*base,rule.threshold.denominator)):0;
  const counts={passVotes,holdVotes,rejectVotes,cast,eligible,missing,base,requiredPass,requiredParticipation};
  if(!eligible)return {outcome:null,noResult:"NO_ELIGIBLE_VOTERS",...counts};
  if(!cast)return {outcome:null,noResult:"NO_BALLOTS",...counts};
  if(cast<requiredParticipation)return {outcome:null,noResult:"PARTICIPATION",...counts};
  // Exact: passVotes / base >= n / d  <=>  passVotes * d >= n * base.
  const passes=passVotes*rule.threshold.denominator>=rule.threshold.numerator*base;
  return {outcome:passes?"ACCEPT":rule.belowThreshold,noResult:null,...counts};
}

const plural=(n:number,word:string)=>`${n} ${word}${n===1?"":"s"}`;
const frac=(f:{numerator:number;denominator:number})=>f.numerator===f.denominator?"all":`${f.numerator}/${f.denominator}`;
export function describeVotingRules(rules:VotingRules){
  if(rules.mode==="LEADER_CONFIRMS")return "Leader confirms: members’ ballots inform the leader, who confirms Pass, Hold or Do not pass for each applicant.";
  const base=rules.denominator==="BALLOTS_CAST"?"of ballots cast (Pass, Hold and Do not pass ballots all count; missing ballots do not)":"of all eligible voters (missing ballots still count in the total, so not voting has the same effect as not voting Pass)";
  return `Threshold decides: an applicant passes with Pass votes from at least ${frac(rules.threshold)} ${base}. At least ${frac(rules.minimumParticipation)} of eligible voters must vote before a result is calculated. Below the threshold the outcome is ${rules.belowThreshold==="HOLD"?"Hold":"Do not pass"}. If too few vote, nobody is rejected automatically: the leader holds the applicant for another vote or decides explicitly with a reason.`;
}
/** Worked examples for the rule preview, computed with the same arithmetic. */
export function votingRuleExamples(rule:ThresholdRule,eligible:number){
  const n=Math.max(1,eligible),ids=Array.from({length:n},(_,i)=>`v${i}`);
  const ex=(cast:number)=>{
    const r0=evaluateThreshold(rule,ids,ids.slice(0,cast).map(memberId=>({memberId,decision:"HOLD"})));
    if(r0.noResult==="PARTICIPATION"||r0.noResult==="NO_BALLOTS")return `If ${plural(cast,"voter")} of ${n} vote: no automatic result (at least ${r0.requiredParticipation} must vote).`;
    const pass=r0.requiredPass;
    return `If ${plural(cast,"voter")} of ${n} vote: ${plural(pass,"Pass vote")} needed to pass; ${pass-1>0?`${pass-1} Pass vote${pass-1===1?"":"s"} gives ${rule.belowThreshold==="HOLD"?"Hold":"Do not pass"}`:"fewer gives the below-threshold outcome"}.`;
  };
  const casts=[...new Set([n,Math.max(1,Math.ceil(n*0.8)),evaluateThreshold(rule,ids,[]).requiredParticipation,Math.max(0,evaluateThreshold(rule,ids,[]).requiredParticipation-1)])].filter(c=>c>=0&&c<=n).sort((a,b)=>b-a);
  return casts.map(ex);
}
export function ruleResultSummary(r:RuleResult,rule:ThresholdRule){
  if(r.noResult==="NO_ELIGIBLE_VOTERS")return "No voters are left for this ballot. Decide directly and give a reason.";
  if(r.noResult)return `No automatic result: ${plural(r.cast,"ballot")} cast, at least ${r.requiredParticipation} required. Nobody is rejected automatically.`;
  const base=rule.denominator==="BALLOTS_CAST"?`${plural(r.cast,"ballot")} cast`:`${plural(r.eligible,"eligible voter")}`;
  return `${plural(r.passVotes,"Pass vote")} of ${base}; ${r.requiredPass} needed (${frac(rule.threshold)}).`;
}
