"use client";
import {useId,useLayoutEffect,useMemo,useRef,type ReactNode} from "react";
import {ApplicantIdentity} from "@/components/applicant-identity";
import {resultOutcomeLabel,type RoomResult} from "@/lib/voting-room";
import {Check,Pause,XIcon} from "@/components/icons";
import type {VotingSlideData} from "./applicant-slide";
import {SlideText} from "./slide-text";
import {balanceColumns,slideModel,type SlideModel,type SlideNote} from "./slide-model";

/** Text sizes the projector steps down through until every enabled field fits one screen (never scroll, never clip). */
export const FIT_STEPS=[1,.92,.85,.78,.72,.66,.6,.55,.5,.46,.42,.38,.34] as const;
const overflowing=(root:HTMLElement)=>Array.from(root.querySelectorAll<HTMLElement>("[data-fit-box]")).some(b=>b.scrollHeight>b.clientHeight+1||b.scrollWidth>b.clientWidth+1);
/**
 * Auto-fit: sets --vr-fit on `ref` to the largest step at which no [data-fit-box] inside overflows. Runs before paint,
 * again when the stage resizes (a new projector, a window move) and once web fonts have loaded.
 */
export function useFit(ref:React.RefObject<HTMLElement|null>,key:unknown){
 useLayoutEffect(()=>{
  const el=ref.current;if(!el)return;
  const fit=()=>{let i=0;for(;i<FIT_STEPS.length;i++){el.style.setProperty("--vr-fit",String(FIT_STEPS[i]));if(!overflowing(el))break;}el.dataset.fitStep=String(Math.min(i,FIT_STEPS.length-1));};
  fit();
  // The slide also resizes as its layer settles after a transition (loading below the outgoing slide, then in place).
  const observer=typeof ResizeObserver==="function"?new ResizeObserver(()=>fit()):null;observer?.observe(el);if(el.parentElement)observer?.observe(el.parentElement);
  let live=true;void document.fonts?.ready.then(()=>{if(live)fit();});
  return()=>{live=false;observer?.disconnect();};
 },[ref,key]);
}

/** A confirmed outcome beside the name, shown briefly before the room moves on: colour always paired with text. */
export function OutcomeMark({result}:{result:RoomResult}){
  const Icon=result.outcome==="ACCEPT"?Check:result.outcome==="HOLD"?Pause:XIcon;
  return <p className="vr-outcome" data-outcome={result.outcome}><Icon aria-hidden="true" size={16}/>{resultOutcomeLabel(result)}</p>;
}

function Note({note}:{note:SlideNote}){
 const id=useId();
 return <div role="group" className="vr-aud-note" aria-labelledby={id} data-slide-field={note.key.startsWith("earlier:")?"earlierRounds":note.key}>
  <h3 id={id}>{note.label}</h3>
  <ul className="vr-aud-paras">{note.paragraphs.map((p,i)=><li key={i} className="vr-aud-para" data-muted={p.muted||undefined}>{p.quote?<blockquote><SlideText text={p.text}/></blockquote>:<SlideText text={p.text}/>}{p.meta&&<p className="vr-aud-meta">{p.meta}</p>}</li>)}</ul>
 </div>;
}
function Person({model,heading,children}:{model:SlideModel;heading:ReactNode;children?:ReactNode}){
 return <div className="vr-aud-person">
  {model.showPhoto?<ApplicantIdentity size="lg" announcePhoto name={model.name} photo={model.photo} anonymous={model.anonymous} heading={heading}/>:heading}
  {model.profile.length>0&&<ul className="vr-aud-profile" aria-label="Profile">{model.profile.map((p,i)=><li key={`${p.field}:${i}`} data-slide-field={p.field} data-accent={p.accent||undefined}>{p.text}</li>)}</ul>}
  {children}
 </div>;
}
function Facts({model}:{model:SlideModel}){
 if(!model.facts.length)return null;
 return <dl className="vr-aud-facts" data-count={model.facts.length}>{model.facts.map(f=><div key={f.field} data-slide-field={f.field}>
  <dt>{f.label}</dt><dd className="vr-aud-fact-value">{f.value}{f.unit&&<span className="vr-aud-fact-unit"> {f.unit}</span>}</dd>
  {f.meta.map(m=><dd key={m} className="vr-aud-meta">{m}</dd>)}</div>)}</dl>;
}

/**
 * The projector slide for one applicant: the person on the left, every enabled field in full on the right, fitted to
 * the screen. Once a vote closes, `aside` (the result) takes the right column; nothing here reveals a ballot.
 */
export function AudienceApplicant({data,outcome,aside}:{data:VotingSlideData;outcome:RoomResult|null;aside?:(outcome:RoomResult|null)=>ReactNode}){
 const model=useMemo(()=>slideModel(data),[data]),root=useRef<HTMLElement>(null);
 const columns=balanceColumns(model.notes);
 const result=aside?.(outcome)??(outcome?<div className="vr-aud-result" data-outcome={outcome.outcome}><p className="vr-aud-kicker">Result</p><p className="vr-aud-word">{resultOutcomeLabel(outcome)}</p></div>:null);
 useFit(root,`${data.applicationId}:${model.notes.length}:${!!result}`);
 return <section ref={root} aria-label="Current applicant presentation" className="vr-aud-applicant" data-state={result?"result":"evidence"}>
  <div className="vr-aud-left" data-fit-box><Person model={model} heading={<h2 tabIndex={-1} data-applicant-heading>{model.name}</h2>}>{outcome&&<OutcomeMark result={outcome}/>}</Person></div>
  <div className="vr-aud-right" data-fit-box>
   {result??<>
    <Facts model={model}/>
    {columns[0].length>0&&<div className="vr-aud-notes" data-fit-box data-columns={columns.length}>{columns.map((col,i)=><div key={i} className="vr-aud-column">{col.map(n=><Note key={n.key} note={n}/>)}</div>)}</div>}
    {!model.facts.length&&!model.notes.length&&<p className="vr-aud-meta">No further fields are shown for this session.</p>}
   </>}
  </div>
 </section>;
}

/** The leader's condensed column: the same fields, smaller, in normal page flow (the leader screen may scroll). */
export function LeaderApplicant({data,position,outcome=null}:{data:VotingSlideData;position?:string;outcome?:RoomResult|null}){
 const model=useMemo(()=>slideModel(data),[data]),columns=balanceColumns(model.notes);
 return <section aria-label="Current applicant" className="vr-lead-applicant">
  <div className="vr-lead-person">
   {model.showPhoto?<ApplicantIdentity size="lg" announcePhoto name={model.name} photo={model.photo} anonymous={model.anonymous} heading={<div className="vr-lead-name">{position&&<p className="vr-lead-position">{position}</p>}<h2 tabIndex={-1} data-applicant-heading>{model.name}</h2></div>}/>
    :<div className="vr-lead-name">{position&&<p className="vr-lead-position">{position}</p>}<h2 tabIndex={-1} data-applicant-heading>{model.name}</h2></div>}
   {outcome&&<OutcomeMark result={outcome}/>}
   {model.profile.length>0&&<p className="vr-lead-profile">{model.profile.map((p,i)=><span key={`${p.field}:${i}`} data-slide-field={p.field} data-accent={p.accent||undefined}>{p.text}</span>)}</p>}
  </div>
  <Facts model={model}/>
  {columns[0].length>0&&<div className="vr-aud-notes" data-columns={columns.length}>{columns.map((col,i)=><div key={i} className="vr-aud-column">{col.map(n=><Note key={n.key} note={n}/>)}</div>)}</div>}
 </section>;
}
