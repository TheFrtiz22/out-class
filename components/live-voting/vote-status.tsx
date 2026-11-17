"use client";
import {applicantPosition,type Entry,type RoomSnapshot} from "./room-names";

/** The status line along the bottom of the projector. While voting is open it shows only how many have voted. */
export function VoteStatus({room,entry,next,variant}:{room:RoomSnapshot;entry:Entry|undefined;next:string|null;variant:"slide"|"panel"}){
 const {voted,eligible}=room.participation,share=eligible?Math.min(100,voted*100/eligible):0;
 const open=room.status==="OPEN"&&entry?.ballotState==="OPEN";
 const label=room.status==="COMPLETED"?"Voting ended":room.status==="DRAFT"?"Voting has not started":room.status==="PAUSED"?"Waiting for the leader":open&&room.votingPaused?"Voting paused":open?"Voting open":entry?.ballotState==="CLOSED"||entry?.ballotState==="CONFIRMED"?"Vote closed":"Waiting for voting";
 const detail=open&&!room.votingPaused?(variant==="slide"?"vote on your phone":""):label==="Vote closed"&&next?`next: ${next}`:"";
 return <div className="vr-vote-status" data-variant={variant} data-state={open?"open":"waiting"}>
  <div className="vr-vote-left"><p className="vr-vote-state"><strong>{label}</strong>{detail&&<span> · {detail}</span>}</p>
  {variant==="slide"&&open&&<p className="vr-pass-meaning" data-pass-meaning={room.targetSummary.pass.kind}>{room.targetSummary.pass.label}</p>}</div>
  {open?<div className="vr-vote-count"><span className="vr-vote-meter" aria-hidden="true"><span style={{width:`${share}%`}}/></span><p aria-live="polite"><strong>{voted}</strong> of {eligible} in the room voted</p></div>
   :<p className="vr-vote-position">{applicantPosition(room)}</p>}
 </div>;
}
