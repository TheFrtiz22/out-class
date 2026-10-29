"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect,useRef,useState } from "react";
import type { getLiveVotingPresentation } from "@/actions/voting-room";
import { getLiveVotingPresentation as read } from "@/lib/voting-room-api";
import { Dialog,DialogContent,DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fieldLabels } from "@/lib/applicant-display";
import { formatAverage } from "@/lib/interview-review-summary";
import Image from "next/image";
type Data=Awaited<ReturnType<typeof getLiveVotingPresentation>>;
export function RoomPresentation({clubId,sessionId,applicationId,identity,refreshKey,member}:{clubId:string;sessionId:string;applicationId:string;identity:string;refreshKey:number;member?:string}){
  const origin=useRef<HTMLButtonElement|null>(null);
  function openDetails(e:React.MouseEvent<HTMLButtonElement>){origin.current=e.currentTarget;setDetails(true);}
  const key=`${identity}:${applicationId}`, [state,setState]=useState<{key:string;data:Data|null;error:boolean}>({key,data:null,error:false}),[details,setDetails]=useState(false),[retry,setRetry]=useState(0);
  useEffect(()=>{let current=true,busy=false;setState({key,data:null,error:false});setDetails(false);const refresh=async()=>{if(busy)return;busy=true;try{const data=await read({clubId,sessionId,applicationId},member);if(current)setState({key,data,error:false});}catch{if(current)setState({key,data:null,error:true});}finally{busy=false;}};void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>{current=false;clearInterval(timer);};},[clubId,sessionId,applicationId,identity,key,refreshKey,member,retry]);
  const data=state.key===key?state.data:null;
  if(state.key===key&&state.error)return <div role="alert">Applicant information unavailable. <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry presentation</Button></div>;
  if(!data)return <LoadingState label="Loading applicant presentation…" layout="rows" rows={3} />;
  const name=data.sections.find(s=>s.field==="name")?.items[0]??(data.anonymous?"Anonymous applicant":"Applicant");
  const fields=data.sections.filter(s=>s.field!=="name").map(s=>({label:fieldLabels[s.field],text:s.items.join(" · ")||"Not provided"}));
  if(data.requestedFields?.includes("resumeHighlight"))fields.push({label:"Leader-selected résumé excerpt",text:data.resumeHighlight?`Page ${data.resumeHighlight.page} · ${data.resumeHighlight.quote}`:"No authorized excerpt available"});
  if(data.requestedFields?.includes("interviewScore"))fields.push({label:"Cumulative interview score",text:data.interviewScore?.average!=null?`${formatAverage(data.interviewScore.average)} / 10 · ${data.interviewScore.submitted} submitted reviews · ${data.interviewScore.rounds} authorized rounds`:(data.interviewScore?.withheld?"Withheld under current review permissions":"Not scored")});
  return <section aria-label="Current applicant presentation" className="vr-applicant">
    <header className="vr-person">{data.photo&&<Image unoptimized width={76} height={76} src={data.photo} alt="Applicant headshot" className="vr-photo"/>}<h2>{name}</h2></header>
    <div className="vr-fields">{fields.map((f,i)=><section className="vr-field" key={`${f.label}:${i}`}><h3>{f.label}</h3><p>{f.text.length>170?`${f.text.slice(0,167)}…`:f.text}</p>{f.text.length>170&&<button className="vr-link" onClick={openDetails}>Read full {f.label.toLowerCase()}</button>}</section>)}</div>
    <footer><Button variant="outline" size="sm" onClick={openDetails}>Applicant details</Button></footer>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();origin.current?.focus();}} className="max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}><DialogTitle>{name} · Details</DialogTitle>{fields.map((f,i)=><section key={i}><h3 className="font-medium">{f.label}</h3><p className="whitespace-pre-wrap break-words">{f.text}</p></section>)}{data.interviewScore&&<p className="text-sm text-muted-foreground">{data.interviewScore.scope}. Missing scores are excluded.</p>}</DialogContent></Dialog>
  </section>;
}
