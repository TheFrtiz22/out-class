"use client";
import {useId} from "react";
import {SegmentedControl} from "@/components/ui/segmented-control";
import {describeVotingRule,votingRuleExamples,votingRulesSchema,type VotingRules,type VotingRuleSummaryInput} from "@/lib/voting-rules";

/** Editable form of a rule. Consequential threshold choices start empty so a
 * leader must choose and review them; nothing automatic is a silent default. */
export type RuleDraft={mode:"LEADER_CONFIRMS"|"THRESHOLD";numerator:string;denominator:string;base:""|"BALLOTS_CAST"|"ELIGIBLE_VOTERS";pNumerator:string;pDenominator:string;below:""|"HOLD"|"REJECT";reviewed:boolean};
export const leaderDraft:RuleDraft={mode:"LEADER_CONFIRMS",numerator:"",denominator:"",base:"",pNumerator:"",pDenominator:"",below:"",reviewed:false};
/** Defaults pre-fill values but always require a fresh review for this session. */
export function draftFromRules(rules:VotingRules|null|undefined):RuleDraft{
  if(!rules||rules.mode!=="THRESHOLD")return leaderDraft;
  return {mode:"THRESHOLD",numerator:String(rules.threshold.numerator),denominator:String(rules.threshold.denominator),base:rules.denominator,pNumerator:String(rules.minimumParticipation.numerator),pDenominator:String(rules.minimumParticipation.denominator),below:rules.belowThreshold,reviewed:false};
}
export function readRuleDraft(value:unknown):RuleDraft|null{
  if(!value||typeof value!=="object")return null;const v=value as Partial<RuleDraft>;
  return v.mode==="THRESHOLD"||v.mode==="LEADER_CONFIRMS"?{...leaderDraft,...v,reviewed:!!v.reviewed}:null;
}
/** Returns the validated rule, or a message describing what still needs a choice. */
export function rulesFromDraft(d:RuleDraft,requireReview=true):{rules:VotingRules}|{error:string}{
  if(d.mode==="LEADER_CONFIRMS")return {rules:{mode:"LEADER_CONFIRMS"}};
  const n=(s:string)=>/^\d+$/.test(s)?Number(s):NaN;
  if(!d.base)return {error:"Choose what the threshold counts against."};
  if(!d.below)return {error:"Choose the outcome below the threshold."};
  const parsed=votingRulesSchema.safeParse({mode:"THRESHOLD",threshold:{numerator:n(d.numerator),denominator:n(d.denominator)},denominator:d.base,minimumParticipation:{numerator:n(d.pNumerator),denominator:n(d.pDenominator)},belowThreshold:d.below,reviewed:requireReview?d.reviewed:true});
  if(!parsed.success){const msg=parsed.error.issues[0]?.message??"";return {error:/Review/.test(msg)?msg:"Enter whole-number fractions from 1/100 up to 1 for the threshold and minimum participation."};}
  return {rules:parsed.data};
}

/** The draft as the saved rule's shape, for describeVotingRule; unfinished values stay empty. */
export function ruleSummaryFromDraft(d:RuleDraft):VotingRuleSummaryInput{
  if(d.mode==="LEADER_CONFIRMS")return {mode:"LEADER_CONFIRMS"};
  const n=(s:string)=>/^\d+$/.test(s)?Number(s):null;
  return {mode:"THRESHOLD",threshold:{numerator:n(d.numerator),denominator:n(d.denominator)},denominator:d.base||null,minimumParticipation:{numerator:n(d.pNumerator),denominator:n(d.pDenominator)},belowThreshold:d.below||null};
}
/** Which control a rulesFromDraft message belongs beside. */
export function ruleErrorTarget(message:string):"base"|"below"|"review"|"fractions"{
  return /counts against/.test(message)?"base":/below the threshold/.test(message)?"below":/Review/.test(message)?"review":"fractions";
}

const presets=[[1,2],[3,5],[2,3],[3,4]] as const;
/** `error` is the message Continue reported for this rule; it is shown beside the control it concerns. */
export function VotingRuleEditor({value,onChange,eligibleCount,disabled=false,error="",hideLegend=false}:{value:RuleDraft;onChange:(v:RuleDraft)=>void;eligibleCount:number;disabled?:boolean;error?:string;hideLegend?:boolean}){
  const id=useId(),set=(patch:Partial<RuleDraft>)=>onChange({...value,...patch,reviewed:"reviewed"in patch?!!patch.reviewed:false});
  const result=rulesFromDraft(value,false),complete="rules"in result;
  const target=error?ruleErrorTarget(error):null,errorId=`${id}-error`;
  const problem=(where:NonNullable<typeof target>)=>target===where?<p id={errorId} role="alert" className="vr-setup-error">{error}</p>:null;
  const describedBy=(where:NonNullable<typeof target>)=>target===where?errorId:undefined;
  return <fieldset className="vr-rule" disabled={disabled}><legend className={hideLegend?"sr-only":"font-medium"}>Voting rule</legend>
    <div className="vr-setup-options">
      <label><input type="radio" name={`${id}-mode`} checked={value.mode==="LEADER_CONFIRMS"} onChange={()=>onChange(leaderDraft)}/><span className="vr-setup-option-title">Leader confirms<span className="vr-setup-option-note">Ballots inform the leader, who confirms Pass, Hold or Do not pass.</span></span></label>
      <label><input type="radio" name={`${id}-mode`} checked={value.mode==="THRESHOLD"} onChange={()=>set({mode:"THRESHOLD"})}/><span className="vr-setup-option-title">Threshold decides<span className="vr-setup-option-note">When the leader closes voting, the rule below decides.</span></span></label>
    </div>
    {value.mode==="THRESHOLD"&&<div className="vr-rule-detail">
      <div className="vr-setup-field"><p className="vr-setup-label" id={`${id}-t`}>Pass votes needed: at least</p>
        <div className="vr-fraction" role="group" aria-labelledby={`${id}-t`} aria-describedby={describedBy("fractions")}>
          <input aria-label="Threshold numerator" className="vr-fraction-input" inputMode="numeric" value={value.numerator} onChange={e=>set({numerator:e.target.value})}/> / <input aria-label="Threshold denominator" className="vr-fraction-input" inputMode="numeric" value={value.denominator} onChange={e=>set({denominator:e.target.value})}/>
          <SegmentedControl label="Threshold presets" size="compact" value={`${value.numerator}/${value.denominator}`} onChange={preset=>{const [numerator,denominator]=preset.split("/");set({numerator,denominator});}} options={presets.map(([a,b])=>({value:`${a}/${b}`,label:`${a}/${b}`}))}/>
        </div></div>
      <div role="radiogroup" aria-labelledby={`${id}-b`} aria-describedby={describedBy("base")} className="vr-setup-field"><p className="vr-setup-label" id={`${id}-b`}>Count Pass votes against</p>
        <div className="vr-setup-options">
          <label><input type="radio" name={`${id}-base`} checked={value.base==="BALLOTS_CAST"} onChange={()=>set({base:"BALLOTS_CAST"})}/><span className="vr-setup-option-title">Ballots cast <span className="vr-setup-option-aside">· members who don’t vote are left out</span></span></label>
          <label><input type="radio" name={`${id}-base`} checked={value.base==="ELIGIBLE_VOTERS"} onChange={()=>set({base:"ELIGIBLE_VOTERS"})}/><span className="vr-setup-option-title">All eligible voters <span className="vr-setup-option-aside">· not voting counts the same as not voting Pass</span></span></label>
        </div>{problem("base")}</div>
      <div className="vr-setup-field"><p className="vr-setup-label" id={`${id}-p`}>Minimum participation: at least</p>
        <div className="vr-fraction" role="group" aria-labelledby={`${id}-p`} aria-describedby={`${id}-p-help ${describedBy("fractions")??""}`.trim()}><input aria-label="Participation numerator" className="vr-fraction-input" inputMode="numeric" value={value.pNumerator} onChange={e=>set({pNumerator:e.target.value})}/> / <input aria-label="Participation denominator" className="vr-fraction-input" inputMode="numeric" value={value.pDenominator} onChange={e=>set({pDenominator:e.target.value})}/><span className="vr-setup-help">of eligible voters must vote</span></div>
        <p className="vr-setup-help" id={`${id}-p-help`}>If fewer vote, nobody is rejected. The leader holds the applicant for another vote or decides with a reason.</p>{problem("fractions")}</div>
      <div role="radiogroup" aria-labelledby={`${id}-o`} aria-describedby={describedBy("below")} className="vr-setup-field"><p className="vr-setup-label" id={`${id}-o`}>Below the threshold</p>
        <div className="vr-setup-inline">
          <label><input type="radio" name={`${id}-below`} checked={value.below==="HOLD"} onChange={()=>set({below:"HOLD"})}/>Hold (vote again later)</label>
          <label><input type="radio" name={`${id}-below`} checked={value.below==="REJECT"} onChange={()=>set({below:"REJECT"})}/>Do not pass</label>
        </div>{problem("below")}</div>
      <p className="vr-setup-summary" aria-live="polite">In plain terms: {describeVotingRule(ruleSummaryFromDraft(value)).replace(/^An /,"an ")}</p>
      {complete&&result.rules.mode==="THRESHOLD"&&<section aria-label="Rule preview" className="vr-setup-field">
        <ul className="vr-rule-examples">{votingRuleExamples(result.rules,eligibleCount).map(e=><li key={e}>{e}</li>)}</ul>
        <p className="vr-setup-help">Examples use the {eligibleCount} selected voter{eligibleCount===1?"":"s"}. The rule and eligible voters are saved with each ballot when voting opens.</p>
        <label className="vr-setup-check"><input type="checkbox" aria-describedby={describedBy("review")} checked={value.reviewed} onChange={e=>set({reviewed:e.target.checked})}/>I’ve reviewed this rule and its examples</label>{problem("review")}</section>}
    </div>}
  </fieldset>;
}
