"use client";
import Link from "next/link";
import type {ReactNode} from "react";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
import {Button} from "@/components/ui/button";
import {PageHeader} from "@/components/ui/page-header";
import {ChevronDown} from "@/components/icons";
import {liveRoomPath,savedOutcomeLabels} from "@/lib/voting-room";
import {SessionDetails} from "./session-details";
import {OutcomeCounts,type VotingSummaryState} from "./room-meeting";
import {RoundTracker,useRoundSummary} from "./round-tracker";
import {ProjectorThemeSwitch,useProjectorTheme} from "./projector-theme";
import {VoteStatus,roundLine,type RoomSnapshot} from "./audience-room";

type Entry=RoomSnapshot["history"][number]["candidates"][number];

/** The leader's applicant queue for this pass: each applicant's recorded outcome, the one being voted on, and the next. */
function Queue({room,label}:{room:RoomSnapshot;label:(id:string)=>string}){
 const pass=room.history.find(p=>p.number===room.passNumber),list=[...(pass?.candidates??[])].sort((a,b)=>a.position-b.position);
 const current=list.findIndex(c=>c.applicationId===room.currentApplicantId);
 if(!list.length)return <p className="vr-lead-muted">No applicants in this pass.</p>;
 const state=(c:Entry,i:number)=>c.ballotState==="CONFIRMED"&&c.outcome in savedOutcomeLabels?savedOutcomeLabels[c.outcome as keyof typeof savedOutcomeLabels]:i===current?(room.status==="OPEN"?"Voting now":"Current"):i===current+1&&current>=0?"Up next":"";
 return <ol className="vr-lead-queue">{list.map((c,i)=><li key={c.applicationId} aria-current={i===current?"step":undefined} data-outcome={c.ballotState==="CONFIRMED"?c.outcome:undefined}><span>{c.position+1} · {label(c.applicationId)}</span><span>{state(c,i)}</span></li>)}</ol>;
}

/**
 * Leader controls (view=leader): the applicant and the vote in the main column; round progress, who is in the room and
 * the queue beside it. Every existing control stays reachable: rarely used ones are under More and More actions.
 */
export function LeaderRoom({room,entry,clubId,sessionId,demoScoped,stage,controls,discussion,summaryState,onShowQr,qrButton,moreButton,nextLabel,refresh}:{room:RoomSnapshot;entry:Entry|undefined;clubId:string;sessionId:string;demoScoped:boolean;stage:ReactNode;controls:ReactNode;discussion:ReactNode;summaryState:VotingSummaryState;onShowQr:()=>void;qrButton:React.Ref<HTMLButtonElement>;moreButton:React.Ref<HTMLButtonElement>;nextLabel:string|null;refresh:()=>unknown}){
 const [theme,setTheme]=useProjectorTheme(sessionId),round=useRoundSummary(room);
 const label=(id:string)=>summaryState.summary?.labels.find(a=>a.id===id)?.label??`Applicant ${room.outcomes.findIndex(o=>o.applicationId===id)+1}`;
 const joined=room.joinedParticipants.filter(p=>p.joined).length;
 return <div className="vr-lead">
  <PageHeader title="Lead voting" status={roundLine(room)?<p className="vr-lead-round">{roundLine(room)}</p>:undefined} className="vr-lead-header" action={<div className="vr-lead-toolbar">
   <Button asChild variant="outline" size="sm"><Link target="_blank" rel="noopener" href={liveRoomPath(clubId,sessionId,"present",demoScoped)}>Show on projector</Link></Button>
   <Button asChild variant="outline" size="sm"><Link href={liveRoomPath(clubId,sessionId,"member",demoScoped)}>Vote on my phone</Link></Button>
   <ProjectorThemeSwitch value={theme} onChange={setTheme} className="vr-lead-theme"/>
   <Popover><PopoverTrigger asChild><Button ref={moreButton} className="vr-session-trigger" variant="ghost" size="sm">More <ChevronDown aria-hidden="true" size={16}/></Button></PopoverTrigger><PopoverContent align="end" aria-label="More session options" className="vr-session-options">
    {!demoScoped&&<Link className="vr-link" href={`/voting/rooms/${encodeURIComponent(sessionId)}/prepare?clubId=${encodeURIComponent(clubId)}`}>Prepare slides</Link>}
    <Button variant="outline" size="sm" onClick={onShowQr}>Join QR</Button>
    {room.meeting&&<SessionDetails clubId={clubId} sessionId={sessionId} revision={room.revision} meeting={room.meeting} leader={room.permissions.leader} demo={demoScoped} status={room.status} refresh={refresh as ()=>Promise<void>}/>}
   </PopoverContent></Popover>
  </div>}/>
  <div className="vr-lead-grid">
   <div className="vr-lead-main">
    {stage}
    {discussion}
    <div className="vr-lead-status"><VoteStatus room={room} entry={entry} next={nextLabel} variant="panel"/></div>
    {controls}
   </div>
   <aside className="vr-lead-side" aria-label="Session overview">
    <section aria-labelledby="vr-lead-progress"><h2 id="vr-lead-progress">Round progress</h2><RoundTracker summary={round.round} status={round.status} variant="panel"/>
     <details className="vr-lead-totals"><summary>Session and round totals</summary><OutcomeCounts room={room} round={round}/></details></section>
    <section aria-labelledby="vr-lead-room"><h2 id="vr-lead-room">In the room</h2><p><strong>{joined}</strong> {joined===1?"member":"members"} joined</p>
     <Button ref={qrButton} variant="outline" size="sm" onClick={onShowQr}>Show join QR</Button>
     <details className="vr-lead-joined"><summary>Joined participants · {joined}</summary><ul>{room.joinedParticipants.map(p=><li key={p.id}>{p.label} · {p.joined?"Joined":"Waiting"}</li>)}</ul></details></section>
    <section aria-labelledby="vr-lead-queue"><h2 id="vr-lead-queue">Applicants</h2><Queue room={room} label={label}/></section>
   </aside>
  </div>
 </div>;
}
