"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveStatus } from "@/components/ui/autosave-status";
import { useAuth } from "@/contexts/auth-context";
import { useEffect,useRef,useState } from 'react';
import { getDecisionTemplates,saveDecisionTemplates,setFormalDecisionLetters } from '@/lib/workspace-api';
import { defaultLetters,decisionTypes,letterVariables,resolveLetter,type LetterDecision,type LetterTemplate,letterTemplatesSchema } from '@/lib/decision-letters';
import { LetterPaper } from './decision-letter';
import { clubAssetSource } from '@/lib/club-assets';
import { Button } from '@/components/ui/button';
import { Toggle } from "@/components/ui/toggle"
import { PillGroup } from "@/components/ui/segmented-control"
/** `inline` shows the editor directly (Decisions → Decision letters); Settings keeps the disclosure. */
export function DecisionTemplateEditor({clubId,inline=false}:{clubId:string;inline?:boolean}){
 const {user}=useAuth(),expected=useRef("{}");
 const [club,setClub]=useState<Awaited<ReturnType<typeof getDecisionTemplates>>|null>(null),[templates,setTemplates]=useState<Partial<Record<LetterDecision,LetterTemplate>>>({}),[selected,setSelected]=useState<LetterDecision>('ACCEPTED'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false),[loadAttempt,setLoadAttempt]=useState(0);
 useEffect(()=>{let active=true;setMessage('');getDecisionTemplates(clubId).then(value=>{if(active){setClub(value);setTemplates(value.templates);expected.current=JSON.stringify(value.templates)}}).catch(()=>{if(active)setMessage('Decision letter settings could not load.')});return()=>{active=false}},[clubId,loadAttempt]);
 const template=templates[selected]??defaultLetters[selected];
 const autosave=useAutosave({identity:`${user?.id}:decision-templates:${clubId}`,value:templates,restore:setTemplates,enabled:!!club,save:async value=>{
  const parsed=letterTemplatesSchema.parse(value);
  await saveDecisionTemplates(clubId,parsed,expected.current);
  expected.current=JSON.stringify(parsed);
 }});
 const body=<>
 <p className="text-sm text-muted-foreground">Customize future letters. Published letters keep their original wording. Preview uses a fictional student and reveals no applicant information.</p>
 {!club?message ? <div role="alert"><p>{message}</p><Button type="button" variant="outline" onClick={()=>setLoadAttempt(v=>v+1)}>Retry letter settings</Button></div> : <LoadingState label="Loading letter settings…" layout="form" rows={3} />:<>
 <Toggle label="Send formal decision letters" checked={club.sendFormalDecisionLetters} disabled={busy} onCheckedChange={async enabled=>{setBusy(true);try{await setFormalDecisionLetters(clubId,enabled);setClub({...club,sendFormalDecisionLetters:enabled});setMessage('Formal-letter setting saved. Historical letters are unchanged.');}catch{setMessage('Could not save the formal-letter setting.');}finally{setBusy(false)}}}/>
 <p className="text-sm text-muted-foreground">When off, decisions and inbox notifications still publish, without creating a new letter. This does not enable or disable decision-availability email; student preferences and the shared delivery service control email.</p>
 <div className="space-y-2 text-sm"><span className="block">Letter type</span><PillGroup label="Letter type" size="compact" value={selected} onChange={value=>{setSelected(value);setPreview(false)}} options={decisionTypes.map(type=>({value:type,label:type.charAt(0)+type.slice(1).toLowerCase()}))}/></div>
 {(['title','body','closing','signer','footer'] as const).map(field=><label key={selected+field} className="block text-sm capitalize">{field==='signer'?'Signer / title (optional)':field}<textarea rows={field==='body'?9:2} value={template[field]} disabled={busy || autosave.recovery != null} onChange={e=>setTemplates({...templates,[selected]:{...template,[field]:e.target.value}})} className="mt-2 block w-full rounded border bg-background p-3 normal-case" maxLength={field==='body'?6000:field==='footer'?1000:field==='closing'?300:160}/></label>)}
 <p className="break-words text-xs text-muted-foreground">Available variables: {letterVariables.map(v=>'{{'+v+'}}').join(', ')}</p>
 <div className="flex flex-wrap gap-3"><AutosaveStatus save={autosave} /><Button variant="outline" disabled={busy} onClick={()=>setPreview(!preview)}>Preview letter</Button><Button variant="ghost" disabled={busy} onClick={()=>{const next={...templates};delete next[selected];setTemplates(next)}}>Reset to Default</Button></div>
 <p role="status">{message}</p>
 {preview&&<LetterPaper preview marketing={club.marketing} content={resolveLetter(selected,templates,{firstName:'Alex',fullName:'Alex Student',clubName:club.name,date:new Date(),expiresAt:new Date(Date.now()+30*86400000),logoReference:null,accent:club.color})} logoSource={clubAssetSource(club.logoUrl,true)}/>}</>}
</>;
 if(inline)return <div data-autosave-editor="true" onBlur={autosave.onBlur} data-unsaved={autosave.dirty} data-saving={autosave.saving} className="space-y-4">{body}</div>;
 return <details data-autosave-editor="true" onBlur={autosave.onBlur} data-unsaved={autosave.dirty} data-saving={autosave.saving} className="border-y py-4"><summary className="cursor-pointer font-medium">Decision Letters</summary><div className="space-y-4 pt-5">{body}</div></details>;
}
