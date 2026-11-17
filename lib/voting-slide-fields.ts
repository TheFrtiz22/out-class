import {fieldLabels,type ApplicantDisplay} from "@/lib/applicant-display";
import {roomDisplayConfig,type LiveRoomField} from "@/lib/voting-room";
import {scholarNames} from "@/lib/scholar-status";

/** The setup switches, grouped as the slide reads them. Scholar status is off unless a leader turns it on. */
export const slideFieldGroups:readonly (readonly [string,readonly LiveRoomField[]])[]=[["Profile",["photo","name","major","academicYear","scholarStatus"]],["Scores",["interviewScore","sat","act","gpa"]],["Notes",["resumeHighlight","finalInterviewThoughts","additionalObservations"]]];
export function slideFieldLabel(f:LiveRoomField){
  return f==="scholarStatus"?"Scholar status":f==="gpa"?"GPA":f==="resumeHighlight"?"Résumé excerpt":f==="interviewScore"?"Interview score":f==="additionalObservations"?"Additional observations":f==="finalInterviewThoughts"?"Interviewer final thoughts":fieldLabels[f];
}
/** Scholar programme names for a voting slide: only when the leader selected the field, the round is identified and
 * the club's applicant profile setting shows scholar status (`ceiling`, from allowedByProfileCeiling). Callers pass the
 * authorized application's profile value; anonymous (blind) rounds and hidden settings never receive it. */
export function selectedScholarStatus(fields:readonly string[]|undefined,anonymous:boolean,raw:unknown,ceiling:boolean):{scholarStatus?:string[]}{
  return fields?.includes("scholarStatus")&&!anonymous&&ceiling?{scholarStatus:scholarNames(raw)}:{};
}
type SlideEvidence={interviewScore?:unknown;finalInterviewThoughts?:unknown};
/**
 * The one assembly of a voting slide payload from its separately authorized parts (live room, setup preview and Demo).
 * `requestedFields` is derived from the parts actually present, so a part withheld or redacted upstream is never listed;
 * any whole-presentation redaction wraps this single return.
 */
export function assembleVotingPresentation<D extends {visible:readonly string[]},E extends SlideEvidence,H extends object,O extends {additionalObservations?:unknown},P extends object>(parts:{display:D;evidence:E;highlight:H;observations:O;scholar:{scholarStatus?:string[]};prepared?:P}){
  const {display,evidence,highlight,observations,scholar,prepared}=parts;
  return {...display,...evidence,...highlight,...observations,...(prepared??{} as P),...scholar,
    requestedFields:[...display.visible as D["visible"],...(scholar.scholarStatus?["scholarStatus" as const]:[]),...("resumeHighlight"in highlight?["resumeHighlight" as const]:[]),...(evidence.interviewScore?["interviewScore" as const]:[]),...(evidence.finalInterviewThoughts?["finalInterviewThoughts" as const]:[]),...(observations.additionalObservations?["additionalObservations" as const]:[])]};
}
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
  if(!want.has("scholarStatus"))delete next.scholarStatus;
  return next as T;
}
