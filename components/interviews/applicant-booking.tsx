"use client"
import { useEffect, useState } from "react"
import { getApplicantSchedule, reserveInterview, cancelRoomBooking } from "@/lib/workspace-api"
import type { ApplicantSchedule } from "@/lib/interview-rooms"
import { BookingPicker } from "./booking-picker"
import { Button } from "@/components/ui/button"
export function ApplicantBooking({applicationId,onChanged}:{applicationId:string;onChanged?:()=>void}){
  const [data,setData]=useState<ApplicantSchedule|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0)
  useEffect(()=>{let current=true;setError("");getApplicantSchedule(applicationId).then(d=>{if(current)setData(d)}).catch(e=>{if(current)setError(e instanceof Error?e.message:"Could not load interview times.")});return()=>{current=false}},[applicationId,retry])
  async function refresh(){const next=await getApplicantSchedule(applicationId);setData(next);onChanged?.()}
  return <section className="my-7" aria-label="Book your interview">{error?<div role="alert" className="rounded-xl border p-5 text-sm"><p>{error}</p><Button variant="outline" className="mt-3" onClick={()=>setRetry(n=>n+1)}>Try again</Button></div>:!data?<p role="status" className="py-5 text-sm text-muted-foreground">Loading interview times…</p>:<BookingPicker rooms={data.rooms} clubName={data.clubName} roundName={data.roundName} booking={data.booking} onReserve={async slotId=>{await reserveInterview({applicationId,slotId});await refresh()}} onCancel={data.booking?async()=>{await cancelRoomBooking(data.booking!.id);await refresh()}:undefined}/>}</section>
}
