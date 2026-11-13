"use client";
import { LoadingState } from "@/components/ui/loading-state"
import {useEffect,useState} from 'react';
import {previewVotingSetup} from '@/lib/voting-room-api';
import type {LiveRoomField} from '@/lib/voting-room';
import {ApplicantSlide} from './applicant-slide';
import {Button} from '@/components/ui/button';

export function SetupPresentationPreview({clubId,cycleId,roundId,applicationId,fields,highlights}:{clubId:string;cycleId:string;roundId:string;applicationId:string;fields:LiveRoomField[];highlights:Record<string,string>}){
 const [state,setState]=useState<{key:string;data:Awaited<ReturnType<typeof previewVotingSetup>>}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),key=JSON.stringify({clubId,cycleId,roundId,applicationId,fields,highlights});
 useEffect(()=>{let current=true;setError('');const input=JSON.parse(key);previewVotingSetup({clubId:input.clubId,cycleId:input.cycleId,roundId:input.roundId,applicationId:input.applicationId,options:{fields:input.fields,highlights:input.highlights}}).then(data=>{if(current)setState({key,data})}).catch(()=>{if(current)setError('Preview unavailable. Check eligibility and retry.');});return()=>{current=false};},[key,retry]);
 // While a changed field reloads, the previous slide stays in place (marked busy) so the page doesn't jump under the pointer.
 const data=state?.data??null,refreshing=!!state&&state.key!==key;
 return <section aria-label="Presentation preview" className="rounded border p-4 space-y-3"><h2>Presentation preview</h2>{error?<p role="alert">{error} <Button variant="outline" size="sm" onClick={()=>setRetry(v=>v+1)}>Retry preview</Button></p>:!data?<LoadingState label="Loading preview…" layout="presentation" />:<div aria-busy={refreshing||undefined} className={refreshing?'opacity-60':undefined}><ApplicantSlide key={state!.key} data={data}/></div>}</section>;
}
