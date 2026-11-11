"use client";
import {cloneElement,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactElement} from "react";
import {resultOutcomeLabel,type RoomResult} from "@/lib/voting-room";
import {Check,Pause,XIcon} from "@/components/icons";

/** How long the decision result holds before the next applicant, unless the leader opens voting sooner. */
export const RESULT_HOLD_MS=1400; // plus the 550 ms slide-out: about 2 s in all
type Slide=ReactElement<{onReady?:()=>void;onFailed?:()=>void;paused?:boolean}>;
type Shown={key:string;name:string;result:RoomResult};

/** Between applicants: the decided applicant's name (as this viewer was shown it) and outcome. No ballot totals. */
export function ResultSlide({name,result}:{name:string;result:RoomResult}){
 const Icon=result.outcome==="ACCEPT"?Check:result.outcome==="HOLD"?Pause:XIcon;
 return <section className="vr-result" aria-label="Decision result" data-result-outcome={result.outcome}>
  <h2 className="vr-result-name">{name}</h2>
  <p className="vr-result-outcome"><span className="vr-result-icon" aria-hidden="true"><Icon size={22}/></span>{resultOutcomeLabel(result)}</p>
 </section>;
}

/** One outgoing layer only. It is inert, never cached across identity/access changes.
 *  When the applicant who just left has a confirmed outcome (`resultFor`, read from this viewer's room snapshot),
 *  the result shows in their place while the next slide loads underneath; it gives way after RESULT_HOLD_MS, or
 *  as soon as `release` (voting opened on the next applicant), but never before that slide has loaded. */
export function ApplicantTransition({applicantId,passNumber,children,onReady,summary,resultFor,release=false}:{applicantId:string|null;passNumber:number;children:Slide;onReady:(key:string|null)=>void;summary:boolean;resultFor?:(passNumber:number,applicationId:string)=>RoomResult|null;release?:boolean}){
 const key=`${passNumber}:${applicantId}`,root=useRef<HTMLDivElement>(null),previous=useRef<{key:string;node:Slide;time:number;height:number}|null>(null),loaded=useRef<string|null>(null),outgoingRef=useRef(false);
 const [height,setHeight]=useState(300);
 const [outgoing,setOutgoing]=useState<{key:string;node:Slide}|null>(null),[phase,setPhase]=useState<"loading"|"sliding"|"ready">("loading"),[announce,setAnnounce]=useState("");
 const [shown,setShown]=useState<Shown|null>(null),[held,setHeld]=useState(false),[incoming,setIncoming]=useState<string|null>(null);
 const shouldFocus=useRef(false),lastKey=useRef(key),last=useRef({passNumber,applicantId}),heading=useRef<{key:string;text:string}|null>(null),resultRef=useRef(resultFor),shownKey=useRef<string|null>(null);
 useLayoutEffect(()=>{resultRef.current=resultFor;});
 useLayoutEffect(()=>{
  if(lastKey.current===key)return;
  shouldFocus.current=true;loaded.current=null;setIncoming(null);onReady(null);
  const from=last.current,prior=previous.current,wasResult=shownKey.current===lastKey.current;
  // The name is the heading this viewer actually saw, so anonymous rooms keep their anonymous labels.
  const seen=from.applicantId&&heading.current?.key===lastKey.current?heading.current.text:null;
  const result=seen&&from.applicantId?resultRef.current?.(from.passNumber,from.applicantId)??null:null;
  setHeight(h=>Math.max(h,prior?.height??300));setPhase("loading");setHeld(false);
  shownKey.current=result&&seen?key:null;
  if(result&&seen){outgoingRef.current=true;setOutgoing(null);setShown({key,name:seen,result});setAnnounce(`${seen}: ${resultOutcomeLabel(result)}`);}
  else{
   // Undo returns to the applicant who was showing: no slide from it to itself.
   // Leaving a result early (another change mid-result): never slide an already-decided applicant back out.
   const retained=!wasResult&&prior&&prior.key!==key&&Date.now()-prior.time<10000?prior:null;outgoingRef.current=!!retained;setOutgoing(retained);setShown(null);
  }
  lastKey.current=key;last.current={passNumber,applicantId};
 },[key,onReady,passNumber,applicantId]);
 const result=shown?.key===key?shown:null;
 useEffect(()=>{if(!result)return;const t=setTimeout(()=>setHeld(true),RESULT_HOLD_MS);return()=>clearTimeout(t);},[result]);
 const ready=useCallback(()=>{
  if(loaded.current===key)return;loaded.current=key;setIncoming(key);
  if(shownKey.current===key){
   // Loaded under the result: the leader's controls unlock now. Note the heading it will show, so a decision
   // made before this slide is revealed still gets its own result.
   onReady(key);
   requestAnimationFrame(()=>{const h=root.current?.querySelector<HTMLElement>(".vr-slide-in [data-applicant-heading]");if(h&&shownKey.current===key)heading.current={key,text:h.textContent??""};});
   return;
  }
  setPhase(outgoingRef.current?"sliding":"ready");
  if(!outgoingRef.current)onReady(key);
 },[key,onReady]);
 // The next slide failed to load: drop the result at once so its Retry is visible and reachable.
 const failed=useCallback(()=>{if(shownKey.current!==key)return;shownKey.current=null;outgoingRef.current=false;setShown(null);setPhase("ready");},[key]);
 // The result gives way once the next slide has loaded and the hold has passed (or voting already opened).
 useEffect(()=>{if(result&&phase==="loading"&&incoming===key&&(held||release))setPhase("sliding");},[result,phase,incoming,key,held,release]);
 const node=useMemo(()=>applicantId?cloneElement(children,{onReady:ready,onFailed:failed}):<section className="vr-applicant"><h2 data-applicant-heading tabIndex={-1}>{summary?"Pass complete":"Waiting for the leader"}</h2></section>,[applicantId,children,ready,failed,summary]);
 useEffect(()=>{if(!applicantId)ready()},[applicantId,ready]);
 useLayoutEffect(()=>{
  if(phase!=="ready")return;
  previous.current={key,node,time:Date.now(),height:root.current?.getBoundingClientRect().height??300};
  const frame=requestAnimationFrame(()=>{const h=root.current?.querySelector<HTMLElement>(".vr-slide-in [data-applicant-heading]");if(applicantId&&h)heading.current={key,text:h.textContent??""};
   // Move focus to the new applicant only if it was not taken elsewhere meanwhile (e.g. the leader's Undo).
   const active=document.activeElement;if(shouldFocus.current&&(!active||active===document.body||root.current?.contains(active)))h?.focus();shouldFocus.current=false;setAnnounce(h?.textContent??"");});
  return()=>cancelAnimationFrame(frame);
 },[phase,key,node,applicantId]);
 useEffect(()=>{
  if(phase!=="sliding")return;
  const finish=()=>{outgoingRef.current=false;setOutgoing(null);setShown(null);shownKey.current=null;setPhase("ready");onReady(key);};
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer=setTimeout(finish,reduced?0:550);return()=>clearTimeout(timer);
 },[phase,key,onReady]);
 const showingResult=!!result&&phase!=="ready";
 return <><div ref={root} style={{minHeight:applicantId||phase!=="ready"||showingResult?height:0}} className={`vr-slide-stage vr-slide-${phase}${showingResult?" vr-slide-result":""}`} aria-busy={phase!=="ready"&&!showingResult}>
 {showingResult?<div className="vr-slide-out vr-result-layer" key={`result:${result.key}`} inert={phase==="sliding"} aria-hidden={phase==="sliding"||undefined}><ResultSlide name={result.name} result={result.result}/></div>
  :outgoing&&<div className="vr-slide-out" key={outgoing.key} inert aria-hidden="true">{typeof outgoing.node.type==="string"?outgoing.node:cloneElement(outgoing.node,{onReady:undefined,paused:true})}</div>}
 <div className="vr-slide-in" key={key} inert={phase==="sliding"||showingResult&&phase==="loading"} aria-hidden={showingResult&&phase==="loading"||undefined}>{node}</div>
 </div><p className="sr-only" role="status" aria-live="polite">{announce}</p></>;
}
