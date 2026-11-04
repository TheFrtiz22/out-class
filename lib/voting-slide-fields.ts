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
