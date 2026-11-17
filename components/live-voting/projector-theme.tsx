"use client";
import {useCallback,useSyncExternalStore} from "react";
import {SegmentedControl} from "@/components/ui/segmented-control";

/**
 * Light or dark projector, per device. There is no session field for it, so the choice is kept in this browser
 * (localStorage, keyed by session): the leader's switch and the projector window opened from the same computer
 * share it and update together (the storage event). Another device keeps its own choice; dark is the default.
 */
export type ProjectorTheme="dark"|"light";
const key=(sessionId:string)=>`oc-projector-theme:${sessionId}`;
const local="oc-projector-theme";
/** When storage is unavailable (private mode, blocked site data) the choice lives for this page only. */
const fallback=new Map<string,ProjectorTheme>();
function read(sessionId:string):ProjectorTheme{
 try{const v=window.localStorage.getItem(key(sessionId));return v==="light"||v==="dark"?v:fallback.get(sessionId)??"dark";}catch{return fallback.get(sessionId)??"dark";}
}
function subscribe(onChange:()=>void){
 window.addEventListener("storage",onChange);window.addEventListener(local,onChange);
 return()=>{window.removeEventListener("storage",onChange);window.removeEventListener(local,onChange);};
}
export function useProjectorTheme(sessionId:string){
 const theme=useSyncExternalStore(subscribe,()=>read(sessionId),()=>"dark" as ProjectorTheme);
 const set=useCallback((next:ProjectorTheme)=>{
  fallback.set(sessionId,next);
  try{window.localStorage.setItem(key(sessionId),next);}catch{/* Private mode or blocked storage: this window still switches. */}
  window.dispatchEvent(new Event(local));
 },[sessionId]);
 return [theme,set] as const;
}
/** The tokens attribute for a room surface: dark keeps the projector tokens, light restates the cream/navy ones. */
export const projectorThemeAttribute=(theme:ProjectorTheme)=>theme==="light"?"present-light":"present";

export function ProjectorThemeSwitch({value,onChange,label="Projector theme",className}:{value:ProjectorTheme;onChange:(v:ProjectorTheme)=>void;label?:string;className?:string}){
 return <SegmentedControl label={label} size="compact" className={className} value={value} onChange={onChange} options={[{value:"dark",label:"Dark"},{value:"light",label:"Light"}]}/>;
}
