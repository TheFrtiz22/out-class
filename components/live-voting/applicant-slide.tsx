"use client";
import {useRef,useState,useSyncExternalStore} from "react";
import {ApplicantIdentity} from "@/components/applicant-identity";
import type {getLiveVotingPresentation,StalePresentation} from "@/actions/voting-room";
import {fieldLabels} from "@/lib/applicant-display";
import {anonymousApplicantLabel} from "@/lib/anonymous-review";
import {liveRoomFields} from "@/lib/voting-room";
import {formatAverage,scoredEvaluationsLabel} from "@/lib/interview-review-summary";
import {NO_INTERVIEW_SCORES} from "@/lib/interview-feedback";
import {highlightAttribution} from "@/lib/voting-slide-preparation";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {SLIDE_FACT_MAX,SLIDE_NOTE_CHARS,SLIDE_SHORT_QUERY,slideExcerpt,evidenceExcerpt,feedbackExcerpt} from "@/lib/voting-slide-excerpt";
import {Button} from "@/components/ui/button";
import {Check,Pause,XIcon} from "@/components/icons";
import {resultOutcomeLabel,type RoomResult} from "@/lib/voting-room";
import {InterviewFeedbackSection,EarlierFeedbackRounds} from "@/components/interview-feedback-section";

export type VotingSlideData=Exclude<Awaited<ReturnType<typeof getLiveVotingPresentation>>,StalePresentation>;
// Highlights share the header row on projectors; full text stays in Applicant details.
const highlightPreview=(text:string)=>text.length>110?`${text.slice(0,107)}…`:text;

/* Automatic layout. Values that fit on one short line become compact facts; anything longer, or with
   line breaks, joins the evidence area, where the field with the most text gets the most room.
   Character and line budgets live in lib/voting-slide-excerpt.ts. */
const isFact=(text:string)=>text.length<=SLIDE_FACT_MAX&&!/\n/.test(text);
/** Visual weight of an excerpt: its characters, where each line (a bullet, a break) costs at least half a line. */
const weigh=(text:string)=>text.split("\n").reduce((n,line)=>n+Math.max(line.length,30),0);
const bullet=/^\s*(?:[-*•‣◦–]|\d{1,2}[.)])\s+/;
type Block={kind:"p"|"ul"|"ol";lines:string[];start?:number};
/** Preserves line breaks and renders "-", "*", "•" or "1." lines as real lists. */
function SlideText({text}:{text:string}){
  const blocks:Block[]=[];let gap=true;
  for(const line of text.split(/\r?\n/)){
    if(!line.trim()){gap=true;continue;}
    const m=line.match(bullet),kind:Block["kind"]=m?(/\d/.test(m[0])?"ol":"ul"):"p",body=m?line.slice(m[0].length):line,last=blocks[blocks.length-1];
    if(!gap&&last?.kind===kind)last.lines.push(body);else blocks.push({kind,lines:[body],start:kind==="ol"?Number(m![0].match(/\d+/)![0]):undefined});gap=false;
  }
  return <div className="vr-text">{blocks.map((b,i)=>b.kind==="p"?<p key={i}>{b.lines.join("\n")}</p>:b.kind==="ul"?<ul key={i}>{b.lines.map((l,j)=><li key={j}>{l}</li>)}</ul>:<ol key={i} start={b.start}>{b.lines.map((l,j)=><li key={j}>{l}</li>)}</ol>)}</div>;
}
const renderSlideText=(text:string)=><SlideText text={text}/>;
/** Short projectors (1280×720 up to 767px tall) get smaller excerpt budgets, matching room.css. The server
 *  snapshot is the normal budget; the viewport decides after hydration. Cut text always keeps "Read full …". */
const subscribeShort=(onChange:()=>void)=>{const m=window.matchMedia(SLIDE_SHORT_QUERY);m.addEventListener("change",onChange);return()=>m.removeEventListener("change",onChange);};
const useShortProjector=()=>useSyncExternalStore(subscribeShort,()=>window.matchMedia(SLIDE_SHORT_QUERY).matches,()=>false);

/** One renderer for setup, leader, audience and member views. Only the
 * server-projected fields enter this component, including its details dialog. */
/** A confirmed outcome beside the name, shown briefly before the room moves on: colour always paired with text. */
function OutcomeMark({result}:{result:RoomResult}){
  const Icon=result.outcome==="ACCEPT"?Check:result.outcome==="HOLD"?Pause:XIcon;
  return <p className="vr-outcome" data-outcome={result.outcome}><Icon aria-hidden="true" size={16}/>{resultOutcomeLabel(result)}</p>;
}
export function ApplicantSlide({data,outcome=null}:{data:VotingSlideData;outcome?:RoomResult|null}){
  const [details,setDetails]=useState(false),origin=useRef<HTMLButtonElement|null>(null),short=useShortProjector();
  const clipFeedback=(text:string,entries:number)=>feedbackExcerpt(text,entries,short);
  const open=(e:React.MouseEvent<HTMLButtonElement>)=>{origin.current=e.currentTarget;setDetails(true);};
  const name=data.sections.find(s=>s.field==="name")?.items[0]??(data.anonymous?anonymousApplicantLabel(data.applicationId):"Applicant");
  const fields=data.sections.filter(s=>s.field!=="name").map(s=>({field:s.field as string,label:fieldLabels[s.field],full:s.items.join(" · ")||"Not provided",preview:s.items.join(" · ")||"Not provided",note:""}));
  if(data.requestedFields?.includes("resumeHighlight")&&"resumeHighlight"in data){
    const text=data.resumeHighlight?`Page ${data.resumeHighlight.page} · ${data.resumeHighlight.quote}`:"No selected résumé excerpt.";
    fields.push({field:"resumeHighlight",label:"Leader-selected résumé excerpt",full:text,preview:text,note:""});
  }
  const earlier=data.earlierInterviewRounds??[];
  const current=data.requestedFields?.includes("interviewScore")?data.interviewScore?.current:undefined;
  if(current){
    // Round-scoped read: this round's own average only. No score is a sentence, never 0 or another round's value.
    const scored=current.status==="scored"&&current.average!==null;
    const text=scored?`${formatAverage(current.average)} / 10 · ${scoredEvaluationsLabel(current.submitted)}`:current.status==="withheld"?"Not available":NO_INTERVIEW_SCORES;
    fields.push({field:"interviewScore",label:"Average interview score",preview:text,note:current.roundName,
      full:`${current.roundName}: ${text}\nEqual-weight average of valid submitted interviewer scores in this round only; missing or unsubmitted scores are not counted. Earlier rounds are listed separately.`});
  }else if(data.requestedFields?.includes("interviewScore")&&data.interviewScore){
    // Current-round average (same canonical calculation per round); other rounds stay separate and labelled.
    const rounds=data.interviewScore.byRound??[],feedbackRound="interviewFeedback"in data?data.interviewFeedback?.roundId:undefined;
    const current=rounds.find(r=>r.roundId===feedbackRound)??rounds.find(r=>r.roundId===data.roundId);
    const line=(r:{average:number;submitted:number})=>`${formatAverage(r.average)} / 10 · ${scoredEvaluationsLabel(r.submitted)}`;
    const others=rounds.filter(r=>r!==current);
    fields.push({field:"interviewScore",label:"Average interview score",preview:current?line(current):"Not scored",
      note:current?`${current.roundName}${others.length?" · other rounds in details":""}`:"",
      full:[current?`${current.roundName}: ${line(current)}`:"Not scored",...others.map(r=>`${r.roundName} (separate round): ${line(r)}`),"Equal-weight average of valid submitted interviewer scores; missing or unsubmitted scores are not counted."].join("\n")});
  }
  // The round-scoped Interview feedback section takes the thoughts field's place on the slide.
  // Other rounds' thoughts are never merged into it: they appear only in the details dialog, by round.
  const feedback=data.requestedFields?.includes("finalInterviewThoughts")&&"interviewFeedback"in data?data.interviewFeedback:undefined;
  const otherThoughts=feedback?data.finalInterviewThoughts??[]:[];
  // Round-scoped reads carry thoughts only in this round's section or the Earlier rounds group, never as a mixed list.
  if(!feedback&&!("earlierInterviewRounds"in data)&&data.requestedFields?.includes("finalInterviewThoughts")&&data.finalInterviewThoughts){
    const thoughts=data.finalInterviewThoughts,first=thoughts[0];
    fields.push({field:"finalInterviewThoughts",label:"Submitted final interview thoughts",preview:first?first.text:"No submitted final interview thoughts.",note:first?`Latest · ${first.interviewer} · ${first.roundName} · ${thoughts.length} submitted summar${thoughts.length===1?"y":"ies"}`:"",full:thoughts.length?thoughts.map(t=>`${t.interviewer} · ${t.roundName}\n${t.text}`).join("\n\n"):"No submitted final interview thoughts."});
  }
  const observations=data.requestedFields?.includes('additionalObservations')?data.additionalObservations:undefined;
  const prepared="preparedHighlights"in data?data.preparedHighlights??[]:[];
  const order=(f:string)=>{const i=(liveRoomFields as readonly string[]).indexOf(f);return i<0?100:i;};
  fields.sort((a,b)=>order(a.field)-order(b.field)||a.field.localeCompare(b.field));
  // Earlier rounds: one labelled line under this round's score on the projector (never in its average);
  // each round's attributed entries and sources are in Applicant details.
  const earlierLine=earlier.length?`Earlier rounds · ${earlier.map(r=>`${r.roundName} ${r.average!==null?`${formatAverage(r.average)} / 10`:`${r.submitted} review${r.submitted===1?"":"s"}`}`).join("; ")}`:"";
  const earlierInScore=!!earlierLine&&fields.some(f=>f.field==="interviewScore");
  const readFull=(label:string,className="h-auto min-h-11 p-0")=><Button type="button" variant="link" className={className} onClick={open}>Read full {label.toLowerCase()}</Button>;
  // Facts strip: the score is always a fact (a number), and so is any short single-line value, in liveRoomFields order.
  const facts=fields.filter(f=>f.field==="interviewScore"||isFact(f.preview)&&f.full===f.preview);
  const evidence:{key:string;weight:number;node:React.ReactNode}[]=fields.filter(f=>!facts.includes(f)).map(f=>{
    const shown=evidenceExcerpt(f.preview,short),cut=shown!==f.preview||f.full!==f.preview||f.note.length>SLIDE_NOTE_CHARS;
    return {key:f.field,weight:weigh(shown),node:<section className="vr-field" data-slide-field={f.field}><h3>{f.label}</h3><SlideText text={shown}/>{f.note&&<p className="vr-field-meta">{slideExcerpt(f.note,SLIDE_NOTE_CHARS,1)}</p>}{cut&&readFull(f.label)}</section>};
  });
  if(feedback)evidence.push({key:"interviewFeedback",weight:feedback.entries.reduce((n,e)=>n+30+(e.summary?weigh(clipFeedback(e.summary,feedback.entries.length)):30),0),
    node:<div className="vr-field vr-field-feedback" data-slide-field="interviewFeedback"><InterviewFeedbackSection compact feedback={feedback} onReadFull={open} excerpt={clipFeedback} renderText={renderSlideText}/></div>});
  if(earlierLine&&!earlierInScore)evidence.push({key:"earlierRounds",weight:30*(earlier.length+1),node:<div className="vr-field vr-field-feedback" data-slide-field="earlierRounds"><EarlierFeedbackRounds compact rounds={earlier} onReadFull={open}/></div>});
  // Most text first and widest (visual order = reading and focus order); ties keep liveRoomFields order.
  evidence.sort((a,b)=>b.weight-a.weight||order(a.key==="interviewFeedback"?"finalInterviewThoughts":a.key)-order(b.key==="interviewFeedback"?"finalInterviewThoughts":b.key));
  const balanced=evidence.length>1&&evidence[1].weight>=evidence[0].weight*.85;
  return <section aria-label="Current applicant presentation" className="vr-applicant" data-evidence-count={evidence.length} data-evidence-balance={balanced?"even":"lead"}>
    <header className="vr-person"><ApplicantIdentity size="lg" announcePhoto name={name} photo={data.visible.includes("photo")?data.photo:null} anonymous={data.anonymous} heading={<h2 tabIndex={-1} data-applicant-heading>{name}</h2>}>{outcome&&<OutcomeMark result={outcome}/>}</ApplicantIdentity>
    {prepared.length>0&&<section className="vr-highlights" aria-label="Leader-selected highlights"><ul>{prepared.map(h=><li key={h.id} className="vr-highlight" data-highlight-mode={h.mode}>
      <p>{h.mode==="QUOTE"?<q>{highlightPreview(h.text)}</q>:<><span className="vr-highlight-kind">Leader summary:</span> {highlightPreview(h.text)}</>}</p>
      <p className="vr-field-meta">{highlightAttribution(h)}</p></li>)}</ul></section>}</header>
    {facts.length>0&&<dl className="vr-facts">{facts.map(f=><div key={f.field} className={f.field==="interviewScore"?"vr-fact vr-fact-score":"vr-fact"} data-slide-field={f.field}>
      <dt>{f.label}</dt><dd className="vr-fact-value">{f.preview}</dd>{f.note&&<dd className="vr-fact-meta">{slideExcerpt(f.note,SLIDE_NOTE_CHARS,1)}</dd>}
      {f.field==="interviewScore"&&earlierInScore&&<dd className="vr-fact-meta" data-slide-field="earlierRounds">{slideExcerpt(earlierLine,SLIDE_NOTE_CHARS,1)}</dd>}
      {(f.full!==f.preview||f.note.length>SLIDE_NOTE_CHARS)&&<dd>{readFull(f.label,"vr-fact-link h-auto p-0")}</dd>}</div>)}</dl>}
    {evidence.length>0&&<div className="vr-evidence">{evidence.map((e,i)=><div key={e.key} className="vr-evidence-item" data-evidence-rank={i+1}>{e.node}</div>)}</div>}
    <footer className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={open}>{prepared.length?"Applicant details and highlight sources":"Applicant details"}</Button>{observations&&<Button type="button" variant="ghost" size="sm" onClick={open}>Additional observations · {observations.length}</Button>}</footer>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();origin.current?.focus();}} className="max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}><DialogTitle>{name} · Details</DialogTitle>{prepared.length>0&&<section className="space-y-3 border-b pb-3"><h3 className="font-medium">Highlights and their full sources</h3>{prepared.map(h=><article key={h.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{h.mode==="QUOTE"?<q>{h.text}</q>:<><span className="font-medium">Leader summary{h.writtenBy?` by ${h.writtenBy}`:""}:</span> {h.text}</>}</p><p className="text-xs text-muted-foreground">{h.mode==="QUOTE"?"Excerpt from":"Based on"} {highlightAttribution(h)}{h.source.revision?` · Version ${h.source.revision}`:""}</p><details><summary className="cursor-pointer text-sm">Full original source</summary><p className="whitespace-pre-wrap break-words text-sm">{h.source.text}</p></details></article>)}</section>}{feedback&&<div className="space-y-2 border-b pb-3"><InterviewFeedbackSection feedback={feedback}/><EarlierFeedbackRounds feedback={feedback}/>{otherThoughts.length>0&&<section aria-label="Interview thoughts from other rounds" className="space-y-2 border-t pt-3"><h3 className="font-medium">Interview thoughts from other rounds</h3>{otherThoughts.map(t=><article key={t.id}><p className="text-sm font-medium">{t.interviewer} · {t.roundName}</p><p className="whitespace-pre-wrap break-words">{t.text}</p></article>)}</section>}</div>}{earlier.length>0&&<div className="border-b pb-3"><EarlierFeedbackRounds rounds={earlier}/></div>}{fields.map(f=><section key={f.field}><h3 className="font-medium">{f.label}</h3><p className="whitespace-pre-wrap break-words">{f.full}</p></section>)}{observations&&<section className="space-y-3 border-t pt-3"><h3 className="font-medium">Additional observations</h3>{observations.length?observations.map(row=><article key={row.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{row.body}</p>{row.interactionContext&&<p className="text-sm">{row.interactionContext}</p>}<p className="text-xs text-muted-foreground">{row.author} · {row.roundName} · {new Date(row.createdAt).toLocaleString()} · Version {row.revision}</p></article>):<p>No shared additional observations.</p>}</section>}{data.interviewScore&&<p className="text-sm text-muted-foreground">{data.interviewScore.scope}. Missing scores are excluded.</p>}</DialogContent></Dialog>
  </section>;
}
