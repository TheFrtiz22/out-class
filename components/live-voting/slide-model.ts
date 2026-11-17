import {anonymousApplicantLabel} from "@/lib/anonymous-review";
import {formatAverage,scoredEvaluationsLabel} from "@/lib/interview-review-summary";
import {NO_INTERVIEW_SCORES,interviewFeedbackPending} from "@/lib/interview-feedback";
import {highlightAttribution} from "@/lib/voting-slide-preparation";
import type {VotingSlideData} from "./applicant-slide";

/**
 * What one applicant's slide shows, in full, from the server-projected presentation only. The projector and the
 * leader screen render this same model (nothing is summarized away behind a details button); only fields the server
 * returned for this viewer enter it.
 */
export type SlideFact={field:string;label:string;value:string;unit?:string;meta:string[]};
export type SlideParagraph={text:string;quote?:boolean;meta?:string;muted?:boolean};
export type SlideNote={key:string;label:string;paragraphs:SlideParagraph[];weight:number};
export type SlideModel={name:string;anonymous:boolean;photo:string|null;showPhoto:boolean;profile:{field:string;text:string;accent?:boolean}[];facts:SlideFact[];notes:SlideNote[]};

const weigh=(paragraphs:SlideParagraph[])=>paragraphs.reduce((n,p)=>n+p.text.split("\n").reduce((m,line)=>m+Math.max(line.length,30),0)+(p.meta?30:0),0);
const note=(key:string,label:string,paragraphs:SlideParagraph[]):SlideNote=>({key,label,paragraphs,weight:weigh(paragraphs)+40});

export function slideModel(data:VotingSlideData):SlideModel{
 const section=(field:string)=>data.sections.find(s=>s.field===field);
 const name=section("name")?.items[0]??(data.anonymous?anonymousApplicantLabel(data.applicationId):"Applicant");
 const profile:SlideModel["profile"]=[];
 for(const field of ["major","academicYear"]){const s=section(field);if(s)profile.push({field,text:s.items.join(" · ")||"Not provided"});}
 const scholars="scholarStatus"in data&&data.requestedFields?.includes("scholarStatus")?(data.scholarStatus as string[]|undefined)??[]:null;
 if(scholars)scholars.length?scholars.forEach(text=>profile.push({field:"scholarStatus",text,accent:true})):profile.push({field:"scholarStatus",text:"No scholar program"});

 const facts:SlideFact[]=[];
 const earlier=data.earlierInterviewRounds??[];
 const earlierLine=earlier.length?`Earlier rounds · ${earlier.map(r=>`${r.roundName} ${r.average!==null?`${formatAverage(r.average)} / 10`:`${r.submitted} review${r.submitted===1?"":"s"}`}`).join("; ")}`:"";
 if(data.requestedFields?.includes("interviewScore")){
  const current=data.interviewScore?.current;
  if(current){
   const scored=current.status==="scored"&&current.average!==null;
   facts.push({field:"interviewScore",label:`Interview score · ${current.roundName}`,value:scored?formatAverage(current.average):current.status==="withheld"?"Not available":"No score",unit:scored?"/ 10":undefined,
    meta:[scored?`Average of ${scoredEvaluationsLabel(current.submitted)}`:current.status==="withheld"?"":NO_INTERVIEW_SCORES,earlierLine].filter(Boolean)});
  }else if(data.interviewScore){
   const rounds=data.interviewScore.byRound??[],feedbackRound="interviewFeedback"in data?data.interviewFeedback?.roundId:undefined;
   const r=rounds.find(r=>r.roundId===feedbackRound)??rounds.find(r=>r.roundId===data.roundId);
   const others=rounds.filter(o=>o!==r).map(o=>`${o.roundName} (separate round) ${formatAverage(o.average)} / 10`);
   facts.push({field:"interviewScore",label:r?`Interview score · ${r.roundName}`:"Interview score",value:r?formatAverage(r.average):"Not scored",unit:r?"/ 10":undefined,meta:[r?`Average of ${scoredEvaluationsLabel(r.submitted)}`:"",...others,earlierLine].filter(Boolean)});
  }
 }
 for(const field of ["sat","act","gpa"]){const s=section(field);if(s)facts.push({field,label:field==="gpa"?"GPA":field.toUpperCase(),value:s.items.join(" · ")||"Not provided",meta:[]});}

 const notes:SlideNote[]=[];
 const feedback=data.requestedFields?.includes("finalInterviewThoughts")&&"interviewFeedback"in data?data.interviewFeedback:undefined;
 if(feedback){
  const said=feedback.entries.filter(e=>e.summary?.trim());
  notes.push(note("finalInterviewThoughts","Interviewer final thoughts",[...(said.length?said.map(e=>({text:e.summary!,quote:true})):[{text:"No submitted final thoughts yet.",muted:true}]),...(feedback.pending>0?[{text:interviewFeedbackPending(feedback.pending),muted:true}]:[])]));
 }else if(!("earlierInterviewRounds"in data)&&data.requestedFields?.includes("finalInterviewThoughts")&&data.finalInterviewThoughts){
  const thoughts=data.finalInterviewThoughts;
  notes.push(note("finalInterviewThoughts","Interviewer final thoughts",thoughts.length?thoughts.map(t=>({text:t.text,quote:true,meta:t.roundName})):[{text:"No submitted final thoughts yet."}]));
 }
 // Earlier rounds keep their own labelled groups: never merged into this round's thoughts or score.
 const earlierGroups=feedback?.earlierRounds?.length?feedback.earlierRounds:earlier;
 for(const r of earlierGroups){const said=r.entries.filter(e=>e.summary?.trim());if(said.length)notes.push(note(`earlier:${r.roundId}`,`Earlier round · ${r.roundName}`,said.map(e=>({text:e.summary!,quote:true}))));}
 if(feedback){const other=data.finalInterviewThoughts??[];if(other.length)notes.push(note("otherThoughts","Interview thoughts from other rounds",other.map(t=>({text:t.text,quote:true,meta:t.roundName}))));}
 if(data.requestedFields?.includes("resumeHighlight")&&"resumeHighlight"in data)
  notes.push(note("resumeHighlight","From the résumé",data.resumeHighlight?[{text:data.resumeHighlight.quote,meta:`Page ${data.resumeHighlight.page}`}]:[{text:"No selected résumé excerpt."}]));
 const prepared="preparedHighlights"in data?data.preparedHighlights??[]:[];
 if(prepared.length)notes.push(note("preparedHighlights","Leader-selected highlights",prepared.map(h=>({text:h.mode==="QUOTE"?h.text:`Leader summary: ${h.text}`,quote:h.mode==="QUOTE",meta:highlightAttribution(h)}))));
 const observations=data.requestedFields?.includes("additionalObservations")?data.additionalObservations:undefined;
 if(observations)notes.push(note("additionalObservations","Additional observations",observations.length?observations.map(o=>({text:o.body,meta:[o.interactionContext,o.author].filter(Boolean).join(" · ")||undefined})):[{text:"No shared additional observations."}]));
 return {name,anonymous:data.anonymous,photo:data.visible.includes("photo")?data.photo:null,showPhoto:data.visible.includes("photo")||data.anonymous,profile,facts,notes};
}

/** Two reading columns of similar length, each a contiguous run of notes in order (reading order is kept). */
export function balanceColumns<T extends {weight:number}>(items:readonly T[]):T[][]{
 if(items.length<2)return [items.slice()];
 const total=items.reduce((n,i)=>n+i.weight,0);let best=1,gap=Infinity,run=0;
 for(let k=1;k<items.length;k++){run+=items[k-1].weight;const g=Math.abs(total-2*run);if(g<gap){gap=g;best=k;}}
 return [items.slice(0,best),items.slice(best)];
}
