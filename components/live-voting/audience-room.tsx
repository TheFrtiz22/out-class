"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {PageHeader} from "@/components/ui/page-header";
import {OutClassQRCode} from "@/components/qr/outclass-qr-code";
import {useShortLinkUrl} from "@/components/qr/qr-code-card";
import {liveRoomPath,type RoomResult} from "@/lib/voting-room";
import type {useLiveVotingRoom} from "@/hooks/use-live-voting-room";
import {RoundTracker,useRoundSummary} from "./round-tracker";
import {ProjectorThemeSwitch,projectorThemeAttribute,useProjectorTheme,type ProjectorTheme} from "./projector-theme";

export type RoomSnapshot=NonNullable<ReturnType<typeof useLiveVotingRoom>["room"]>;
type Entry=RoomSnapshot["history"][number]["candidates"][number];
export const resultWords={ACCEPT:"Passed",HOLD:"Held",REJECT:"Did not pass"} as const;

/** Where the room is: the current applicant's place in this pass, as "Applicant 8 of 12". */
export function applicantPosition(room:RoomSnapshot){
 const pass=room.history.find(p=>p.number===room.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room.currentApplicantId);
 return entry&&pass?`Applicant ${entry.position+1} of ${pass.candidates.length}`:"";
}
/** The next applicant in this pass after the current one, or null at the end of the pass. */
export function nextApplicant(room:RoomSnapshot){
 const pass=room.history.find(p=>p.number===room.passNumber),entry=pass?.candidates.find(c=>c.applicationId===room.currentApplicantId);
 if(!pass||!entry)return null;
 return [...pass.candidates].sort((a,b)=>a.position-b.position).find(c=>c.position>entry.position)??null;
}
export function roundLine(room:RoomSnapshot){return [room.roundName,room.cycleName].filter(Boolean).join(" · ");}
export function shortLinkText(url:string){return url.replace(/^https?:\/\//,"");}

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

/** The projector while the room loads: the same frame, theme and header, so nothing shifts when the slide arrives. */
export function AudienceSkeleton({sessionId,children}:{sessionId:string;children:ReactNode}){
 const [theme]=useProjectorTheme(sessionId);
 return <div className="vr-aud" data-theme={projectorThemeAttribute(theme)}>
  <div className="vr-aud-slide" aria-busy="true">
   <header className="vr-aud-header"><PageHeader title="Live voting" className="vr-aud-title"/></header>
   <div className="vr-aud-tracker"><div className="vr-tracker"><div className="vr-tracker-head"><span className="vr-tracker-meta">&nbsp;</span></div><div className="vr-tracker-bar" aria-hidden="true"/></div></div>
   <div className="vr-aud-stage">{children}</div>
   <footer className="vr-aud-footer"><div className="vr-vote-status" data-variant="slide"><p className="vr-vote-state">&nbsp;</p></div></footer>
  </div>
 </div>;
}
