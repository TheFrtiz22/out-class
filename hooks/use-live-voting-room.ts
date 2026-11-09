"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getLiveVotingRoom } from "@/lib/voting-room-api";
import { votingRoomSubscription, coalescedRefresh } from "@/lib/voting-room-subscription";
import { newerByRevision } from "@/lib/voting-target-summary";
type Snapshot=Awaited<ReturnType<typeof getLiveVotingRoom>>;
/** Part 2 supplies current authenticated user ID; QR/session IDs are never identities. */
export function useLiveVotingRoom(clubId:string,sessionId:string,userId:string|null,demoMemberId?:string){
  const identity=`${userId}:${clubId}:${sessionId}:${demoMemberId??"live"}`;
  const [state,setState]=useState<{identity:string;room:Snapshot|null;error:string|null}>({identity,room:null,error:null});
  const connection=useRef<ReturnType<typeof votingRoomSubscription<Snapshot>>|null>(null);
  useEffect(()=>{
    setState({identity,room:null,error:null});
    if(!userId)return;
    // An older room revision (e.g. a slow read landing after a command's refresh) never replaces a newer one,
    // so decision counts and the target summary cannot regress or double-apply. A failed read still clears state.
    const subscription=votingRoomSubscription(()=>getLiveVotingRoom({clubId,sessionId},demoMemberId),(room,error)=>setState(prev=>({identity,room:room&&prev.identity===identity?newerByRevision(prev.room,room):room,error})));
    connection.current=subscription;
    // focus and visibilitychange usually fire together on a tab switch: one refresh, not two.
    const refresh=coalescedRefresh(()=>subscription.refresh());
    // Background tabs throttle timers; catch up as soon as this tab is shown again.
    const visible=()=>{if(document.visibilityState==="visible")refresh();};
    window.addEventListener("online",refresh);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visible);
    return ()=>{subscription.close();connection.current=null;window.removeEventListener("online",refresh);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visible);};
  },[identity,clubId,sessionId,userId,demoMemberId]);
  const refresh=useCallback(()=>connection.current?.refresh(),[]);
  return {...(state.identity===identity?state:{identity,room:null,error:null}),refresh};
}
