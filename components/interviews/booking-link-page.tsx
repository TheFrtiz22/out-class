"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useDemoMode } from "@/contexts/demo-context"
import { useAuth } from "@/contexts/auth-context"
import { getBookingApplication } from "@/lib/workspace-api"
import { ApplicantBooking } from "./applicant-booking"
export function BookingLinkPage(){
  const params=useSearchParams(),demo=useDemoMode(),auth=useAuth(),clubId=params.get("clubId"),roundId=params.get("roundId")
  const userId = auth.user?.id
  const [id,setId]=useState(""),[error,setError]=useState("")
  useEffect(()=>{if(!demo.ready||auth.loading||!userId)return;let current=true;setId("");setError("");if(!clubId||!roundId){setError("This booking link is incomplete. Open your application to choose an interview time.");return}getBookingApplication(clubId,roundId).then(v=>{if(current)setId(v.applicationId)}).catch(e=>{if(current)setError(e instanceof Error?e.message:"Could not load this invitation.")});return()=>{current=false}},[clubId,roundId,demo.ready,auth.loading,userId])
  return <main className="mx-auto max-w-6xl px-5 py-10"><Link href="/?workspace=student" className="text-sm text-muted-foreground hover:underline">← OutClass home</Link><h1 className="mt-6 text-3xl font-semibold tracking-tight">Book your interview</h1>{!auth.loading&&!auth.user?<p className="mt-5 text-sm">Sign in to OutClass with your applicant account, then reopen this invitation link. <Link href="/" className="underline">Sign in</Link></p>:error?<p role="alert" className="mt-5 rounded-xl border p-5 text-sm">{error}</p>:id?<ApplicantBooking key={id} applicationId={id}/>:<p role="status" className="mt-5 text-sm">Loading your invitation…</p>}</main>
}
