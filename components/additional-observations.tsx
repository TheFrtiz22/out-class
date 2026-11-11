'use client';
import { userMessage } from "@/lib/user-message"
import {useEffect,useId,useRef,useState} from 'react';
import {getAdditionalObservations,saveAdditionalObservation} from '@/lib/additional-observations-api';
import {observationWordCount,type AdditionalObservation} from '@/lib/additional-observations';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {useAuth} from '@/contexts/auth-context';
/** `embedded`: inside a section that already names it (no heading, no helper text, one-line load error). `onCount` reports the shared total. */
export function AdditionalObservations({clubId,applicationId,onSaved,embedded=false,onCount}:{clubId:string;applicationId:string;onSaved?:()=>void;embedded?:boolean;onCount?:(count:number|null)=>void}){
 const auth=useAuth(),identity=JSON.stringify([auth.user?.id,auth.user?.memberships?.find(m=>m.clubId===clubId)]);
 const [rows,setRows]=useState<AdditionalObservation[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[body,setBody]=useState(''),[context,setContext]=useState(''),[reason,setReason]=useState(''),[editing,setEditing]=useState<AdditionalObservation|null>(null),[refresh,setRefresh]=useState(0);
 const pending=useRef<Parameters<typeof saveAdditionalObservation>[0]|null>(null),lock=useRef(false),origin=useRef<HTMLButtonElement|null>(null),addControl=useRef<HTMLButtonElement|null>(null),form=useRef<HTMLTextAreaElement|null>(null),id=useId();
 useEffect(()=>{setRows(null);setOpen(false);setEditing(null);setBody('');setContext('');setReason('');pending.current=null;},[clubId,applicationId,identity]);
 useEffect(()=>{let current=true;getAdditionalObservations({clubId,applicationId}).then(v=>{if(current){setRows(v);setError('');}}).catch(e=>{if(current){setRows(null);setError(userMessage(e, 'Observations unavailable.'));}});return()=>{current=false;};},[clubId,applicationId,identity,refresh]);
 const count=observationWordCount(body),moderating=!!editing&&(!editing.canEdit||editing.locked);
 const report=useRef(onCount);report.current=onCount;
 useEffect(()=>{report.current?.(rows?rows.length:null);},[rows]);
 useEffect(()=>{if(origin.current&&!open&&!busy)(origin.current.isConnected?origin.current:addControl.current)?.focus();},[open,busy]);
 function edit(row:AdditionalObservation|null,button:HTMLButtonElement){origin.current=button;setEditing(row);setBody(row?.body??'');setContext(row?.interactionContext??'');setReason('');pending.current=null;setOpen(true);setError('');requestAnimationFrame(()=>form.current?.focus());}
 function close(){setOpen(false);setEditing(null);setBody('');setContext('');setReason('');pending.current=null;}
 async function save(remove=false){
  if(lock.current||!body.trim()||count>50||moderating&&!reason.trim())return;
  lock.current=true;setBusy(true);setError('');
  const content={clubId,applicationId,id:editing?.id??pending.current?.id??crypto.randomUUID(),revision:editing?.revision??null,body,interactionContext:context,reason,remove};
  const previous=pending.current;const same=previous&&Object.entries(content).every(([k,v])=>previous[k as keyof typeof previous]===v);
  const command={...content,requestId:same?previous.requestId:crypto.randomUUID()};pending.current=command;
  try{await saveAdditionalObservation(command);close();setRefresh(v=>v+1);onSaved?.();}catch(e){setError(userMessage(e, 'Could not share. Your text is retained; retry.'));}finally{setBusy(false);lock.current=false;}
 }
 return <section aria-label="Additional observations" className={embedded?"space-y-3":"space-y-3 border-t pt-3"}>
  <header className={`flex items-center gap-2 ${embedded?"justify-end":"justify-between"}`}>{!embedded&&<h3 className="text-sm font-medium">Additional observations</h3>}{rows&&!open&&<Button ref={addControl} size="sm" variant="ghost" onClick={e=>edit(null,e.currentTarget)}>Add observation</Button>}</header>
  {!embedded&&<p className="text-xs text-muted-foreground">Share specific firsthand observations from an interaction. Keep these separate from interview evaluations.</p>}
  {error&&embedded&&!open&&<p role="alert" className="text-sm text-muted-foreground">Couldn’t load observations · <Button size="sm" variant="ghost" className="h-auto px-1 py-0" onClick={()=>setRefresh(v=>v+1)}>Retry</Button></p>}
  {error&&!(embedded&&!open)&&<p role="alert" className="text-sm text-destructive">{error} {open?<><Button type="button" size="sm" variant="ghost" disabled={busy||count>50} onClick={()=>void save(pending.current?.remove??false)}>Retry save</Button><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>Reload observations</Button></>:<Button size="sm" variant="ghost" onClick={()=>setRefresh(v=>v+1)}>Retry</Button>}</p>}
  {!rows&&!error&&<p role="status" className="text-sm">Loading observations…</p>}
  {rows?.length===0&&<p className="text-xs text-muted-foreground">No shared additional observations.</p>}
  {rows?.map(row=><article key={row.id} className="space-y-1 border-l pl-3 text-sm"><p className="whitespace-pre-wrap break-words">{row.body}</p>{row.interactionContext&&<p className="text-xs">{row.interactionContext}</p>}<p className="text-xs text-muted-foreground">{row.author} · {new Date(row.updatedAt).toLocaleString()} · {row.roundName} · Version {row.revision}{row.locked?' · Referenced by a locked presentation':''}</p>{(row.canEdit||row.canModerate)&&<Button size="sm" variant="ghost" disabled={busy} onClick={e=>edit(row,e.currentTarget)}>{row.canEdit?'Edit observation':'Moderate observation'}</Button>}</article>)}
  {open&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void save();}}>
   <label htmlFor={`${id}-body`} className="block text-sm">Observation</label><Textarea id={`${id}-body`} ref={form} aria-describedby={`${id}-count ${id}-sharing`} aria-invalid={count>50} value={body} disabled={busy} onChange={e=>setBody(e.target.value)} rows={3}/>
   <p id={`${id}-count`} aria-live="polite" className={`text-xs ${count>50?'text-destructive':'text-muted-foreground'}`}>{count} / 50 words</p>
   <label className="block text-sm">Interaction context · Optional<input className="mt-1 block w-full rounded border bg-background p-2" value={context} disabled={busy} maxLength={160} onChange={e=>setContext(e.target.value)} placeholder="Club event or conversation"/></label>
   {moderating&&<label className="block text-sm">Moderation reason<input className="mt-1 block w-full rounded border bg-background p-2" required maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>}
   <p id={`${id}-sharing`} className="text-xs text-muted-foreground">Saving shares this observation with authorized applicant reviewers. Locked voting presentations retain their recorded version.</p>
   <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy||!body.trim()||count>50||moderating&&!reason.trim()}>{busy?'Saving…':editing?'Save shared observation':'Save and share'}</Button>{editing&&<Button type="button" variant="outline" size="sm" disabled={busy||moderating&&!reason.trim()} onClick={()=>void save(true)}>Remove observation</Button>}<Button type="button" variant="ghost" size="sm" disabled={busy} onClick={close}>Cancel</Button></div>
  </form>}
 </section>;
}
