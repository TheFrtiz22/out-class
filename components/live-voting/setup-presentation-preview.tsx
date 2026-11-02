"use client";
import {useEffect,useState} from 'react';
import {previewVotingSetup} from '@/lib/voting-room-api';
import type {LiveRoomField} from '@/lib/voting-room';
import {fieldLabels} from '@/lib/applicant-display';
import {Button} from '@/components/ui/button';
import Image from 'next/image';
export function SetupPresentationPreview({clubId,cycleId,roundId,applicationId,fields,highlights}:{clubId:string;cycleId:string;roundId:string;applicationId:string;fields:LiveRoomField[];highlights:Record<string,string>}){
 const [state,setState]=useState<{key:string;data:Awaited<ReturnType<typeof previewVotingSetup>>}|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0),key=JSON.stringify({clubId,cycleId,roundId,applicationId,fields,highlights});
 useEffect(()=>{let current=true;setState(null);setError('');const input=JSON.parse(key);previewVotingSetup({clubId:input.clubId,cycleId:input.cycleId,roundId:input.roundId,applicationId:input.applicationId,options:{fields:input.fields,highlights:input.highlights}}).then(data=>{if(current)setState({key,data})}).catch(()=>{if(current)setError('Preview unavailable. Check eligibility and retry.');});return()=>{current=false};},[key,retry]);
 const data=state?.key===key?state.data:null;
 return <section aria-label="Presentation preview" className="rounded border p-4 space-y-3"><h2>Presentation preview</h2>{error?<p role="alert">{error} <Button variant="outline" size="sm" onClick={()=>setRetry(v=>v+1)}>Retry preview</Button></p>:!data?<p role="status">Loading preview…</p>:<>{data.photo&&<Image unoptimized src={data.photo} alt="Applicant headshot" width={76} height={76}/>}<div className="vr-fields">{data.sections.map(s=><section key={s.field}><h3>{fieldLabels[s.field]}</h3><p className="whitespace-pre-wrap break-words">{s.items.join(' · ')||'Not provided'}</p></section>)}{fields.includes('resumeHighlight')&&<section><h3>Leader-selected résumé excerpt</h3><p>{data.resumeHighlight?`Page ${data.resumeHighlight.page} · ${data.resumeHighlight.quote}`:'No authorized excerpt selected'}</p></section>}{fields.includes('interviewScore')&&<section><h3>Cumulative interview score</h3><p>{data.interviewScore?.average==null?data.interviewScore?.withheld?'Withheld under current review permissions':'Not scored':`${data.interviewScore.average} / 10 · ${data.interviewScore.submitted} submitted reviews · ${data.interviewScore.rounds} authorized rounds`}</p>{data.interviewScore&&<p className="text-sm text-muted-foreground">{data.interviewScore.scope}. Missing scores are excluded.</p>}</section>}</div></>}</section>;
}
