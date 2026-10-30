"use client";
import {cloneElement,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactElement} from "react";
/** One outgoing layer only. It is inert, never cached across identity/access changes. */
export function ApplicantTransition({applicantId,passNumber,children,onReady,summary}:{applicantId:string|null;passNumber:number;children:ReactElement<{onReady?:()=>void;paused?:boolean}>;onReady:(key:string|null)=>void;summary:boolean}){
 const key=`${passNumber}:${applicantId}`,root=useRef<HTMLDivElement>(null),previous=useRef<{key:string;node:ReactElement<{onReady?:()=>void;paused?:boolean}>;time:number;height:number}|null>(null),loaded=useRef<string|null>(null),outgoingRef=useRef(false);
 const [height,setHeight]=useState(300);
 const [outgoing,setOutgoing]=useState<{key:string;node:ReactElement<{onReady?:()=>void;paused?:boolean}>}|null>(null),[phase,setPhase]=useState<"loading"|"sliding"|"ready">("loading"),[announce,setAnnounce]=useState("");
 const shouldFocus=useRef(false),lastKey=useRef(key);
 useLayoutEffect(()=>{
  if(lastKey.current===key)return;
  shouldFocus.current=true;loaded.current=null;onReady(null);
  const prior=previous.current;
  const retained=prior&&Date.now()-prior.time<10000?prior:null;outgoingRef.current=!!retained;setHeight(h=>Math.max(h,prior?.height??300));setOutgoing(retained);setPhase("loading");lastKey.current=key;
 },[key,onReady]);
 const ready=useCallback(()=>{
  if(loaded.current===key)return;loaded.current=key;
  setPhase(outgoingRef.current?"sliding":"ready");
  if(!outgoingRef.current)onReady(key);
 },[key,onReady]);
 const node=useMemo(()=>applicantId?cloneElement(children,{onReady:ready}):<section className="vr-applicant"><h2 data-applicant-heading tabIndex={-1}>{summary?"Pass complete":"Waiting for the leader"}</h2></section>,[applicantId,children,ready,summary]);
 useEffect(()=>{if(!applicantId)ready()},[applicantId,ready]);
 useLayoutEffect(()=>{
  if(phase!=="ready")return;
  previous.current={key,node,time:Date.now(),height:root.current?.getBoundingClientRect().height??300};
  const frame=requestAnimationFrame(()=>{const heading=root.current?.querySelector<HTMLElement>(".vr-slide-in [data-applicant-heading]");if(shouldFocus.current){heading?.focus();shouldFocus.current=false;}setAnnounce(heading?.textContent??"");});
  return()=>cancelAnimationFrame(frame);
 },[phase,key,node]);
 useEffect(()=>{
  if(phase!=="sliding")return;
  const finish=()=>{outgoingRef.current=false;setOutgoing(null);setPhase("ready");onReady(key);};
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timer=setTimeout(finish,reduced?0:550);return()=>clearTimeout(timer);
 },[phase,key,onReady]);
 return <><div ref={root} style={{minHeight:height}} className={`vr-slide-stage vr-slide-${phase}`} aria-busy={phase!=="ready"}>
 {outgoing&&<div className="vr-slide-out" key={outgoing.key} inert aria-hidden="true">{typeof outgoing.node.type==="string"?outgoing.node:cloneElement(outgoing.node,{onReady:undefined,paused:true})}</div>}
 <div className="vr-slide-in" key={key} inert={phase==="sliding"}>{node}</div>
 </div><p className="sr-only" role="status" aria-live="polite">{announce}</p></>;
}
