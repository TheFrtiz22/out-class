"use client";
import {useEffect,useRef,useState} from "react";
import {getRoundTargetSummary} from "@/lib/voting-room-api";
import type {ScopedTargetSummary} from "@/components/voting-target-summary";
import {roundTrackerCounts} from "@/lib/voting-target-summary";

type RoomScope={clubId:string;cycleId:string|null;roundId:string;accessVersion?:string;outcomes:readonly {applicationId:string;passNumber:number;outcome:string}[]};
import {outcomeSignature} from "./room-names";
export {outcomeSignature};

/**
 * Entire-round counts (every session of the round this viewer may open), from the same server-authorized read the
 * leader's "Entire round" figures use. Keyed by club, cycle and round, so another round's counts never show while this
 * one loads; re-read only when a confirmed outcome changes, never on each ballot.
 */
export function useRoundSummary(room:RoomScope|null){
 const scope=room?`${room.clubId}:${room.cycleId}:${room.roundId}`:"";
 const [loaded,setLoaded]=useState<{scope:string;round:ScopedTargetSummary|null;status:string}|null>(null),ticket=useRef(0);
 const outcomeKey=room?outcomeSignature(room):"";
 useEffect(()=>{
  if(!room)return;const mine=++ticket.current,at=`${room.clubId}:${room.cycleId}:${room.roundId}`;
  getRoundTargetSummary({clubId:room.clubId,roundId:room.roundId,...(room.cycleId?{cycleId:room.cycleId}:{})})
   .then(r=>{if(mine===ticket.current)setLoaded({scope:at,round:r,status:""});})
   .catch(()=>{if(mine===ticket.current)setLoaded({scope:at,round:null,status:"Round totals unavailable."});});
 // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read on scope, access and confirmed-outcome changes only
 },[room?.clubId,room?.roundId,room?.cycleId,room?.accessVersion,outcomeKey]);
 const current=loaded?.scope===scope?loaded:null;
 return {round:current?.round??null,status:current?current.status:"Loading…"};
}

/**
 * The round tracker: four counts and one segmented bar in the same order, with the target marked on the bar.
 * Counts are always written out, so the bar's colours never carry meaning alone. The target is guidance only.
 */
export function RoundTracker({summary,status,variant,position}:{summary:ScopedTargetSummary|null;status?:string;variant:"slide"|"panel";position?:string}){
 if(!summary)return <div className="vr-tracker" data-variant={variant}><p className="vr-tracker-status" role="status">{status||"Loading…"}</p></div>;
 const c=roundTrackerCounts(summary),reached=c.reached;
 const segments=[["pass",c.passed],["fail",c.failed],["held",c.held],["togo",c.toGo]] as const;
 const marker=c.markerPercent;
 const targetText=c.target===null?null:reached?`Target of ${c.target} reached · voting can continue`:variant==="panel"?`Target ${c.target} to pass · ${c.target-c.passed} more to reach it`:`Target ${c.target} to pass`;
 const figures=[["Passed","passed",c.passed],["Did not pass","failed",c.failed],["Held","held",c.held],["To go","togo",c.toGo]] as const;
 return <div className="vr-tracker" data-variant={variant} data-target-reached={reached||undefined}>
  <div className="vr-tracker-head">
   <dl className="vr-tracker-counts" aria-label="Round progress">{figures.map(([label,key,n])=><div key={key} data-count={key}><dt>{variant==="slide"?label.toLowerCase():label}</dt><dd>{n}</dd></div>)}</dl>
   {variant==="slide"&&(position||targetText)&&<p className="vr-tracker-meta" data-reached={reached||undefined}>{reached?targetText:[position,targetText].filter(Boolean).join(" · ")}</p>}
  </div>
  <div className="vr-tracker-bar" aria-hidden="true">
   {segments.map(([key,n])=>n>0&&<span key={key} data-segment={key} style={{flexGrow:n}}/>)}
   {marker!==null&&<span className="vr-tracker-marker" style={{left:`${marker}%`}}/>}
  </div>
  {variant==="panel"&&<p className="vr-tracker-meta" data-reached={reached||undefined}>{[targetText??"No target set",summary.sessions!==undefined?`${summary.sessions} ${summary.sessions===1?"session":"sessions"} this round`:null].filter(Boolean).join(" · ")}</p>}
  {summary.partial&&<p className="vr-tracker-meta">Includes only voting sessions you can open.</p>}
 </div>;
}
