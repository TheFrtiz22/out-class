"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect,useRef,useState } from "react";
import { pollWhileVisible } from "@/hooks/use-revalidate";
import { getLiveVotingPresentation as read } from "@/lib/voting-room-api";
import { isStalePresentation } from "@/lib/voting-room";
import { ApplicantSlide,type VotingSlideData } from "./applicant-slide";
import { Button } from "@/components/ui/button";

type Data=VotingSlideData;
export function RoomPresentation({clubId,sessionId,applicationId,identity,refreshKey,member,onReady,onStale,paused=false,presenting=false}:{clubId:string;sessionId:string;applicationId:string;identity:string;refreshKey:number;member?:string;onReady?:()=>void;onStale?:()=>unknown;paused?:boolean;presenting?:boolean}){
  // Keyed by club, session (and so cycle and round) and applicant: another room's slide never shows, and late responses are ignored.
  const key=`${identity}:${clubId}:${sessionId}:${applicationId}`, [state,setState]=useState<{key:string;data:Data|null;error:boolean}>({key,data:null,error:false}),[retry,setRetry]=useState(0);
  const stale=useRef(onStale);useEffect(()=>{stale.current=onStale;});
  useEffect(()=>{if(paused)return;let current=true,busy=false;setState({key,data:null,error:false});const refresh=async()=>{if(busy)return;busy=true;try{const data=await read({clubId,sessionId,applicationId},member);if(!current)return;
    // The room moved on before this viewer's snapshot did: keep loading and fetch the current room, not an error.
    if(isStalePresentation(data)){setState({key,data:null,error:false});void stale.current?.();return;}
    setState({key,data,error:false});onReady?.();}catch{if(current)setState({key,data:null,error:true});}finally{busy=false;}};void refresh();const stopPolling=pollWhileVisible(refresh,5000,{whileHidden:presenting});return()=>{current=false;stopPolling();};},[clubId,sessionId,applicationId,identity,key,refreshKey,member,retry,onReady,paused,presenting]);
  const data=state.key===key?state.data:null;
  if(state.key===key&&state.error)return <div role="alert">Applicant information unavailable. <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry presentation</Button></div>;
  if(!data)return <LoadingState label="Loading applicant presentation…" layout="presentation" rows={3} />;
  return <ApplicantSlide key={key} data={data}/>;
}
