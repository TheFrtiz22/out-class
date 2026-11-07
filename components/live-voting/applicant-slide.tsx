"use client";
import {useRef,useState} from "react";
import Image from "next/image";
import type {getLiveVotingPresentation} from "@/actions/voting-room";
import {fieldLabels} from "@/lib/applicant-display";
import {anonymousApplicantLabel} from "@/lib/anonymous-review";
import {liveRoomFields} from "@/lib/voting-room";
import {formatAverage} from "@/lib/interview-review-summary";
import {highlightAttribution} from "@/lib/voting-slide-preparation";
import {Dialog,DialogContent,DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";

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
  if(data.requestedFields?.includes("interviewScore")&&data.interviewScore){
    const score=data.interviewScore,rounds=score.byRound??[];
    const aggregate=score.average===null?"Not yet scored":`${formatAverage(score.average)} / 10 · ${score.submitted} submitted evaluation${score.submitted===1?"":"s"}`;
    const breakdown=rounds.map(r=>`${r.roundName}: ${formatAverage(r.average)} / 10 · ${r.submitted} submitted evaluation${r.submitted===1?"":"s"}`);
    fields.push({field:"interviewScore",label:"Interview scores · 1–10",preview:aggregate,note:rounds.map(r=>r.roundName).join(" · "),full:[aggregate,...breakdown].join("\n")});
  }
  if(data.requestedFields?.includes("finalInterviewThoughts")&&data.finalInterviewThoughts){
    const thoughts=data.finalInterviewThoughts,first=thoughts[0];
    fields.push({field:"finalInterviewThoughts",label:"Submitted final interview thoughts",preview:first?first.text:"No submitted final interview thoughts.",note:first?`Latest · ${first.interviewer} · ${first.roundName} · ${thoughts.length} submitted summar${thoughts.length===1?"y":"ies"}`:"",full:thoughts.length?thoughts.map(t=>`${t.interviewer} · ${t.roundName}\n${t.text}`).join("\n\n"):"No submitted final interview thoughts."});
  }
  const observations=data.requestedFields?.includes('additionalObservations')?data.additionalObservations:undefined;
  const prepared="preparedHighlights"in data?data.preparedHighlights??[]:[];
  fields.sort((a,b)=>{const order=(f:string)=>{const i=(liveRoomFields as readonly string[]).indexOf(f);return i<0?100:i;};return order(a.field)-order(b.field)||a.field.localeCompare(b.field);});
  return <section aria-label="Current applicant presentation" className="vr-applicant">
    <header className="vr-person">{data.visible.includes("photo")&&(data.photo?<Image unoptimized width={76} height={76} src={data.photo} alt="Applicant headshot" className="vr-photo"/>:<div className="vr-photo vr-photo-empty" role="img" aria-label="No applicant photo">No photo</div>)}<h2 tabIndex={-1} data-applicant-heading>{name}</h2>
    {prepared.length>0&&<section className="vr-highlights" aria-label="Leader-selected highlights"><ul>{prepared.map(h=><li key={h.id} className="vr-highlight" data-highlight-mode={h.mode}>
      <p>{h.mode==="QUOTE"?<q>{highlightPreview(h.text)}</q>:<><span className="vr-highlight-kind">Leader summary:</span> {highlightPreview(h.text)}</>}</p>
      <p className="vr-field-meta">{highlightAttribution(h)}</p></li>)}</ul></section>}</header>
    <div className="vr-fields">{fields.map(f=><section className="vr-field" key={f.field} data-slide-field={f.field}><h3>{f.label}</h3><p>{excerpt(f.preview)}</p>{f.note&&<p className="vr-field-meta">{excerpt(f.note)}</p>}{(f.full!==f.preview||f.preview.length>150||f.note.length>150)&&<Button type="button" variant="link" className="h-auto min-h-11 p-0" onClick={open}>Read full {f.label.toLowerCase()}</Button>}</section>)}</div>
    <footer className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={open}>{prepared.length?"Applicant details and highlight sources":"Applicant details"}</Button>{observations&&<Button type="button" variant="ghost" size="sm" onClick={open}>Additional observations · {observations.length}</Button>}</footer>
    <Dialog open={details} onOpenChange={setDetails}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();origin.current?.focus();}} className="max-h-[85dvh] overflow-y-auto" aria-describedby={undefined}><DialogTitle>{name} · Details</DialogTitle>{prepared.length>0&&<section className="space-y-3 border-b pb-3"><h3 className="font-medium">Highlights and their full sources</h3>{prepared.map(h=><article key={h.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{h.mode==="QUOTE"?<q>{h.text}</q>:<><span className="font-medium">Leader summary{h.writtenBy?` by ${h.writtenBy}`:""}:</span> {h.text}</>}</p><p className="text-xs text-muted-foreground">{h.mode==="QUOTE"?"Excerpt from":"Based on"} {highlightAttribution(h)}{h.source.revision?` · Version ${h.source.revision}`:""}</p><details><summary className="cursor-pointer text-sm">Full original source</summary><p className="whitespace-pre-wrap break-words text-sm">{h.source.text}</p></details></article>)}</section>}{fields.map(f=><section key={f.field}><h3 className="font-medium">{f.label}</h3><p className="whitespace-pre-wrap break-words">{f.full}</p></section>)}{observations&&<section className="space-y-3 border-t pt-3"><h3 className="font-medium">Additional observations</h3>{observations.length?observations.map(row=><article key={row.id} className="space-y-1"><p className="whitespace-pre-wrap break-words">{row.body}</p>{row.interactionContext&&<p className="text-sm">{row.interactionContext}</p>}<p className="text-xs text-muted-foreground">{row.author} · {row.roundName} · {new Date(row.createdAt).toLocaleString()} · Version {row.revision}</p></article>):<p>No shared additional observations.</p>}</section>}{data.interviewScore&&<p className="text-sm text-muted-foreground">{data.interviewScore.scope}. Missing scores are excluded.</p>}</DialogContent></Dialog>
  </section>;
}
