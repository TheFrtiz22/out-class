"use client";
import { LoadingState } from "@/components/ui/loading-state"
import { useCallback, useEffect, useState } from "react";
import { getCommunicationSchedules, cancelCommunicationSchedule } from "@/actions/communication-schedules";
import { resolveScheduleTime } from "@/lib/communication-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRevalidate } from "@/hooks/use-revalidate";
export type ScheduledItem=Awaited<ReturnType<typeof getCommunicationSchedules>>[number];
export type ScheduleTiming={localTime:string;timeZone:string;occurrence:"EARLIER"|"LATER";recipientMode:"FIXED"|"SEND_TIME"};
export const initialTiming=():ScheduleTiming=>({localTime:"",timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,occurrence:"EARLIER",recipientMode:"SEND_TIME"});
export function ScheduleFields({value,onChange,disabled,fixedOnly=false,fixedDescription}:{value:ScheduleTiming;onChange:(value:ScheduleTiming)=>void;disabled:boolean;fixedOnly?:boolean;fixedDescription?:string}) {
 let instant="";try{if(value.localTime)instant=resolveScheduleTime(value.localTime,value.timeZone,value.occurrence).toISOString();}catch(e){instant=e instanceof Error?e.message:"Invalid date or timezone.";}
 return <fieldset disabled={disabled} className="oc-form-section"><legend className="px-1 font-medium">Send time</legend>
 <p className="text-xs text-muted-foreground">Sends at or just after this time. It can be delayed a few minutes. Email is separate.</p>
 <label className="block space-y-2 text-sm">Local date and time<Input required type="datetime-local" value={value.localTime} onChange={e=>onChange({...value,localTime:e.target.value})}/></label>
 <label className="block space-y-2 text-sm">Timezone (IANA name)<Input required list="schedule-timezones" value={value.timeZone} onChange={e=>onChange({...value,timeZone:e.target.value})}/><datalist id="schedule-timezones">{["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Europe/London","Asia/Kolkata","UTC"].map(z=><option key={z} value={z}/>)}</datalist></label>
 <label className="block space-y-2 text-sm">If this hour occurs twice<select className="w-full rounded border bg-background p-3" value={value.occurrence} onChange={e=>onChange({...value,occurrence:e.target.value as ScheduleTiming["occurrence"]})}><option value="EARLIER">Earlier occurrence</option><option value="LATER">Later occurrence</option></select></label>
 {instant&&<p className="break-words text-xs" role="status">Resolved time: {instant}</p>}
 {!fixedOnly&&<label className="block space-y-2 text-sm">Recipient selection<select className="w-full rounded border bg-background p-3" value={value.recipientMode} onChange={e=>onChange({...value,recipientMode:e.target.value as ScheduleTiming["recipientMode"]})}><option value="SEND_TIME">Choose the audience when it sends</option><option value="FIXED">Freeze current selection</option></select></label>}
 <p className="text-xs text-muted-foreground">{fixedOnly?(fixedDescription??"Decisions use the candidates you reviewed. Your permissions and each applicant’s status are checked again when it sends. Times skipped by a clock change are not allowed."):"A fixed list never adds new people. Anyone who can no longer receive it is skipped. Email settings are checked separately. Times skipped by a clock change are not allowed."}</p>
 </fieldset>;
}
export function ScheduledCommunications({clubId,refresh,onEdit}:{clubId:string;refresh:number;onEdit:(row:ScheduledItem)=>void}) {
 const [rows,setRows]=useState<ScheduledItem[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{setRows(await getCommunicationSchedules(clubId));setError("");}catch{setError("Scheduled sends could not load.");}finally{setLoading(false);}},[clubId]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),30000);return()=>clearInterval(timer);},[load,refresh]);
 useRevalidate(load,{scopes:["communications"],enabled:!busy});
 return <section aria-labelledby="scheduled-heading" data-saving={busy} className="oc-content-panel space-y-3"><div className="oc-panel-heading"><h3 id="scheduled-heading" className="font-semibold">Scheduled sends</h3></div>
 <p className="text-sm text-muted-foreground">Inbox messages and email are separate. Sent in the app does not mean emailed. Shows all waiting sends and the last 50 completed.</p>
 {error&&<p role="alert" className="text-destructive">{error} <Button variant="outline" size="sm" disabled={busy} onClick={()=>void load()}>Try again</Button></p>}{loading?<LoadingState label="Loading scheduled announcements…" layout="feed" rows={3} />:!rows.length&&!error?<p className="rounded border p-5 text-sm">No scheduled sends. Choose Schedule in a new announcement.</p>:<ul className="divide-y divide-border">{rows.map(row=><li key={row.id} className="space-y-2 py-4"><div className="flex flex-wrap justify-between gap-3"><h4 className="break-words font-medium">{row.title}</h4><span className="text-xs">Inbox: {row.status.toLowerCase()}</span></div><p className="break-words text-xs">{row.localTime.replace("T"," ")} · {row.timeZone} · {row.occurrence.toLowerCase()} occurrence · {row.recipientMode==="FIXED"?"Fixed selection":"Audience when sent"}</p>{row.status==="PUBLISHED"&&<p className="text-xs">{row.recipientCount} notified in the app. Email: {row.email.queued} queued · {row.email.sent} sent · {row.email.suppressed} suppressed · {row.email.attention} need review.</p>}{row.failureCode&&<p role="alert" className="text-sm">Couldn’t send ({row.failureCode}). Recheck permissions and audience, then edit and reschedule.</p>}{["SCHEDULED","FAILED"].includes(row.status)&&<div className="flex flex-wrap gap-2">{row.canEdit&&<Button aria-label={`Edit ${row.title}`} variant="outline" disabled={busy} onClick={()=>onEdit(row)}>Edit</Button>}<Button aria-label={`Cancel ${row.title}`} variant="outline" disabled={busy} onClick={async()=>{if(!window.confirm("Cancel this scheduled message?"))return;setBusy(true);try{await cancelCommunicationSchedule(clubId,row.id,row.revision);await load();}catch{await load();setError("Couldn’t cancel. It may have already sent; the list shows its latest status.");}finally{setBusy(false);}}}>Cancel</Button></div>}</li>)}</ul>}
 </section>;
}
