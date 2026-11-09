"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect,useState } from "react";
import { pollWhileVisible } from "@/hooks/use-revalidate";
import type { getLiveVotingPresentation } from "@/actions/voting-room";
import { getLiveVotingPresentation as read } from "@/lib/voting-room-api";
import { ApplicantSlide } from "./applicant-slide";
import { Button } from "@/components/ui/button";

type Data=Awaited<ReturnType<typeof getLiveVotingPresentation>>;
export function RoomPresentation({clubId,sessionId,applicationId,identity,refreshKey,member,onReady,paused=false,presenting=false}:{clubId:string;sessionId:string;applicationId:string;identity:string;refreshKey:number;member?:string;onReady?:()=>void;paused?:boolean;presenting?:boolean}){
  const key=`${identity}:${applicationId}`, [state,setState]=useState<{key:string;data:Data|null;error:boolean}>({key,data:null,error:false}),[retry,setRetry]=useState(0);
  useEffect(()=>{if(paused)return;let current=true,busy=false;setState({key,data:null,error:false});const refresh=async()=>{if(busy)return;busy=true;try{const data=await read({clubId,sessionId,applicationId},member);if(current){setState({key,data,error:false});onReady?.();}}catch{if(current)setState({key,data:null,error:true});}finally{busy=false;}};void refresh();const stopPolling=pollWhileVisible(refresh,5000,{whileHidden:presenting});return()=>{current=false;stopPolling();};},[clubId,sessionId,applicationId,identity,key,refreshKey,member,retry,onReady,paused,presenting]);
  const data=state.key===key?state.data:null;
  if(state.key===key&&state.error)return <div role="alert">Applicant information unavailable. <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry presentation</Button></div>;
  if(!data)return <LoadingState label="Loading applicant presentation…" layout="presentation" rows={3} />;
  return <ApplicantSlide key={key} data={data}/>;
}
