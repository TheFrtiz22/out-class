"use client";
import {useEffect,useState} from "react";
import {getVotingRuleDefaults,saveVotingRuleDefault} from "@/lib/voting-rules-api";
import {describeVotingRules,type VotingRules} from "@/lib/voting-rules";
import {Button} from "@/components/ui/button";
import {VotingRuleEditor,draftFromRules,rulesFromDraft,type RuleDraft} from "./voting-rule-editor";

type Defaults=Awaited<ReturnType<typeof import("@/actions/voting-rules").getVotingRuleDefaults>>;
/** Club default and optional round override, collapsed by default. New sessions
 * start from these but each automatic rule is reviewed again in session setup. */
export function VotingRuleDefaults({clubId,roundId,roundName}:{clubId:string;roundId?:string;roundName?:string}){
  const [data,setData]=useState<Defaults|null>(null),[error,setError]=useState(""),[reload,setReload]=useState(0);
  useEffect(()=>{let current=true;getVotingRuleDefaults({clubId,roundId:roundId??null}).then(v=>{if(current)setData(v)}).catch(()=>{if(current)setError("Voting rule defaults could not be loaded.")});return()=>{current=false};},[clubId,roundId,reload]);
  if(error)return <p role="alert" className="text-sm">{error}</p>;
  if(!data)return null;
  return <details className="vr-rule-defaults"><summary className="cursor-pointer font-medium">Default voting rules</summary>
    <p className="text-sm text-muted-foreground">New sessions start from these. Changing a default never changes a session that already exists.</p>
    <DefaultEditor key={`club:${data.club.revision}`} title="Club default" clubId={clubId} roundId={null} current={data.club} onSaved={()=>setReload(v=>v+1)}/>
    {roundId&&data.round&&<DefaultEditor key={`round:${data.round.revision}`} title={`Override for ${roundName??"this round"}`} clubId={clubId} roundId={roundId} current={data.round} onSaved={()=>setReload(v=>v+1)}/>}
  </details>;
}
function DefaultEditor({title,clubId,roundId,current,onSaved}:{title:string;clubId:string;roundId:string|null;current:{rules:VotingRules;revision:number};onSaved:()=>void}){
  const [draft,setDraft]=useState<RuleDraft>(()=>draftFromRules(current.rules)),[state,setState]=useState<{busy?:boolean;message?:string}>({});
  const result=rulesFromDraft(draft);
  const save=async()=>{if(!("rules"in result))return;setState({busy:true});
    try{const r=await saveVotingRuleDefault({clubId,roundId,revision:current.revision,rules:result.rules});if(!r.ok){setState({message:r.message});return;}setState({message:"Saved"});onSaved();}
    catch{setState({message:"Couldn’t save. Retry."});}};
  return <section className="space-y-2 border-t pt-3" aria-label={title}><h3 className="font-medium">{title}</h3><p className="text-sm">Current: {describeVotingRules(current.rules)}</p>
    <VotingRuleEditor value={draft} onChange={setDraft} eligibleCount={10}/>
    <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={state.busy||!("rules"in result)} onClick={()=>void save()}>Save {title.toLowerCase()}</Button>{"error"in result&&draft.mode==="THRESHOLD"&&<span className="text-sm">{result.error}</span>}{state.message&&<span role="status" className="text-sm">{state.message}</span>}</div>
  </section>;
}
