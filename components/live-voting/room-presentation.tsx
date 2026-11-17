"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect,useRef,useState } from "react";
import { pollWhileVisible } from "@/hooks/use-revalidate";
import { getLiveVotingPresentation as read } from "@/lib/voting-room-api";
import { isStalePresentation,type RoomResult } from "@/lib/voting-room";
import { ApplicantSlide,type VotingSlideData } from "./applicant-slide";
import { Button } from "@/components/ui/button";

type Data=VotingSlideData|OwnApplication;
/** The viewer's own application (#392 returns {ownApplication:true} for it): nothing applicant-specific is rendered.
 * After #392 merges, replace with isOwnApplicationPresentation / OWN_APPLICATION_MESSAGE from lib/voting-room. */
type OwnApplication={ownApplication:true};
export const isOwnApplication=(value:unknown):value is OwnApplication=>!!value&&typeof value==="object"&&(value as {ownApplication?:unknown}).ownApplication===true;
export const OWN_APPLICATION_TEXT="You’re the applicant on screen; you can’t see or vote on this one.";
/** `paused` keeps the loaded slide on screen without reading or polling (the outgoing applicant during a transition);
 *  `outcome` shows that applicant's confirmed result beside the name. */
export function RoomPresentation({clubId,sessionId,applicationId,identity,refreshKey,member,onReady,onFailed,onStale,paused=false,presenting=false,outcome=null,variant="default",aside,position}:{clubId:string;sessionId:string;applicationId:string;identity:string;refreshKey:number;member?:string;onReady?:()=>void;onFailed?:()=>void;onStale?:()=>unknown;paused?:boolean;presenting?:boolean;outcome?:RoomResult|null;variant?:"default"|"audience"|"leader";aside?:(outcome:RoomResult|null)=>React.ReactNode;position?:string}){
  // Keyed by club, session (and so cycle and round) and applicant: another room's slide never shows, and late responses are ignored.
  const key=`${identity}:${clubId}:${sessionId}:${applicationId}`, [state,setState]=useState<{key:string;data:Data|null;error:boolean}>({key,data:null,error:false}),[retry,setRetry]=useState(0);
  const stale=useRef(onStale);useEffect(()=>{stale.current=onStale;});
  // A slide that is already loaded for this applicant stays on screen while it re-reads (e.g. Undo back to it).
  useEffect(()=>{if(paused)return;let current=true,busy=false;setState(s=>s.key===key&&s.data&&!s.error?s:{key,data:null,error:false});const refresh=async()=>{if(busy)return;busy=true;try{const data=await read({clubId,sessionId,applicationId},member);if(!current)return;
    // The room moved on before this viewer's snapshot did: keep loading and fetch the current room, not an error.
    if(isStalePresentation(data)){setState({key,data:null,error:false});void stale.current?.();return;}
    setState({key,data,error:false});onReady?.();}catch{if(current){setState({key,data:null,error:true});onFailed?.();}}finally{busy=false;}};void refresh();const stopPolling=pollWhileVisible(refresh,5000,{whileHidden:presenting});return()=>{current=false;stopPolling();};},[clubId,sessionId,applicationId,identity,key,refreshKey,member,retry,onReady,onFailed,paused,presenting]);
  const data=state.key===key?state.data:null;
  if(state.key===key&&state.error)return <div role="alert">Applicant information unavailable. <Button variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry presentation</Button></div>;
  if(!data)return <LoadingState label="Loading applicant presentation…" layout="presentation" rows={3} />;
  // No slide, scholar status, totals or result for the viewer's own application, on any view.
  if(isOwnApplication(data))return <p role="status" className="vr-own-application">{OWN_APPLICATION_TEXT}</p>;
  return <ApplicantSlide key={key} data={data} outcome={outcome} variant={variant} aside={aside} position={position}/>;
}
