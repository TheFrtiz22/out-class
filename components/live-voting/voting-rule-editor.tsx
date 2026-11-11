"use client";
import {useId} from "react";
import {SegmentedControl} from "@/components/ui/segmented-control";
import {describeVotingRules,votingRuleExamples,votingRulesSchema,type VotingRules} from "@/lib/voting-rules";

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

const presets=[[1,2],[3,5],[2,3],[3,4]] as const;
export function VotingRuleEditor({value,onChange,eligibleCount,disabled=false}:{value:RuleDraft;onChange:(v:RuleDraft)=>void;eligibleCount:number;disabled?:boolean}){
  const id=useId(),set=(patch:Partial<RuleDraft>)=>onChange({...value,...patch,reviewed:"reviewed"in patch?!!patch.reviewed:false});
  const result=rulesFromDraft(value,false),complete="rules"in result;
  return <fieldset className="space-y-3" disabled={disabled}><legend className="font-medium">Voting rule</legend>
    <div className="space-y-1">
      <label className="flex items-start gap-2"><input type="radio" name={`${id}-mode`} checked={value.mode==="LEADER_CONFIRMS"} onChange={()=>onChange(leaderDraft)}/><span><span className="font-medium">Leader confirms</span> — ballots inform the leader, who confirms each outcome.</span></label>
      <label className="flex items-start gap-2"><input type="radio" name={`${id}-mode`} checked={value.mode==="THRESHOLD"} onChange={()=>set({mode:"THRESHOLD"})}/><span><span className="font-medium">Threshold decides</span> — when the leader closes voting, a rule you set decides the outcome.</span></label>
    </div>
    {value.mode==="THRESHOLD"&&<div className="space-y-3 border-l-2 pl-3">
      <div><p className="text-sm font-medium" id={`${id}-t`}>Pass votes needed: at least</p>
        <div className="vr-fraction" role="group" aria-labelledby={`${id}-t`}>
          <input aria-label="Threshold numerator" className="vr-fraction-input" inputMode="numeric" value={value.numerator} onChange={e=>set({numerator:e.target.value})}/> / <input aria-label="Threshold denominator" className="vr-fraction-input" inputMode="numeric" value={value.denominator} onChange={e=>set({denominator:e.target.value})}/>
          <SegmentedControl label="Threshold presets" size="compact" value={`${value.numerator}/${value.denominator}`} onChange={preset=>{const [numerator,denominator]=preset.split("/");set({numerator,denominator});}} options={presets.map(([a,b])=>({value:`${a}/${b}`,label:`${a}/${b}`}))}/>
        </div></div>
      <div role="radiogroup" aria-label="Count Pass votes against" className="space-y-1"><p className="text-sm font-medium">Count Pass votes against</p>
        <label className="flex items-start gap-2"><input type="radio" name={`${id}-base`} checked={value.base==="BALLOTS_CAST"} onChange={()=>set({base:"BALLOTS_CAST"})}/><span>Ballots cast — Pass, Hold and Do not pass ballots all count; members who don’t vote are left out.</span></label>
        <label className="flex items-start gap-2"><input type="radio" name={`${id}-base`} checked={value.base==="ELIGIBLE_VOTERS"} onChange={()=>set({base:"ELIGIBLE_VOTERS"})}/><span>All eligible voters — members who don’t vote still count in the total, so not voting has the same effect as not voting Pass.</span></label>
      </div>
      <div><p className="text-sm font-medium" id={`${id}-p`}>Minimum participation: at least</p>
        <div className="vr-fraction" role="group" aria-labelledby={`${id}-p`}><input aria-label="Participation numerator" className="vr-fraction-input" inputMode="numeric" value={value.pNumerator} onChange={e=>set({pNumerator:e.target.value})}/> / <input aria-label="Participation denominator" className="vr-fraction-input" inputMode="numeric" value={value.pDenominator} onChange={e=>set({pDenominator:e.target.value})}/><span className="text-sm">of eligible voters must vote</span></div>
        <p className="text-xs text-muted-foreground">If fewer vote, there’s no automatic result and nobody is rejected; the leader holds the applicant for another vote or decides with a reason.</p></div>
      <div role="radiogroup" aria-label="Below the threshold" className="space-y-1"><p className="text-sm font-medium">Below the threshold</p>
        <label className="flex items-center gap-2"><input type="radio" name={`${id}-below`} checked={value.below==="HOLD"} onChange={()=>set({below:"HOLD"})}/>Hold (vote again in a later pass)</label>
        <label className="flex items-center gap-2"><input type="radio" name={`${id}-below`} checked={value.below==="REJECT"} onChange={()=>set({below:"REJECT"})}/>Do not pass</label>
      </div>
      {complete&&result.rules.mode==="THRESHOLD"?<section aria-label="Rule preview" className="vr-prep-update text-sm"><p>{describeVotingRules(result.rules)}</p>
        <ul className="list-disc pl-5">{votingRuleExamples(result.rules,eligibleCount).map(e=><li key={e}>{e}</li>)}</ul>
        <p className="text-xs text-muted-foreground">Examples use the {eligibleCount} selected voter{eligibleCount===1?"":"s"}. The rule and eligible voters are saved with each ballot when voting opens.</p>
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" checked={value.reviewed} onChange={e=>set({reviewed:e.target.checked})}/>I’ve reviewed this rule and its examples</label></section>
        :<p className="text-sm" role="status">{"error"in result?result.error:""}</p>}
    </div>}
  </fieldset>;
}
