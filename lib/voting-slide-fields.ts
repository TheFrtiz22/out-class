import type {ApplicantDisplay} from "@/lib/applicant-display";
import {roomDisplayConfig,type LiveRoomField} from "@/lib/voting-room";

/** Reapply the current selection after the separately authorized display read.
 * A concurrent setup edit must not return a previously selected field. */
export function selectedVotingDisplay(display:ApplicantDisplay,fields:LiveRoomField[]|undefined):ApplicantDisplay{
  if(!fields)return display;
  const configured=roomDisplayConfig(fields).fields;
  const visible=configured.filter(f=>display.visible.includes(f));
  return {...display,configured:visible,visible,withheld:[],
    sections:visible.flatMap(field=>display.sections.filter(s=>s.field===field)),
    photo:visible.includes("photo")?display.photo:null,
    links:display.links.filter(link=>visible.includes(link.field as typeof visible[number])),observations:[]};
}

/** The parts of a setup preview slide that depend on the selected fields. */
type SlideFields={visible:readonly string[];sections:readonly {field:string}[];photo?:unknown;configured?:readonly string[];links?:readonly {field:string}[];requestedFields?:readonly string[]};
/**
 * Instant setup preview: narrows a slide read with every allowed field to the fields now selected,
 * so a switch shows its effect before the exact preview for that selection returns. It only removes
 * content; the exact server read for the selection replaces it as soon as it arrives.
 */
/** Whether narrowVotingSlide gives the same evidence the exact read would: true unless exactly one of score and thoughts is on. */
export function narrowsExactly(fields:readonly LiveRoomField[]){return fields.includes("interviewScore")===fields.includes("finalInterviewThoughts");}
export function narrowVotingSlide<T extends SlideFields>(data:T,fields:readonly LiveRoomField[]):T{
  const want=new Set<string>(fields),keep=(f:string)=>want.has(f);
  const next:Record<string,unknown>={...data,visible:data.visible.filter(keep),sections:data.sections.filter(s=>keep(s.field)),photo:want.has("photo")?data.photo:null};
  if(data.configured)next.configured=data.configured.filter(keep);
  if(data.links)next.links=data.links.filter(l=>keep(l.field));
  if(data.requestedFields)next.requestedFields=data.requestedFields.filter(keep);
  // Interview evidence is projected from both switches together (lib/voting-interview-evidence.ts), so the
  // full read only stands in for it when both are on. Both off shows none (as the server does); one on waits for the exact read.
  if(!(fields.includes("interviewScore")&&fields.includes("finalInterviewThoughts"))){delete next.interviewScore;delete next.finalInterviewThoughts;delete next.interviewFeedback;delete next.earlierInterviewRounds;}
  if(!want.has("resumeHighlight"))delete next.resumeHighlight;
  if(!want.has("additionalObservations"))delete next.additionalObservations;
  return next as T;
}
