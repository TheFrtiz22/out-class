'use client';
import { useEffect,useState } from 'react';
import { getDecisionTemplates,saveDecisionTemplates } from '@/lib/workspace-api';
import { defaultLetters,decisionTypes,letterVariables,resolveLetter,type LetterDecision,type LetterTemplate,letterTemplatesSchema } from '@/lib/decision-letters';
import { LetterPaper } from './decision-letter';
import { clubAssetSource } from '@/lib/club-assets';
import { Button } from '@/components/ui/button';
export function DecisionTemplateEditor({clubId}:{clubId:string}){
 const [club,setClub]=useState<Awaited<ReturnType<typeof getDecisionTemplates>>|null>(null),[templates,setTemplates]=useState<Partial<Record<LetterDecision,LetterTemplate>>>({}),[selected,setSelected]=useState<LetterDecision>('ACCEPTED'),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 useEffect(()=>{let active=true;getDecisionTemplates(clubId).then(value=>{if(active){setClub(value);setTemplates(value.templates)}}).catch(()=>{if(active)setMessage('Decision letter settings could not load.')});return()=>{active=false}},[clubId]);
 const template=templates[selected]??defaultLetters[selected];
 async function save(){setBusy(true);setMessage('');try{await saveDecisionTemplates(clubId,letterTemplatesSchema.parse(templates));setMessage('Saved. Published letters remain unchanged.');}catch{setMessage('Could not save. Check the documented variables and your recruitment permission.');}finally{setBusy(false)}}
 return <details className="border-y py-4"><summary className="cursor-pointer font-medium">Decision Letters</summary><div className="space-y-4 pt-5">
 <p className="text-sm text-muted-foreground">Customize future letters. Published letters keep their original wording. Preview uses a fictional student and reveals no applicant information.</p>
 {!club?<p role="status">{message||'Loading letter settings…'}</p>:<>
 <label className="block text-sm">Letter type<select className="block mt-2 rounded border bg-background p-2" value={selected} onChange={e=>{setSelected(e.target.value as LetterDecision);setPreview(false)}}>{decisionTypes.map(type=><option key={type}>{type}</option>)}</select></label>
 {(['title','body','closing','signer','footer'] as const).map(field=><label key={selected+field} className="block text-sm capitalize">{field==='signer'?'Signer / title (optional)':field}<textarea rows={field==='body'?9:2} value={template[field]} disabled={busy} onChange={e=>setTemplates({...templates,[selected]:{...template,[field]:e.target.value}})} className="mt-2 block w-full rounded border bg-background p-3 normal-case" maxLength={field==='body'?6000:field==='footer'?1000:field==='closing'?300:160}/></label>)}
 <p className="break-words text-xs text-muted-foreground">Available variables: {letterVariables.map(v=>'{{'+v+'}}').join(', ')}</p>
 <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>void save()}>Save letter templates</Button><Button variant="outline" disabled={busy} onClick={()=>setPreview(!preview)}>Preview letter</Button><Button variant="ghost" disabled={busy} onClick={()=>{const next={...templates};delete next[selected];setTemplates(next)}}>Reset to Default</Button></div>
 <p role="status">{message}</p>
 {preview&&<LetterPaper preview content={resolveLetter(selected,templates,{firstName:'Alex',fullName:'Alex Student',clubName:club.name,date:new Date(),expiresAt:new Date(Date.now()+30*86400000),logoReference:null,accent:club.color})} logoSource={clubAssetSource(club.logoUrl,true)}/>}</>}
 </div></details>;
}
