"use client"
import { userMessage } from "@/lib/user-message"
import { LoadingState } from "@/components/ui/loading-state"
import { useEffect, useState } from "react"
import { getApplicantSchedule, reserveInterview, cancelRoomBooking } from "@/lib/workspace-api"
import type { ApplicantSchedule } from "@/lib/interview-rooms"
import { BookingPicker } from "./booking-picker"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { ALUMNI_REFUSALS, isAlumniProfile } from "@/lib/graduation"
export function ApplicantBooking({applicationId,onChanged,heading=false}:{applicationId:string;onChanged?:()=>void;heading?:boolean}){
  // Alumni accounts are read-only (lib/graduation.ts): a booked time shows, with no booking, moving or cancelling.
  const alumni=isAlumniProfile(useAuth().user?.profile)
  const [data,setData]=useState<ApplicantSchedule|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0)
  useEffect(()=>{let current=true;setData(null);setError("");getApplicantSchedule(applicationId).then(d=>{if(current)setData(d)}).catch(e=>{if(current)setError(userMessage(e, "Could not load interview times."))});return()=>{current=false}},[applicationId,retry])
  async function refresh(){const next=await getApplicantSchedule(applicationId);setData(next);onChanged?.()}
  // What was just saved, shown from the save itself when the times can't be reloaded: the new time, or no booking.
  function showSaved(saved:{id:string;slotId:string}|null){setData(d=>{if(!d)return d;if(!saved)return {...d,booking:null};const room=d.rooms.find(r=>r.slots.some(s=>s.id===saved.slotId)),slot=room?.slots.find(s=>s.id===saved.slotId);return room&&slot?{...d,booking:{id:saved.id,applicationId,slotId:slot.id,roomId:room.id,roundId:d.booking?.roundId??room.roundId,candidate:"You",startTime:slot.startTime,endTime:slot.endTime,location:room.location}}:d})}
  // The time is already saved; a slow reload must not read as a failed booking. Try once more, then show what was saved.
  async function refreshAfterSave(saved?:{id:string;slotId:string}|null){try {await refresh()} catch {try {await new Promise(r=>setTimeout(r,1500));await refresh()} catch {if(saved!==undefined)showSaved(saved);onChanged?.()}}}
  const booked=!!data?.booking&&+new Date(data.booking.endTime)>Date.now()
  // Once a time is reserved the section is about that interview, not about booking one.
  return <section className="my-7" aria-label={booked?"Your interview":"Book your interview"}>{heading&&<h2 className="oc-section-heading mb-4">{booked?"Your interview":"Book your interview"}</h2>}{error?<div role="alert" className="rounded-xl border p-5 text-sm"><p>{error}</p><Button variant="outline" className="mt-3" onClick={()=>setRetry(n=>n+1)}>Try again</Button></div>:!data?<LoadingState label="Loading interview times…" layout="calendar" />:<>{!!data.conflictingTimes&&<p className="mb-3 text-sm text-muted-foreground" data-testid="booking-conflicts">{data.conflictingTimes} time{data.conflictingTimes===1?" is":"s are"} hidden because {data.conflictingTimes===1?"it overlaps":"they overlap"} another interview you’ve booked.</p>}{alumni?<><p role="status" className="mb-3 text-sm text-muted-foreground">{ALUMNI_REFUSALS.book}</p><BookingPicker rooms={[]} clubName={data.clubName} roundName={data.roundName} booking={data.booking} publicationState={data.publicationState} allowRescheduling={false}/></>:<BookingPicker rooms={data.rooms} clubName={data.clubName} roundName={data.roundName} booking={data.booking} publicationState={data.publicationState} allowRescheduling={data.allowRescheduling} onReserve={async slotId=>{let saved:{id:string}|undefined;try {saved=await reserveInterview({applicationId,slotId})} catch(e) {try {await refresh()} catch {} throw e} await refreshAfterSave(saved?.id?{id:saved.id,slotId}:undefined)}} onCancel={data.booking&&data.allowCancellation!==false?async()=>{await cancelRoomBooking(data.booking!.id);await refreshAfterSave(null)}:undefined}/>}</>}</section>
}
