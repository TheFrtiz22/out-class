"use client";
import {useRef,useState} from "react";
import {ApplicantIdentity} from "@/components/applicant-identity";
import type {getLiveVotingPresentation} from "@/actions/voting-room";
import {fieldLabels} from "@/lib/applicant-display";
import {anonymousApplicantLabel} from "@/lib/anonymous-review";
import {liveRoomFields} from "@/lib/voting-room";
import {formatAverage,scoredEvaluationsLabel} from "@/lib/interview-review-summary";
import {NO_INTERVIEW_SCORES} from "@/lib/interview-feedback";
import {highlightAttribution} from "@/lib/voting-slide-preparation";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {InterviewFeedbackSection,EarlierFeedbackRounds} from "@/components/interview-feedback-section";

export type VotingSlideData=Awaited<ReturnType<typeof getLiveVotingPresentation>>;
const excerpt=(text:string)=>text.length>150?`${text.slice(0,147)}…`:text;
// Highlights share the header row on projectors; full text stays in Applicant details.
const highlightPreview=(text:string)=>text.length>110?`${text.slice(0,107)}…`:text;

/** One renderer for setup, leader, audience and member views. Only the
 * server-projected fields enter this component, including its details dialog. */
export function ApplicantSlide({data}:{data:VotingSlideData}){
  const [details,setDetails]=useState(false),origin=useRef<HTMLButtonElement|null>(null);
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
  const feedbackAt=fields.findIndex(f=>order(f.field)>order("finalInterviewThoughts"));
  // Earlier rounds: one labelled line under this round's score on the projector (never in its average);
  // each round's attributed entries and sources are in Applicant details.
  const earlierLine=earlier.length?`Earlier rounds · ${earlier.map(r=>`${r.roundName} ${r.average!==null?`${formatAverage(r.average)} / 10`:`${r.submitted} review${r.submitted===1?"":"s"}`}`).join("; ")}`:"";
  const earlierInScore=!!earlierLine&&fields.some(f=>f.field==="interviewScore");
  const slideFields=fields.map(f=><section className="vr-field" key={f.field} data-slide-field={f.field}><h3>{f.label}</h3><p>{excerpt(f.preview)}</p>{f.note&&<p className="vr-field-meta">{excerpt(f.note)}</p>}{f.field==="interviewScore"&&earlierInScore&&<p className="vr-field-meta" data-slide-field="earlierRounds">{excerpt(earlierLine)}</p>}{(f.full!==f.preview||f.preview.length>150||f.note.length>150||f.field==="interviewScore"&&earlierInScore)&&<Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={open}>Read full {f.label.toLowerCase()}</Button>}</section>);
  if(feedback)slideFields.splice(feedbackAt<0?slideFields.length:feedbackAt,0,<div className="vr-field vr-field-feedback" key="interviewFeedback" data-slide-field="interviewFeedback"><InterviewFeedbackSection compact feedback={feedback} onReadFull={open}/></div>);
  if(earlierLine&&!earlierInScore)slideFields.push(<div className="vr-field vr-field-feedback" key="earlierRounds" data-slide-field="earlierRounds"><EarlierFeedbackRounds compact rounds={earlier} onReadFull={open}/></div>);
  return <section aria-label="Current applicant presentation" className="vr-applicant">
    <header className="vr-person"><ApplicantIdentity size="lg" announcePhoto name={name} photo={data.visible.includes("photo")?data.photo:null} anonymous={data.anonymous} heading={<h2 tabIndex={-1} data-applicant-heading>{name}</h2>}/>
    {prepared.length>0&&<section className="vr-highlights" aria-label="Leader-selected highlights"><ul>{prepared.map(h=><li key={h.id} className="vr-highlight" data-highlight-mode={h.mode}>
      <p>{h.mode==="QUOTE"?<q>{highlightPreview(h.text)}</q>:<><span className="vr-highlight-kind">Leader summary:</span> {highlightPreview(h.text)}</>}</p>
      <p className="vr-field-meta">{highlightAttribution(h)}</p></li>)}</ul></section>}</header>
    <div className="vr-fields">{slideFields}</div>
    <footer className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={open}>{prepared.length?"Applicant details and highlight sources":"Applicant details"}</Button>{observations&&<Button type="button" variant="ghost" size="sm" onClick={open}>Additional observations · {observations.length}</Button>}</footer>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();origin.current?.focus();}} className="max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}><DialogTitle>{name} · Details</DialogTitle>{prepared.length>0&&<section className="space-y-3 border-b pb-3"><h3 className="font-medium">Highlights and their full sources</h3>{prepared.map(h=><article key={h.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{h.mode==="QUOTE"?<q>{h.text}</q>:<><span className="font-medium">Leader summary{h.writtenBy?` by ${h.writtenBy}`:""}:</span> {h.text}</>}</p><p className="text-xs text-muted-foreground">{h.mode==="QUOTE"?"Excerpt from":"Based on"} {highlightAttribution(h)}{h.source.revision?` · Version ${h.source.revision}`:""}</p><details><summary className="cursor-pointer text-sm">Full original source</summary><p className="whitespace-pre-wrap break-words text-sm">{h.source.text}</p></details></article>)}</section>}{feedback&&<div className="space-y-2 border-b pb-3"><InterviewFeedbackSection feedback={feedback}/><EarlierFeedbackRounds feedback={feedback}/>{otherThoughts.length>0&&<section aria-label="Interview thoughts from other rounds" className="space-y-2 border-t pt-3"><h3 className="font-medium">Interview thoughts from other rounds</h3>{otherThoughts.map(t=><article key={t.id}><p className="text-sm font-medium">{t.interviewer} · {t.roundName}</p><p className="whitespace-pre-wrap break-words">{t.text}</p></article>)}</section>}</div>}{earlier.length>0&&<div className="border-b pb-3"><EarlierFeedbackRounds rounds={earlier}/></div>}{fields.map(f=><section key={f.field}><h3 className="font-medium">{f.label}</h3><p className="whitespace-pre-wrap break-words">{f.full}</p></section>)}{observations&&<section className="space-y-3 border-t pt-3"><h3 className="font-medium">Additional observations</h3>{observations.length?observations.map(row=><article key={row.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{row.body}</p>{row.interactionContext&&<p className="text-sm">{row.interactionContext}</p>}<p className="text-xs text-muted-foreground">{row.author} · {row.roundName} · {new Date(row.createdAt).toLocaleString()} · Version {row.revision}</p></article>):<p>No shared additional observations.</p>}</section>}{data.interviewScore&&<p className="text-sm text-muted-foreground">{data.interviewScore.scope}. Missing scores are excluded.</p>}</DialogContent></Dialog>
  </section>;
}
