"use client";
import { LoadingState } from "@/components/ui/loading-state"
import {useEffect,useState} from 'react';
import {previewVotingSetup} from '@/lib/voting-room-api';
import type {LiveRoomField} from '@/lib/voting-room';
import {narrowVotingSlide,narrowsExactly} from '@/lib/voting-slide-fields';
import {ApplicantSlide} from './applicant-slide';
import {Button} from '@/components/ui/button';

type Preview=Awaited<ReturnType<typeof previewVotingSetup>>;
const read=(key:string)=>{const v=JSON.parse(key);return previewVotingSetup({clubId:v.clubId,cycleId:v.cycleId,roundId:v.roundId,applicationId:v.applicationId,options:{fields:v.fields,highlights:v.highlights}});};

/**
 * The real room slide for one applicant, as voters will see it. A switch takes effect at once: the slide read
 * with every allowed field is narrowed to the selection locally, then the exact read for that selection
 * (the same server projection the room uses) replaces it. Nothing here saves.
 */
export function SetupPresentationPreview({clubId,cycleId,roundId,applicationId,fields,allowedFields,highlights}:{clubId:string;cycleId:string;roundId:string;applicationId:string;fields:LiveRoomField[];allowedFields:LiveRoomField[];highlights:Record<string,string>}){
 const [full,setFull]=useState<{key:string;data:Preview}|null>(null),[exact,setExact]=useState<{key:string;data:Preview}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const fullKey=JSON.stringify({clubId,cycleId,roundId,applicationId,fields:allowedFields,highlights}),key=JSON.stringify({clubId,cycleId,roundId,applicationId,fields,highlights});
 useEffect(()=>{let current=true;read(fullKey).then(data=>{if(current)setFull({key:fullKey,data})}).catch(()=>{});return()=>{current=false};},[fullKey,retry]);
 // A short pause lets several quick switches share one exact read.
 useEffect(()=>{let current=true;setError('');const timer=setTimeout(()=>{read(key).then(data=>{if(current)setExact({key,data})}).catch(()=>{if(current)setError('Preview unavailable. Check eligibility and retry.');});},200);return()=>{current=false;clearTimeout(timer)};},[key,retry]);
 const current=exact?.key===key,narrowed=!current&&full?.key===fullKey;
 const data=current?exact.data:narrowed?narrowVotingSlide(full.data,fields):exact?.data??null;
 // Busy until the exact read lands whenever the local version may hold back interview evidence.
 const stale=!!data&&!current&&(!narrowed||!narrowsExactly(fields));
 // A failed exact read never leaves a stand-in on screen as if it were what voters see.
 if(error&&!current)return <p role="alert">{error} <Button variant="outline" size="sm" onClick={()=>setRetry(v=>v+1)}>Retry preview</Button></p>;
 if(!data)return <LoadingState label="Loading preview…" layout="presentation" />;
 return <div aria-busy={stale||undefined} className={stale?'opacity-60':undefined}><ApplicantSlide key={applicationId} data={data}/></div>;
}
