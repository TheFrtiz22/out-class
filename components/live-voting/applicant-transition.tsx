"use client";
import {cloneElement,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactElement} from "react";
import {resultOutcomeLabel,type RoomResult} from "@/lib/voting-room";

/** How long a confirmed outcome shows beside the name before the room moves on, and the move itself. */
export const OUTCOME_HOLD_MS=200,SLIDE_MS=520,FADE_MS=320,REDUCED_FADE_MS=150;
type Slide=ReactElement<{onReady?:()=>void;onFailed?:()=>void;paused?:boolean;outcome?:RoomResult|null}>;
/** slide: the horizontal applicant transition; fade: a gentle crossfade (intermission, new pass, end of voting); none: direct. */
export type Motion="slide"|"fade"|"none";
type Outgoing={key:string;node:Slide;result:RoomResult|null;mode:Exclude<Motion,"none">};
type Track={key:string;outgoing:Outgoing|null};

/**
 * Applicant-to-applicant motion for every room view. Only applicant content moves; the page around it is untouched.
 * When the current applicant changes, the slide that was on screen stays mounted (same element, so its data and photo
 * stay) as the outgoing layer. If the room's snapshot shows that applicant's outcome confirmed (`resultFor`), the
 * outcome appears beside the name. The next applicant loads hidden beneath; once it has loaded and the outcome has
 * shown for OUTCOME_HOLD_MS (or `release`: voting already opened on it), both move left together. Nothing here
 * decides anything: the transition only follows confirmed room snapshots.
 */
export function ApplicantTransition({applicantId,passNumber,children,onReady,summary,ended=false,idle,resultFor,motionFrom,release=false}:{applicantId:string|null;passNumber:number;children:Slide;onReady:(key:string|null)=>void;summary:boolean;ended?:boolean;idle?:ReactElement;resultFor?:(passNumber:number,applicationId:string)=>RoomResult|null;motionFrom?:(passNumber:number,applicationId:string|null)=>Motion;release?:boolean}){
 // Ending is its own stage state, so the end of voting goes through the crossfade (with focus and announcement).
 const key=`${passNumber}:${applicantId??(ended?"end":"null")}`,root=useRef<HTMLDivElement>(null);
 // Refs read during render below are written only in effects (deterministic under StrictMode re-renders).
 const loaded=useRef<string|null>(null),onScreen=useRef<string|null>(null),restHeight=useRef(300),lastNode=useRef<{key:string;node:Slide;applicantId:string|null;passNumber:number}|null>(null);
 const [height,setHeight]=useState(300),[phase,setPhase]=useState<"loading"|"sliding"|"ready">("loading"),[announce,setAnnounce]=useState("");
 const [held,setHeld]=useState(false),[incoming,setIncoming]=useState<string|null>(null),shouldFocus=useRef(false);
 const [track,setTrack]=useState<Track>({key,outgoing:null});
 // Decide the outgoing layer during render (not in an effect), so the slide on screen is never unmounted in between.
 let outgoing=track.outgoing;
 if(track.key!==key){
  const prev=lastNode.current;
  const mode:Motion=prev?motionFrom?.(prev.passNumber,prev.applicantId)??"slide":"slide";
  if(outgoing?.key===key)outgoing=null; // Undo back to the applicant still sliding out: it simply stays.
  // Missed advances (a hidden or offline tab catching up): straight to the current applicant, no replay.
  else if(mode==="none")outgoing=null;
  // Only a slide that actually reached the screen may leave it; a loaded-but-hidden one is dropped, never flashed.
  else if(prev&&prev.key===track.key&&onScreen.current===prev.key){
   // The slide that was showing becomes the outgoing layer, with its outcome if the room has confirmed one.
   const result=prev.applicantId?resultFor?.(prev.passNumber,prev.applicantId)??null:null;
   outgoing={key:prev.key,node:prev.node,result,mode};
  }
  // Otherwise the current slide never finished loading: keep whatever was already leaving, drop the half-loaded one.
  setTrack({key,outgoing});
 }
 const handled=useRef<string|null>(null);
 useLayoutEffect(()=>{
  // Once per applicant change (and on mount), after the render that set up the layers; not when a transition ends.
  if(track.key!==key||handled.current===key)return;handled.current=key;
  shouldFocus.current=true;loaded.current=null;setIncoming(null);setHeld(false);setPhase("loading");onReady(null);
  const out=track.outgoing;
  if(out){
   // Hold the stage at the height the outgoing slide had at rest (not with its outcome added).
   setHeight(h=>Math.max(h,restHeight.current));
   if(out.result){const name=root.current?.querySelector(".vr-slide-out [data-applicant-heading]")?.textContent;if(name)setAnnounce(`${name}: ${resultOutcomeLabel(out.result)}`);}
  }
 // Keyed on `track` alone: `onReady` is stable and `key` is checked against track.key above.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[track]);
 useEffect(()=>{if(!track.outgoing?.result)return;const t=setTimeout(()=>setHeld(true),OUTCOME_HOLD_MS);return()=>clearTimeout(t);},[track]);
 const ready=useCallback(()=>{if(loaded.current===key)return;loaded.current=key;setIncoming(key);},[key]);
 // The next slide failed to load: stop the transition at once so its Retry is visible and reachable.
 const failed=useCallback(()=>{setTrack(t=>t.key===key&&t.outgoing?{key,outgoing:null}:t);setPhase(p=>p==="loading"?"ready":p);},[key]);
 // No current applicant: the caller's intermission (between passes, end of voting, before the start), or a heading.
 const node=useMemo(()=>applicantId?cloneElement(children,{onReady:ready,onFailed:failed}):idle??<section className="vr-applicant"><h2 data-applicant-heading tabIndex={-1}>{summary?"Pass complete":"Waiting for the leader"}</h2></section>,[applicantId,children,ready,failed,summary,idle]);
 useLayoutEffect(()=>{lastNode.current={key,node,applicantId,passNumber};});
 useEffect(()=>{if(!applicantId)ready()},[applicantId,ready]);
 // Move on once the next slide is ready: straight away with nothing leaving, else after the outcome has shown.
 const out=track.key===key?track.outgoing:null;
 useEffect(()=>{
  if(phase!=="loading"||incoming!==key)return;
  if(!out){setPhase("ready");onReady(key);return;}
  // A taller next applicant grows the stage once, as the slide starts; the stage never shrinks mid-session.
  if(!out.result||held||release)setPhase("sliding");
 },[phase,incoming,key,out,held,release,onReady]);
 useEffect(()=>{
  if(phase!=="sliding")return;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fade=track.key===key&&track.outgoing?.mode==="fade";
  const timer=setTimeout(()=>{setTrack(t=>t.key===key?{key,outgoing:null}:t);setPhase("ready");onReady(key);},reduced?REDUCED_FADE_MS:fade?FADE_MS:SLIDE_MS);
  return()=>clearTimeout(timer);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- the mode is fixed for this key's transition
 },[phase,key,onReady]);
 useLayoutEffect(()=>{
  if(phase!=="ready")return;
  if(incoming===key)onScreen.current=key;
  if(!track.outgoing)restHeight.current=root.current?.getBoundingClientRect().height??restHeight.current;
  const frame=requestAnimationFrame(()=>{const h=root.current?.querySelector<HTMLElement>(".vr-slide-in [data-applicant-heading]");if(!h)return; // e.g. a failed load: wait for Retry
   // Focus the new applicant's name (never a decision button), unless focus was deliberately moved elsewhere (e.g. Undo).
   const active=document.activeElement;if(shouldFocus.current&&(!active||active===document.body||root.current?.contains(active)))h?.focus();shouldFocus.current=false;
   setAnnounce(h?.textContent??"");});
  return()=>cancelAnimationFrame(frame);
 },[phase,key,incoming,track.outgoing]);
 // Controls unlock only for an applicant that is on screen and loaded (also after a Retry following a failed load).
 useEffect(()=>{if(phase==="ready"&&incoming===key)onReady(key);},[phase,incoming,key,onReady]);
 // Pending from the very render that creates the outgoing layer (before the phase update), so the next slide's
 // placeholder never enters the flow or the stage's height.
 const pending=!!out&&phase!=="sliding";
 // Keyed layers: the outgoing applicant keeps its mounted element (and data) as it changes role.
 const layers=[...(out?[{key:out.key,role:"out" as const,node:typeof out.node.type==="string"?out.node:cloneElement(out.node,{onReady:undefined,onFailed:undefined,paused:true,outcome:out.result})}]:[]),{key,role:"in" as const,node}];
 // The stage keeps its height for intermissions too, so the controls below never jump between passes or at the end.
 return <><div ref={root} style={{minHeight:applicantId||idle||phase!=="ready"?height:0}} className={`vr-slide-stage vr-slide-${phase}${pending?" vr-slide-pending":""}${out?.mode==="fade"?" vr-slide-fade":""}${!applicantId&&idle?" vr-slide-idle":""}`} aria-busy={phase==="loading"&&!pending}>
  {layers.map(l=><div key={l.key} className={l.role==="out"?"vr-slide-out":"vr-slide-in"} inert={l.role==="out"||pending||phase==="sliding"} aria-hidden={l.role==="out"||l.role==="in"&&pending||undefined}>{l.node}</div>)}
 </div><p className="sr-only" role="status" aria-live="polite">{announce}</p></>;
}
