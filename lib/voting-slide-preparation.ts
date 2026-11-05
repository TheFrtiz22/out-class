import {z} from "zod";

/** Leader-prepared applicant highlights for live voting slides.
 * Sources are gathered server-side from already-authorized, submitted/shared
 * material. A QUOTE is a verbatim excerpt of its source; a SUMMARY is clearly
 * labelled leader writing. Nothing here ranks applicants or generates text. */
export const slideSourceTypes=["PROFILE","INTERVIEW_SCORE","INTERVIEW_THOUGHT","OBSERVATION","RESUME"] as const;
export type SlideSourceType=typeof slideSourceTypes[number];
export const slideSourceTypeLabels:Record<SlideSourceType,string>={PROFILE:"Application / profile",INTERVIEW_SCORE:"Interview score",INTERVIEW_THOUGHT:"Final interview thoughts",OBSERVATION:"Additional observation",RESUME:"Résumé highlight"};
export const maxSlideHighlights=3;
export const maxQuoteLength=400;
export const maxSummaryLength=280;

const sha256=z.string().regex(/^[a-f0-9]{64}$/);
export const slideSourceRef=z.object({type:z.enum(slideSourceTypes),id:z.string().min(1).max(200),version:sha256}).strict();
export const slideHighlightInput=z.object({
  id:z.string().uuid(),mode:z.enum(["QUOTE","SUMMARY"]),
  text:z.string().trim().min(1,"Highlights cannot be empty.").max(maxQuoteLength),
  source:slideSourceRef,
}).strict().superRefine((h,ctx)=>{if(h.mode==="SUMMARY"&&h.text.length>maxSummaryLength)ctx.addIssue({code:z.ZodIssueCode.custom,message:`Keep leader summaries to ${maxSummaryLength} characters.`});});
export type SlideHighlightInput=z.output<typeof slideHighlightInput>;

export const slidePreparationScope=z.object({clubId:z.string().uuid(),sessionId:z.string().uuid()}).strict();
export const saveSlidePreparationSchema=slidePreparationScope.extend({
  applicationId:z.string().uuid(),requestId:z.string().uuid(),
  /** 0 when no preparation has been saved for this applicant yet. */
  revision:z.number().int().nonnegative(),
  highlights:z.array(slideHighlightInput).max(maxSlideHighlights,`Choose up to ${maxSlideHighlights} highlights.`),
}).strict().superRefine((d,ctx)=>{if(new Set(d.highlights.map(h=>h.id)).size!==d.highlights.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Duplicate highlight."});});

/** Snapshot of the source exactly as the leader saw it, kept with each highlight
 * so a locked slide and its details link never change when the source is edited. */
export const slideSourceSnapshot=z.object({
  type:z.enum(slideSourceTypes),id:z.string(),version:sha256,revision:z.number().int().positive().nullable(),
  label:z.string(),author:z.string().nullable(),roundId:z.string().nullable(),roundName:z.string().nullable(),text:z.string(),
}).strict();
export type SlideSource=z.output<typeof slideSourceSnapshot>;
export const storedSlideHighlight=z.object({id:z.string().uuid(),mode:z.enum(["QUOTE","SUMMARY"]),text:z.string(),source:slideSourceSnapshot,writtenBy:z.string().nullable()}).strict();
export type StoredSlideHighlight=z.output<typeof storedSlideHighlight>;
export function storedHighlights(value:unknown):StoredSlideHighlight[]{const v=z.array(storedSlideHighlight).max(maxSlideHighlights).safeParse(value);return v.success?v.data:[];}

/** Validate leader input against the current authorized sources and build the
 * stored form. Throws a user-facing message; never trims or rewrites a quote. */
export function buildSlideHighlights(input:SlideHighlightInput[],sources:SlideSource[],writtenBy:string,previous:StoredSlideHighlight[]=[]):StoredSlideHighlight[]{
  if(input.length>maxSlideHighlights)throw Error(`Choose up to ${maxSlideHighlights} highlights.`);
  return input.map(h=>{
    const source=sources.find(s=>s.type===h.source.type&&s.id===h.source.id);
    const kept=previous.find(p=>p.id===h.id&&p.source.type===h.source.type&&p.source.id===h.source.id&&p.source.version===h.source.version&&p.mode===h.mode&&p.text===h.text);
    // An unchanged, previously saved highlight may keep an older source version
    // until the leader deliberately reviews it; nothing is silently refreshed.
    if(kept)return kept;
    if(!source)throw Error("A selected source is no longer available to you. Remove it or choose another source.");
    if(source.version!==h.source.version)throw Error("A source changed while you were preparing. Review the updated source before saving.");
    if(h.mode==="QUOTE"&&!source.text.includes(h.text))throw Error("Excerpts must be copied exactly from the original source. Write a leader summary to paraphrase.");
    return {id:h.id,mode:h.mode,text:h.text,source,writtenBy:h.mode==="SUMMARY"?writtenBy:null};
  });
}

export type SlideHighlightStatus="CURRENT"|"UPDATED"|"UNAVAILABLE";
export function slideHighlightStatus(h:StoredSlideHighlight,sources:SlideSource[]):SlideHighlightStatus{
  const source=sources.find(s=>s.type===h.source.type&&s.id===h.source.id);
  return !source?"UNAVAILABLE":source.version===h.source.version?"CURRENT":"UPDATED";
}
/** Guidance only: two or three when material exists; never a voting blocker. */
export function preparationGap(count:number,sourceCount:number){
  if(count>=2||count>=sourceCount&&count>0)return null;
  if(!sourceCount)return "No source material yet";
  return count?"Consider one more highlight":"No highlights selected";
}
export function highlightAttribution(h:StoredSlideHighlight){
  return [slideSourceTypeLabels[h.source.type],h.source.author,h.source.roundName].filter(Boolean).join(" · ");
}
