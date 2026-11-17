"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {PageHeader} from "@/components/ui/page-header";
import {OutClassQRCode} from "@/components/qr/outclass-qr-code";
import {useShortLinkUrl} from "@/components/qr/use-short-link-url";
import {liveRoomPath,type RoomResult} from "@/lib/voting-room";
import {RoundTracker,useRoundSummary} from "./round-tracker";
import {VoteStatus} from "./vote-status";
import {useVotingSummary} from "./use-voting-summary";
import {applicantPosition,nextName,resultWords,roundLine,shortLinkText,type Entry,type RoomSnapshot} from "./room-names";
import {ProjectorThemeSwitch,projectorThemeAttribute,useProjectorTheme,type ProjectorTheme} from "./projector-theme";

/** Counts only, after the leader closes the ballot: the outcome, the three totals and the rule. Never a ballot. */
export function VoteResult({room,entry,outcome,variant="slide"}:{room:RoomSnapshot;entry:Entry;outcome:RoomResult|null;variant?:"slide"|"panel"}){
 const totals="totals"in entry?entry.totals:null;
 if(!totals)return null;
 const decided=outcome?.outcome??(entry.ballotState==="CONFIRMED"&&entry.outcome!=="UNREVIEWED"?entry.outcome as keyof typeof resultWords:room.ruleResult?.outcome??null);
 const cast=totals.ACCEPT+totals.HOLD+totals.REJECT,max=Math.max(cast,1);
 const rows=[["Pass","ACCEPT",totals.ACCEPT],["Hold","HOLD",totals.HOLD],["Do not pass","REJECT",totals.REJECT]] as const;
 // The short, plain rule line: the rule's own result once it has counted, otherwise who decides.
 const rule=room.ruleResult?.summary??(room.rule?.mode==="THRESHOLD"?null:"the leader confirms each outcome");
 return <div className="vr-aud-result" data-variant={variant} data-outcome={decided??undefined} aria-live="polite">
  <div className="vr-aud-result-head">
   <p className="vr-aud-kicker">Result</p>
   <p className="vr-aud-word">{decided?resultWords[decided]:"Vote closed"}</p>
   {decided==="ACCEPT"&&room.nextRoundName&&<p className="vr-aud-advance">Advances to {room.nextRoundName}</p>}
   {!decided&&<p className="vr-aud-advance">The leader confirms the outcome</p>}
  </div>
  <dl className="vr-aud-bars" aria-label="Closed ballot totals">{rows.map(([label,key,n])=><div key={key} data-choice={key}>
   <dt>{label}</dt><dd className="vr-aud-bar" aria-hidden="true"><span style={{width:`${n*100/max}%`}}/></dd><dd className="vr-aud-bar-count">{n}</dd></div>)}</dl>
  <p className="vr-aud-meta">{room.participation.voted} of {room.participation.eligible} in the room voted{rule?` · ${rule}`:""}</p>
 </div>;
}

/** The projector QR and its short link, from the first-party short-link system. */
export function JoinCode({clubId,sessionId,demo,size}:{clubId:string;sessionId:string;demo:boolean;size:number}){
 const url=useShortLinkUrl(liveRoomPath(clubId,sessionId,"member",demo));
 return <div className="vr-aud-join">
  <p><span>Members: scan to vote</span>{url&&<strong>{shortLinkText(url)}</strong>}</p>
  <OutClassQRCode value={url} size={size} variant="compact" showLogo ariaLabel="QR code to join this voting session" className="vr-aud-qr"/>
 </div>;
}
/** The slide's base unit in pixels (1em), so the QR follows the slide scale like the text does. */
function useSlideUnit(ref:React.RefObject<HTMLElement|null>){
 const [unit,setUnit]=useState(20);
 useEffect(()=>{const el=ref.current;if(!el)return;const read=()=>setUnit(parseFloat(getComputedStyle(el).fontSize)||20);read();
  const o=typeof ResizeObserver==="function"?new ResizeObserver(read):null;o?.observe(el);return()=>o?.disconnect();},[ref]);
 return unit;
}

/**
 * The audience slide (view=present): one 16:9 screen with the round tracker, the person and every enabled field, and
 * the vote state. Nothing scrolls; long notes step down in size to fit (audience-slide.tsx).
 */
export function AudienceRoom({room,entry,clubId,sessionId,demo,stage,nextLabel}:{room:RoomSnapshot;entry:Entry|undefined;clubId:string;sessionId:string;demo:boolean;stage:ReactNode;nextLabel:string|null}){
 const [theme,setTheme]=useProjectorTheme(sessionId),summary=useRoundSummary(room);
 return <SlideFrame theme={theme} round={roundLine(room)}
  headerEnd={unit=><><ProjectorThemeSwitch value={theme} onChange={setTheme} label="Slide theme" className="vr-aud-theme"/><JoinCode clubId={clubId} sessionId={sessionId} demo={demo} size={Math.round(unit*3.6)}/></>}
  tracker={<RoundTracker summary={summary.round} status={summary.status} variant="slide" position={applicantPosition(room)}/>}
  stage={stage} footer={<><VoteStatus room={room} entry={entry} next={nextLabel} variant="slide"/><p className="sr-only">{entry?`${applicantPosition(room)}. ${entry.ballotState==="OPEN"?"Voting open":"Voting closed or waiting"}.`:"Waiting for the leader."}</p></>}/>;
}
/** The 16:9 slide frame shared by the projector and the setup preview; sizes follow the frame, not the window. */
export function SlideFrame({theme,round,headerEnd,tracker,stage,footer,preview=false}:{theme:ProjectorTheme;round:string;headerEnd:(unit:number)=>ReactNode;tracker:ReactNode;stage:ReactNode;footer:ReactNode;preview?:boolean}){
 const slide=useRef<HTMLDivElement>(null),unit=useSlideUnit(slide);
 return <div className="vr-aud" data-preview={preview||undefined} data-theme={projectorThemeAttribute(theme)}>
  <div ref={slide} className="vr-aud-slide">
   <header className="vr-aud-header">
    {preview?<p className="vr-aud-title"><span className="vr-aud-name">Live voting</span>{round&&<span className="vr-aud-round">{round}</span>}</p>
     :<PageHeader title="Live voting" status={round?<p className="vr-aud-round">{round}</p>:undefined} className="vr-aud-title"/>}
    <div className="vr-aud-header-end">{headerEnd(unit)}</div>
   </header>
   <section aria-label="Round progress" className="vr-aud-tracker">{tracker}</section>
   <div className="vr-aud-stage">{stage}</div>
   <footer className="vr-aud-footer">{footer}</footer>
  </div>
 </div>;
}


/** The projector's result for a closed ballot, bound to the snapshot it closed in (the outgoing slide keeps it). */
function closedResult(room:RoomSnapshot,entry:Entry){
 return function ClosedResult(outcome:RoomResult|null){return <VoteResult room={room} entry={entry} outcome={outcome}/>;};
}
type StageOptions={aside?:(outcome:RoomResult|null)=>ReactNode;idle?:React.ReactElement};
/** The projector view: loaded on demand for view=present only. */
export function AudienceView({room,entry,clubId,sessionId,demoScoped,stage}:{room:RoomSnapshot;entry:Entry|undefined;clubId:string;sessionId:string;demoScoped:boolean;stage:(options:StageOptions)=>ReactNode}){
 const {summary}=useVotingSummary(room,room.permissions.leader);
 // #392 marks the viewer's own application on the snapshot (ownApplicant): no result or totals for it.
 const own=(room as {ownApplicant?:boolean}).ownApplicant===true;
 const aside=!own&&entry&&(entry.ballotState==="CLOSED"||entry.ballotState==="CONFIRMED")&&room.status==="OPEN"?closedResult(room,entry):undefined;
 const idle=room.status==="DRAFT"?<section className="vr-applicant vr-aud-waiting" aria-label="Waiting room"><h2 data-applicant-heading tabIndex={-1}>Ready when your leader is</h2><p>Voting has not started. Scan the code to join.</p><JoinCode clubId={clubId} sessionId={sessionId} demo={demoScoped} size={220}/></section>:undefined;
 return <AudienceRoom room={room} entry={entry} clubId={clubId} sessionId={sessionId} demo={demoScoped} stage={stage({aside,idle})} nextLabel={nextName(room,summary?.labels)}/>;
}
