"use client";
import {useEffect,useState} from "react";
import {getLiveVotingSummary} from "@/lib/voting-room-api";
import {outcomeSignature,type RoomSnapshot} from "./room-names";
type Summary=Awaited<ReturnType<typeof getLiveVotingSummary>>;

/** Applicant labels, later rounds and the summary lists: refetched on phase, outcome or access changes only (labels
 * and later rounds do not change with ballots). Shared by the leader's queue and the controls. */
export function useVotingSummary(room:RoomSnapshot,enabled=true){
 const [summary,setSummary]=useState<Summary|null>(null),[error,setError]=useState(false),[reload,setReload]=useState(0);
 const key=`${room.status}:${room.passNumber}:${room.finalizedAt??""}:${room.accessVersion}:${outcomeSignature(room)}`;
 useEffect(()=>{let live=true;setSummary(null);setError(false);if(!enabled)return;getLiveVotingSummary({clubId:room.clubId,sessionId:room.id}).then(s=>{if(live)setSummary(s)}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[room.clubId,room.id,key,reload,enabled]);
 return {summary,error,reload:()=>setReload(v=>v+1)};
}
export type VotingSummaryState=ReturnType<typeof useVotingSummary>;
