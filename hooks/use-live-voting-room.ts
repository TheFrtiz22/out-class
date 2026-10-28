"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getLiveVotingRoom } from "@/actions/voting-room";
import { votingRoomSubscription } from "@/lib/voting-room-subscription";
type Snapshot=Awaited<ReturnType<typeof getLiveVotingRoom>>;
/** Part 2 supplies current authenticated user ID; QR/session IDs are never identities. */
export function useLiveVotingRoom(clubId:string,sessionId:string,userId:string|null){
  const identity=`${userId}:${clubId}:${sessionId}`;
  const [state,setState]=useState<{identity:string;room:Snapshot|null;error:string|null}>({identity,room:null,error:null});
  const connection=useRef<ReturnType<typeof votingRoomSubscription<Snapshot>>|null>(null);
  useEffect(()=>{
    setState({identity,room:null,error:null});
    if(!userId)return;
    const subscription=votingRoomSubscription(()=>getLiveVotingRoom({clubId,sessionId}),(room,error)=>setState({identity,room,error}));
    connection.current=subscription;
    const refresh=()=>void subscription.refresh();
    window.addEventListener("online",refresh);window.addEventListener("focus",refresh);
    return ()=>{subscription.close();connection.current=null;window.removeEventListener("online",refresh);window.removeEventListener("focus",refresh);};
  },[identity,clubId,sessionId,userId]);
  const refresh=useCallback(()=>connection.current?.refresh(),[]);
  return {...(state.identity===identity?state:{identity,room:null,error:null}),refresh};
}
